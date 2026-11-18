/** Lecturas persistentes por cuenta y servidor. Nunca almacena credenciales. */
import {Observable,ReplaySubject,firstValueFrom} from 'rxjs';

export interface LocalReadEntry {id:string;scope:string;key:string;group:string;savedAt:number;body:unknown;}
export interface ReadRepository {
  get(id:string):Promise<LocalReadEntry|undefined>;
  put(entry:LocalReadEntry):Promise<void>;
  invalidateGroups(scope:string,groups:string[],update:(entry:LocalReadEntry)=>LocalReadEntry):Promise<void>;
}

/** IndexedDB evita bloquear la interfaz al leer el catálogo o el perfil con foto. */
export class IndexedReadRepository implements ReadRepository {
  private database?:Promise<IDBDatabase>;
  private open():Promise<IDBDatabase> {
    return this.database??=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('gymbro-local-reads',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('reads',{keyPath:'id'});
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Almacenamiento ocupado'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=undefined;};resolve(db);};
    }).catch(error=>{this.database=undefined;throw error;});
  }
  async get(id:string):Promise<LocalReadEntry|undefined> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('reads','readonly'),request=tx.objectStore('reads').get(id);
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=()=>reject(tx.error);
      tx.onerror=()=>reject(tx.error);
    });
  }
  async put(entry:LocalReadEntry):Promise<void> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('reads','readwrite');tx.objectStore('reads').put(entry);
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
    });
  }
  async invalidateGroups(scope:string,groups:string[],update:(entry:LocalReadEntry)=>LocalReadEntry):Promise<void> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('reads','readwrite'),cursor=tx.objectStore('reads').openCursor();
      cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;const entry=item.value as LocalReadEntry;if(entry.scope===scope&&groups.includes(entry.group))item.update(update(entry));item.continue();};
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
    });
  }
}

const copy=<T>(value:T):T=>value==null?value:JSON.parse(JSON.stringify(value));
export function persistentRead(path:string):boolean {
  return ['/api/auth/me','/api/routines','/api/exercises','/api/progress/summary','/api/welcome/status'].includes(path);
}

/** Aplica respuestas confirmadas al respaldo sin esperar otra consulta de red. */
export function applyReadMutation(entry:LocalReadEntry,path:string,response:unknown):LocalReadEntry {
  const result=response as Record<string,unknown>|null;
  let body=copy(entry.body);
  if(entry.key==='/api/auth/me'&&path==='/api/auth/me'&&result?.['id'])body=result;
  const day=path.match(/^\/api\/routines\/([^/]+)\/days\/([^/]+)\/(schedule|favorite)$/);
  if(entry.key==='/api/routines'&&day&&Array.isArray(body)&&result){
    body=body.map(routine=>routine.id!==day[1]?routine:{...routine,days:routine.days.map((item:Record<string,unknown>)=>item['id']!==day[2]?item:{...item,[day[3]]:result[day[3]]})});
  }
  if(entry.key==='/api/routines'&&path==='/api/routines'&&Array.isArray(body)&&Array.isArray(result?.['days']))body=[...body.filter(item=>item.id!==result!['id']),result];
  if(entry.key==='/api/exercises'&&path==='/api/exercises'&&Array.isArray(body)&&result?.['id'])body=[...body.filter(item=>item.id!==result['id']),result];
  if(entry.key==='/api/welcome/status'&&(path==='/api/welcome/accept'||path==='/api/welcome/skip'||path==='/api/routines'))body={...(body as object),needed:false,...(path!=='/api/welcome/skip'?{hasRoutines:true}:{})};
  return {...entry,savedAt:0,body:copy(body)};
}

