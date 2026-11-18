/** Recuperación y cola reales del frontend, con reloj, HTTP y almacenamiento simulados. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const {of,throwError,firstValueFrom,Subject,map}=require('rxjs');
let now=Date.UTC(2026,9,20,12),account='account-a',server='https://gymbro.test',quota=false,loseResponse=false;
const data=new Map(),timers=new Map(),events=new Map(),requests=[],receipts=new Map(),remoteSets=new Map();
let store,sessions,workout;
const auth={user:()=>account?{id:account}:null,get token(){return account?'token':null;}};
const endpoint={native:true,server:()=>server};
const browserNavigator={onLine:false}; // También prueba el fallback sin Web Locks.
const browserWindow={location:{origin:'https://app.test'},setInterval:(callback,period)=>{const id=randomUUID();timers.set(id,{callback,period});return id;},clearInterval:id=>timers.delete(id),addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:name=>events.delete(name)};
const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>{if(quota)throw Error('QuotaExceededError');data.set(key,value);}};
const exerciseId='11111111-1111-4111-8111-111111111111';
const routine={getAll:()=>of([{id:'routine',name:'Rutina',days:[{id:'22222222-2222-4222-8222-222222222222',name:'Prueba',schedule:[{weekday:new Date(now).getDay(),start:'08:00',end:'09:00'}],exercises:[{exercise:{id:exerciseId,name:'Press banca',muscleGroup:'Pecho'},targetSets:3,minReps:8,maxReps:12,restSeconds:90}]}]}])};
const http={request:(method,url,{body})=>{
  requests.push({method,url,body});
  const id=body.operationId;
  if(receipts.has(id))return of(receipts.get(id));
  const response={ok:true};receipts.set(id,response);
  if(url.includes('/sets'))remoteSets.set(url+':'+body.setNumber,body);
  if(loseResponse&&url.includes('/sets')){loseResponse=false;return throwError(()=>({status:0}));}
  return of(response);
}};
const signal=initial=>{let value=initial;const read=()=>value;read.set=next=>{value=next;};read.update=callback=>{value=callback(value);};return read;};
const modules=new Map();
function load(file){
  file=path.resolve(file);if(modules.has(file))return modules.get(file);
  const exports={};modules.set(file,exports);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{
    if(name.includes('alarm.service'))return {AlarmService:'alarms'};
    if(name==='@angular/core')return { ChangeDetectionStrategy:{Eager:1,OnPush:0},Component:()=>target=>target,Injectable:()=>target=>target,Input:()=>()=>{},HostListener:()=>()=>{},effect:()=>{},untracked:callback=>callback(),signal,inject:token=>{
      if(token==='alarms')return {trackTimer(){},timerExpired(){},unlockAudio(){}};if(token==='auth')return auth;if(token==='endpoint')return endpoint;if(token==='http')return http;if(token==='routine')return routine;
      if(token?.name==='WorkoutStorageService')return store;if(token?.name==='SessionService')return sessions;
      return {navigateByUrl(){}};
    }};
    if(name==='@angular/common/http')return {HttpClient:'http'};
    if(name==='@angular/router')return {Router:'router'};
    if(name.endsWith('/auth.service')||name==='./auth.service')return {AuthService:'auth'};
    if(name.endsWith('/api-endpoint.service')||name==='./api-endpoint.service')return {ApiEndpointService:'endpoint'};
    if(name.includes('routine.service'))return {RoutineService:'routine'};
    if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
    return require(name);
  },Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},crypto:{randomUUID},localStorage:storage,window:browserWindow,navigator:browserNavigator,queueMicrotask,setTimeout,clearTimeout});
  return exports;
}
const {WorkoutStorageService}=load('frontend/src/app/services/workout-storage.service.ts');
const {SessionService}=load('frontend/src/app/services/session.service.ts');
const {WorkoutComponent}=load('frontend/src/app/components/workout.component.ts');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const advance=milliseconds=>{now+=milliseconds;for(const {callback,period} of [...timers.values()])if(period===16)callback();};
function reopen(){if(workout)workout.ngOnDestroy();if(store)store.ngOnDestroy();store=new WorkoutStorageService();sessions=new SessionService();workout=new WorkoutComponent();workout.ngOnInit();return workout;}

(async()=>{
  reopen();workout.updateSetDraft(0,'weight','42.5');workout.startSeries(0);await settle();
  assert.equal(requests.length,0,'El entrenamiento puede iniciarse sin red');
  const sessionId=workout.sessionId();assert.ok(sessionId);assert.equal(workout.phase(),'work');
  advance(2500);workout.checkpoint();workout.ngOnDestroy();workout=null;advance(5000);reopen();
  assert.equal(workout.sessionId(),sessionId);assert.equal(workout.phase(),'work');assert.equal(workout.phaseMilliseconds(),7500);
  assert.equal(workout.setDraft(0).weight,'42.5');
  workout.toggleSeriesPause(0);workout.checkpoint();advance(5000);reopen();
  assert.equal(workout.seriesPaused(),true);assert.equal(workout.phaseMilliseconds(),7500,'La pausa de serie excluye el tiempo con app cerrada');
  workout.resumeSeries();advance(1000);workout.completeSet(0,'42.5','10');await settle();
  assert.equal(workout.completedSeries().length,1);assert.equal(workout.phase(),'rest');
  assert.equal(store.pending(),3,'Inicio, ejercicio y serie quedan durables');
  assert.equal(workout.recordPending(workout.completedSeries()[0]),true);
  workout.checkpoint();advance(95000);reopen();
  assert.equal(workout.phase(),'idle','Un descanso vencido termina al recuperar sin iniciar otra serie');
  assert.equal(workout.nextSetIndex(),1);assert.equal(workout.completedSeries().length,1);
  workout.stopTimer();workout.checkpoint();const pausedTotal=workout.elapsedMilliseconds();advance(5000);reopen();
  assert.equal(workout.running(),false);assert.equal(workout.elapsedMilliseconds(),pausedTotal);
  workout.ngOnDestroy();workout=null;store.ngOnDestroy();account='account-b';store=new WorkoutStorageService();sessions=new SessionService();workout=new WorkoutComponent();workout.ngOnInit();
  assert.equal(workout.sessionId(),null,'Otra cuenta no recupera datos ajenos');assert.equal(store.recoveryCommands(store.scope()).length,0);
  workout.ngOnDestroy();workout=null;store.ngOnDestroy();account='account-a';reopen();
  assert.equal(workout.sessionId(),sessionId);assert.equal(workout.completedSeries().length,1);
  browserNavigator.onLine=true;loseResponse=true;await store.flush();
  assert.equal(store.pending(),1);assert.equal(remoteSets.size,1,'El servidor pudo guardar aunque se pierda la respuesta');
  const lostId=requests.at(-1).body.operationId;await store.flush();
  assert.equal(requests.at(-1).body.operationId,lostId,'El reintento usa la identidad original');assert.equal(store.pending(),0);assert.equal(remoteSets.size,1);
  assert.equal(workout.recordPending(workout.completedSeries()[0]),false);
  // Una falta de espacio no se presenta como guardado exitoso.
  browserNavigator.onLine=false;quota=true;
  await assert.rejects(firstValueFrom(sessions.addSet(sessionId,'33333333-3333-4333-8333-333333333333',{setNumber:2,weightKg:40,repetitions:8})));
  quota=false;assert.equal(store.pending(),0);
  // Cambiar el servidor separa el respaldo, incluso con el mismo usuario.
  const scope=store.scope();server='https://other.test';assert.equal(store.loadState(store.scope()),null);server='https://gymbro.test';assert.equal(store.scope(),scope);
  workout.finishSession(true);await settle();assert.equal(workout.sessionFinished(),true);reopen();assert.equal(workout.sessionFinished(),true);
  browserNavigator.onLine=true;await store.flush();assert.equal(store.pending(),0);
  // Simula muerte del proceso entre escribir la cola y actualizar la tarjeta.
  browserNavigator.onLine=false;account='account-c';reopen();
  workout.pendingSeries=0;workout.checkpoint();
  const orphan=await firstValueFrom(sessions.start('22222222-2222-4222-8222-222222222222'));
  const performed=await firstValueFrom(sessions.addExercise(orphan.id,exerciseId,1));
  await firstValueFrom(sessions.addSet(orphan.id,performed.id,{setNumber:1,weightKg:55,repetitions:6,durationSeconds:12,actualRestSeconds:0}));
  store.ngOnDestroy();workout=null; // No se ejecuta pagehide ni ngOnDestroy en un proceso terminado abruptamente.
  advance(1000);reopen();await settle();
  assert.equal(workout.sessionId(),orphan.id);assert.equal(workout.completedSeries().length,1);
  assert.equal(workout.completedSeries()[0].weightKg,55);assert.equal(workout.phase(),'rest');
  reopen();await settle();assert.equal(workout.completedSeries().length,1,'El diario se aplica una sola vez');
  // Un grupo conserva el orden y la ronda si se cierra entre A y B.
  account='account-group';workout.ngOnDestroy();workout=null;store.ngOnDestroy();
  const originalGetAll=routine.getAll;
  routine.getAll=()=>originalGetAll().pipe(map(items=>{
    const copy=JSON.parse(JSON.stringify(items));
    const extra=JSON.parse(JSON.stringify(copy[0].days[0].exercises[0]));
    extra.exercise.id='44444444-4444-4444-8444-444444444444';extra.exercise.name='Remo';copy[0].days[0].exercises.push(extra);return copy;
  }));
  reopen();workout.toggleLinkedExercise(0);workout.toggleLinkedExercise(1);workout.startSeries(0);await settle();
  advance(1500);workout.completeSet(0,'30','8');await settle();
  assert.equal(workout.active(),1);assert.equal(workout.phase(),'idle');assert.equal(workout.chainRoundActive(),true);
  reopen();await settle();assert.equal(workout.active(),1);assert.equal(workout.chainRoundActive(),true);
  workout.startSeries(0);await settle();workout.completeSet(0,'35','8');await settle();assert.equal(workout.phase(),'rest');
  reopen();workout.endRest();assert.equal(workout.active(),0);assert.equal(workout.nextSetIndex(),1);
  routine.getAll=originalGetAll;
  // La cantidad editada pertenece al entrenamiento: sobrevive al cierre sin alterar el plan.
  account='account-extra-sets';reopen();
  workout.configureSets({value:'4'});reopen();
  assert.equal(workout.current().sets,4);
  assert.equal(workout.nextSetIndex(),0);
  assert.equal((await firstValueFrom(routine.getAll()))[0].days[0].exercises[0].targetSets,3);
  workout.startSeries(0);await settle();
  workout.visible=false;workout.ngOnChanges({visible:{currentValue:false,firstChange:false}});
  assert.ok([...timers.values()].some(timer=>timer.period===250));
  assert.ok(![...timers.values()].some(timer=>timer.period===16));
  advance(4321);
  workout.visible=true;workout.ngOnChanges({visible:{currentValue:true,firstChange:false}});
  assert.equal(workout.phaseMilliseconds(),4321,'Volver recupera los milisegundos aunque no hubo repintados ocultos');
  assert.ok([...timers.values()].some(timer=>timer.period===16));
  // Corrupción: se bloquea el respaldo y nunca se reemplaza silenciosamente.
  server='https://corrupt.test';const corruptScope=store.scope();data.set(corruptScope,'invalid JSON');
  await assert.rejects(firstValueFrom(sessions.finish(randomUUID(),10)));assert.equal(data.get(corruptScope),'invalid JSON');
  workout.ngOnDestroy();store.ngOnDestroy();
  console.log('OK: recuperación de relojes, pausas, series, descanso vencido, cuenta/servidor aislados, cola offline, respuesta perdida, cierre y errores de almacenamiento.');
})().catch(error=>{console.error(error);process.exitCode=1;});
