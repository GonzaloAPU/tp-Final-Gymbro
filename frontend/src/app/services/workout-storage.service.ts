/** Respaldo local y cola de salida por usuario/servidor. Nunca guarda contraseñas ni tokens. */
import {Injectable,OnDestroy,effect,inject,signal,untracked} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {defer,firstValueFrom,from,timeout,tap} from 'rxjs';
import {AuthService} from './auth.service';
import {ApiEndpointService} from './api-endpoint.service';

export interface WorkoutCommand {
  id:string;
  sessionId:string;
  kind:'START'|'EXERCISE'|'SET'|'REPLACE'|'FINISH';
  performedId?:string;
  recordKey?:string;
  body:Record<string,unknown>;
}
interface Bundle {version:1;revision:number;state:unknown;queue:WorkoutCommand[];journal?:WorkoutCommand[];}

@Injectable({providedIn:'root'})
export class WorkoutStorageService implements OnDestroy {
  private readonly http=inject(HttpClient);
  private readonly auth=inject(AuthService);
  private readonly endpoint=inject(ApiEndpointService);
  readonly pending=signal(0);
  private readonly pendingKeys=signal(new Set<string>());
  readonly syncing=signal(false);
  readonly syncError=signal('');
  readonly actionRequired=signal(false);
  readonly storageError=signal('');
  private activeSync=false;
  private readonly delivered=new Map<string,Set<string>>();
  private readonly blocked=new Set<string>();
  private readonly fallbackLocks=new Map<string,Promise<unknown>>();
  private readonly retry=()=>{void this.flush();};
  private readonly timer=window.setInterval(this.retry,15000);
  constructor() {
    effect(() => {
      const scope = this.scope();
      untracked(() => {
        this.syncError.set(''); this.actionRequired.set(false); this.pending.set(0); this.pendingKeys.set(new Set());
        if (scope) {
          try { this.updateStatus(scope, this.read(scope)); }
          catch { /* Conserva el respaldo dañado para recuperación manual. */ }
          void this.flush();
        }
      });
    });
    window.addEventListener('online', this.retry);
  }

  scope():string|null {
    const user=this.auth.user();
    if(!user||!this.auth.token) return null;
    const server=this.endpoint.native?this.endpoint.server():window.location.origin;
    return `gymbro.workout.v1:${encodeURIComponent(server)}:${user.id}`;
  }
  private read(scope:string):Bundle {
    try {
      const text=localStorage.getItem(scope);
      if(!text) return {version:1,revision:0,state:null,queue:[]};
      const data=JSON.parse(text);
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalid=(item:WorkoutCommand)=>!item||!uuid.test(item.id)||!uuid.test(item.sessionId)||!['START','EXERCISE','SET','REPLACE','FINISH'].includes(item.kind)||!item.body||typeof item.body!=='object'||Array.isArray(item.body)||(['SET','REPLACE'].includes(item.kind)&&!uuid.test(item.performedId||''));
      if(data.journal!==undefined&&(!Array.isArray(data.journal)||data.journal.some(invalid)))throw Error('Diario inválido');
      if(data.version!==1||!Number.isInteger(data.revision)||!Array.isArray(data.queue)||data.queue.length>10000||data.queue.some(invalid)) throw Error('Formato desconocido');
      return data;
    } catch {
      this.blocked.add(scope);
      this.storageError.set('No pudimos leer el respaldo local. No lo sobrescribimos para evitar perderlo.');
      throw Error(this.storageError());
    }
  }
  private write(scope:string,bundle:Bundle):void {
    if(this.blocked.has(scope)) throw Error('El respaldo local necesita revisión.');
    try {
      localStorage.setItem(scope,JSON.stringify({...bundle,revision:bundle.revision+1}));
      this.storageError.set('');
      this.updateStatus(scope,bundle);
    } catch(error) {
      this.storageError.set('No pudimos guardar en este dispositivo. Revisá el espacio disponible antes de continuar.');
      throw error;
    }
  }
  /** Web Locks evita que dos pestañas eliminen o pisen operaciones de la misma cola. */
  private lock<T>(name:string,callback:()=>T|Promise<T>):Promise<T> {
    if(navigator.locks) return navigator.locks.request(name,callback);
    const result=(this.fallbackLocks.get(name)||Promise.resolve()).then(callback,callback);
    this.fallbackLocks.set(name,result.catch(()=>undefined));
    return result;
  }
  loadState(scope:string):unknown {
    const text=localStorage.getItem(scope+':state');
    if(!text)return null;
    try {const envelope=JSON.parse(text);if(envelope.version!==1||!Array.isArray(envelope.applied))throw Error();return envelope.state;}
    catch {this.rejectState(scope);throw Error(this.storageError());}
  }
  rejectState(scope:string):void {this.blocked.add(scope);this.storageError.set('El respaldo local no tiene un formato válido. Se conserva para revisarlo.');}
  recoveryCommands(scope:string):WorkoutCommand[] {
    const text=localStorage.getItem(scope+':state');
    const applied=new Set<string>(text?JSON.parse(text).applied:[]);
    return (this.read(scope).journal||[]).filter(command=>!applied.has(command.id));
  }
  saveState(scope:string,state:unknown):void {
    // La escritura síncrona permite guardar también durante pagehide. Siempre conserva la cola más reciente.
    if(this.scope()!==scope) return;
    if(this.blocked.has(scope))throw Error(this.storageError());
    try {
      const previous=localStorage.getItem(scope+':state');
      const relevant=new Set((this.read(scope).journal||[]).map(item=>item.id));
      const applied=new Set<string>((previous?JSON.parse(previous).applied:[]).filter((id:string)=>relevant.has(id)));
      for(const id of this.delivered.get(scope)||[])if(relevant.has(id))applied.add(id);
      const text=JSON.stringify({version:1,state,applied:[...applied]});
      if(text!==previous)localStorage.setItem(scope+':state',text);
      this.storageError.set('');
      // El diario protege un cierre entre encolar y actualizar la interfaz. Se limpia después del checkpoint.
      void this.lock('workout-state:'+scope,()=>{
        const bundle=this.read(scope);
        const journal=(bundle.journal||[]).filter(command=>!applied.has(command.id));
        if(journal.length!==(bundle.journal||[]).length)this.write(scope,{...bundle,journal});
        for(const id of applied)this.delivered.get(scope)?.delete(id);
      }).catch(()=>{});
    }catch(error){this.storageError.set('No pudimos guardar el respaldo local. Revisá el espacio disponible.');throw error;}
  }
  acknowledgeRecovery(scope:string,ids:string[]):void {const known=this.delivered.get(scope)||new Set<string>();ids.forEach(id=>known.add(id));this.delivered.set(scope,known);}

