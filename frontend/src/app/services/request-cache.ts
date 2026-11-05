/** Caché de lectura en memoria: no reemplaza la cola offline ni persiste credenciales. */
import {Observable,defer,finalize,map,of,shareReplay,tap} from 'rxjs';
export function readPolicy(path:string):{group:string;ttl:number}|null {
  const policies:Record<string,{group:string;ttl:number}>={
    '/api/auth/me':{group:'profile',ttl:60000},
    '/api/routines':{group:'routines',ttl:60000},
    '/api/exercises':{group:'catalog',ttl:300000},
    '/api/progress/summary':{group:'progress',ttl:30000},
    '/api/progress/leaderboard':{group:'progress',ttl:15000},
    '/api/legal/status':{group:'legal',ttl:30000},
    '/api/welcome/status':{group:'welcome',ttl:60000},
  };
  return policies[path]||null;
}
export function mutationGroups(path:string):string[]{
  if(/^\/api\/auth\/(login|register)$/.test(path))return ['profile','routines','catalog','progress','legal','welcome'];
  if(path==='/api/auth/me')return ['profile','routines'];
  if(path.startsWith('/api/routines'))return ['routines','welcome'];
  if(path.startsWith('/api/exercises'))return ['catalog','routines'];
  if(path.startsWith('/api/progress'))return ['progress','profile'];
  if(path.startsWith('/api/sessions'))return ['progress'];
  if(path.startsWith('/api/welcome'))return ['welcome','routines','profile','progress'];
  if(path.startsWith('/api/legal'))return ['legal','profile','progress'];
  return [];
}
export class RequestCache {
  private scope='';private revision=0;
  private readonly entries=new Map<string,{group:string;expires:number;value:unknown}>();
  private readonly pending=new Map<string,{group:string;stream:Observable<unknown>}>();
  constructor(private readonly now=()=>Date.now()){}
  setScope(scope:string){if(scope!==this.scope){this.scope=scope;this.entries.clear();this.pending.clear();this.revision++;}}
  invalidate(groups:string[]){
    if(!groups.length)return;
    this.revision++;
    for(const [key,entry]of this.entries)if(groups.includes(entry.group))this.entries.delete(key);
    for(const [key,entry]of this.pending)if(groups.includes(entry.group))this.pending.delete(key);
  }
  read<T>(key:string,policy:{group:string;ttl:number},load:()=>Observable<T>,clone:(value:T)=>T):Observable<T>{
    const cached=this.entries.get(key);
    if(cached&&cached.expires>this.now())return of(clone(cached.value as T));
    if(cached)this.entries.delete(key);
    const existing=this.pending.get(key);
    if(existing)return (existing.stream as Observable<T>).pipe(map(clone));
    const revision=this.revision,scope=this.scope;
    const stream=defer(load).pipe(tap(value=>{
      // Una respuesta anterior a una edición o cambio de cuenta nunca rellena la caché nueva.
      if(revision===this.revision&&scope===this.scope){
        if(this.entries.size>=100)this.entries.delete(this.entries.keys().next().value!);
        this.entries.set(key,{group:policy.group,expires:this.now()+policy.ttl,value:clone(value)});
      }
    }),finalize(()=>{if(this.pending.get(key)?.stream===stream)this.pending.delete(key);}),shareReplay({bufferSize:1,refCount:true}));
    this.pending.set(key,{group:policy.group,stream});
    return stream.pipe(map(clone));
  }
}