/** Entrega primero la copia local y renueva en segundo plano sin propagar fallos de red. */
export class LocalReadCache {
  private readonly memory=new Map<string,LocalReadEntry>();
  private readonly pending=new Map<string,Observable<unknown>>();
  private readonly revisions=new Map<string,number>();
  private readonly readers=new Map<string,{scope:string;group:string;refresh:()=>void;current:()=>boolean}>();
  private readonly retryAfter=new Map<string,number>();
  private barrier:Promise<unknown>=Promise.resolve();
  constructor(private readonly repository:ReadRepository,private readonly now=()=>Date.now()){}
  private generation(scope:string,group:string){return this.revisions.get(JSON.stringify([scope,group]))||0;}
  invalidate(scope:string,groups:string[],path='',response:unknown=null):Promise<unknown> {
    for(const group of groups){const id=JSON.stringify([scope,group]);this.revisions.set(id,this.generation(scope,group)+1);}
    const update=(entry:LocalReadEntry)=>applyReadMutation(entry,path,response);
    for(const [id,entry] of this.memory)if(entry.scope===scope&&groups.includes(entry.group))this.memory.set(id,update(entry));
    // Conserva la última copia si cae la red, incorporando primero la edición confirmada.
    this.barrier=this.barrier.then(()=>this.repository.invalidateGroups(scope,groups,update)).catch(()=>{});
    return this.barrier;
  }
  refresh(scope?:string,groups?:string[]):void {
    for(const reader of this.readers.values())if(reader.current()&&(!scope||reader.scope===scope)&&(!groups||groups.includes(reader.group)))reader.refresh();
  }
  read<T>(scope:string,key:string,policy:{group:string;ttl:number},load:()=>Observable<T>,current:()=>boolean,session='',force=false):Observable<T> {
    return new Observable<T>(subscriber=>{
      const id=JSON.stringify([scope,key]),generation=this.generation(scope,policy.group);
      this.readers.set(id,{scope,group:policy.group,current,refresh:()=>this.read(scope,key,policy,load,current,session,true).subscribe({error:()=>{}})});
      const pendingId=JSON.stringify([id,generation,session]);
      let stream=this.pending.get(pendingId) as ReplaySubject<T>|undefined;
      if(!stream){
        stream=new ReplaySubject<T>(1);this.pending.set(pendingId,stream);
        // El trabajo interno sigue aunque una guarda use firstValueFrom y deje de escuchar.
        void this.load(id,pendingId,scope,key,policy,generation,load,current,stream,force);
      }
      return stream.subscribe({next:value=>{if(current()&&generation===this.generation(scope,policy.group))subscriber.next(copy(value));},error:error=>current()?subscriber.error(error):subscriber.complete(),complete:()=>subscriber.complete()});
    });
  }
  private async load<T>(id:string,pendingId:string,scope:string,key:string,policy:{group:string;ttl:number},generation:number,load:()=>Observable<T>,current:()=>boolean,stream:ReplaySubject<T>,force:boolean) {
    const valid=()=>current()&&generation===this.generation(scope,policy.group);
    let cached:LocalReadEntry|undefined;
    try {
      await this.barrier;
      cached=this.memory.get(id);
      if(!cached){try{cached=await this.repository.get(id);}catch{/* Si IndexedDB falla, la red sigue disponible. */}}
      if(!valid()){stream.complete();return;}
      if(cached&&(cached.id!==id||cached.scope!==scope||cached.key!==key||cached.group!==policy.group||!Number.isFinite(cached.savedAt)))cached=undefined;
      if(cached){this.memory.set(id,cached);stream.next(copy(cached.body as T));}
      if(cached&&!force&&(cached.savedAt+policy.ttl>this.now()||(this.retryAfter.get(id)||0)>this.now())){stream.complete();return;}
      try {
        const body=await firstValueFrom(load());
        if(!valid()){stream.complete();return;}
        const entry:LocalReadEntry={id,scope,key,group:policy.group,savedAt:this.now(),body:copy(body)};
        this.retryAfter.delete(id);
        this.memory.set(id,entry);
        // No retrasa la respuesta: una lectura fallida nunca borra la última copia válida.
        const write=this.repository.put(entry).catch(()=>{});
        this.barrier=Promise.all([this.barrier,write]);
        if(!cached||JSON.stringify(cached.body)!==JSON.stringify(body))stream.next(copy(body));
        stream.complete();
      }catch(error){this.retryAfter.set(id,this.now()+30000);if(cached)stream.complete();else stream.error(error);}
    }catch(error){stream.error(error);}
    finally{if(this.pending.get(pendingId)===stream)this.pending.delete(pendingId);}
  }
}