  private updateStatus(scope:string,bundle:Bundle):void {
    if(this.scope()!==scope)return;
    this.pending.set(bundle.queue.length);
    this.pendingKeys.set(new Set(bundle.queue.flatMap(command=>command.recordKey?[command.recordKey]:[])));
  }
  isPending(key:string):boolean {return this.pendingKeys().has(key);}
  /** Primero escribe en disco; solo después confirma la acción a la interfaz y comienza el envío. */
  enqueue<T>(command:WorkoutCommand,result:T) {
    return defer(()=>{
      const scope=this.scope();
      if(!scope) throw Error('Iniciá sesión para guardar tu entrenamiento.');
      return from(this.lock(`workout-state:${scope}`,()=>{
        if(this.scope()!==scope) throw Error('La cuenta cambió antes de guardar.');
        const bundle=this.read(scope);
        this.write(scope,{...bundle,queue:[...bundle.queue,command],journal:[...(bundle.journal||[]),command]});
        queueMicrotask(()=>{void this.flush();});
        return result;
      })).pipe(tap(()=>this.acknowledgeRecovery(scope,[command.id])));
    });
  }
  /** Procesa en orden. Una respuesta perdida conserva el mismo operationId para el reintento. */
  async flush():Promise<void> {
    const scope=this.scope();
    if(!scope||this.activeSync||navigator.onLine===false) return;
    this.activeSync=true;this.syncing.set(true);
    try {
      await this.lock(`workout-sync:${scope}`,async()=>{
        while(this.scope()===scope) {
          const command=this.read(scope).queue[0];if(!command)break;
          const path=command.kind==='START'?'/api/sessions':command.kind==='EXERCISE'?`/api/sessions/${command.sessionId}/exercises`:command.kind==='FINISH'?`/api/sessions/${command.sessionId}/finish`:`/api/sessions/${command.sessionId}/exercises/${command.performedId}/sets${command.kind==='REPLACE'?'/'+command.body['setNumber']:''}`;
          await firstValueFrom(this.http.request(command.kind==='REPLACE'?'PUT':'POST',path,{body:{...command.body,operationId:command.id}}).pipe(timeout(75000)));
          if(this.scope()!==scope)break;
          await this.lock(`workout-state:${scope}`,()=>{
            const latest=this.read(scope);
            this.write(scope,{...latest,queue:latest.queue.filter(item=>item.id!==command.id)});
          });
          this.syncError.set('');
          this.actionRequired.set(false);
        }
      });
    } catch(error:any) {
      if(this.scope()===scope)this.actionRequired.set(error?.status>=400&&error?.status<500&&![408,429].includes(error.status));
      if(this.scope()===scope) this.syncError.set(error?.status===401?'Tu sesión de acceso venció. Volvé a ingresar con esta cuenta para sincronizar.':error?.status>=400&&error?.status<500&&![408,429].includes(error.status)?`El servidor rechazó un cambio: ${error.error?.message||'revisá los datos'}. El respaldo local se conserva.`:'Sin conexión con el servidor. Los cambios siguen guardados en este dispositivo.');
    } finally {
      this.activeSync=false;this.syncing.set(false);
    }
  }
  ngOnDestroy():void {window.clearInterval(this.timer);window.removeEventListener('online',this.retry);}
}
