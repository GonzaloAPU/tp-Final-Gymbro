/** Planificación y entrega de avisos con Capacitor/Audio/HTTP simulados. No programa alarmas reales. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {of}=require('rxjs');
let now=new Date(2026,9,20,12,0,0).getTime(),native=true,user='user-a',audioNotes=0,requests=0;
const cache=new Map(),pending=new Map(),listeners=new Map(),scheduled=[],canceled=[];
const plan=[{id:'routine',days:[{id:'day',name:'Piernas',schedule:[{weekday:1,start:'00:05',end:'01:00'}]}]}];
const auth={user:()=>user?{id:user}:null,token:'token'},endpoint={native:true,server:()=> 'https://api.test'};
const nativeAPI={
  getPending:async()=>({notifications:[...pending.values()]}),checkPermissions:async()=>({display:'granted'}),checkExactNotificationSetting:async()=>({exact_alarm:'granted'}),
  requestPermissions:async()=>({display:'granted'}),changeExactNotificationSetting:async()=>{},createChannel:async()=>{},
  addListener:async(name,callback)=>{listeners.set(name,callback);return {remove:async()=>{}};},
  cancel:async({notifications})=>{canceled.push(...notifications);notifications.forEach(({id})=>pending.delete(id));},
  schedule:async({notifications})=>{scheduled.push(...notifications);notifications.forEach(notification=>pending.set(notification.id,notification));return {notifications:notifications.map(({id})=>({id}))};},
};
const http={get:()=>{requests++;return of(plan);}};
const signal=initial=>{let value=initial;const get=()=>value;get.set=next=>{value=next;};return get;};
const modules=new Map();
function load(file){
  file=path.resolve(file);if(modules.has(file))return modules.get(file);
  const exports={};modules.set(file,exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,{
    exports,require:name=>{
      if(name==='@angular/core')return {Injectable:()=>target=>target,signal,computed:fn=>fn,effect:()=>{},untracked:fn=>fn(),inject:token=>token==='auth'?auth:token==='endpoint'?endpoint:http};
      if(name==='@angular/common/http')return {HttpClient:'http'};
      if(name==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'}};
      if(name==='@capacitor/app')return {App:{addListener:async()=>({remove:async()=>{}})}};
      if(name==='@capacitor/local-notifications')return {LocalNotifications:nativeAPI};
      if(name.includes('auth.service'))return {AuthService:'auth'};
      if(name.includes('api-endpoint.service'))return {ApiEndpointService:'endpoint'};
      if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
      return require(name);
    },window:{location:{origin:'https://app.test'},setInterval:()=>1,clearInterval(){}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},
    localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)},
    Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},
    AudioContext:class {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}close(){return Promise.resolve();}createOscillator(){return {frequency:{value:0},connect(){},start(){audioNotes++;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}},
  });return exports;
}
const {reminderTime,nextReminder,alarmId,planReminders}=load('frontend/src/app/services/alarm-planning.ts');
assert.equal(reminderTime({weekday:1,start:'00:05'}).weekday,0);
assert.equal(reminderTime({weekday:0,start:'00:00'}).weekday,6);
assert.equal(reminderTime({weekday:2,start:'18:30'}).minute,15);
assert.equal(reminderTime({weekday:0,start:'00:00'}).hour,23);
assert.equal(reminderTime({weekday:0,start:'00:00'}).minute,45);
const next=nextReminder({weekday:2,hour:11,minute:45},new Date(now));
assert.equal(next.getDate(),new Date(now).getDate()+7,'Si el aviso de hoy ya pasó, el siguiente es la semana siguiente');
assert.equal(planReminders(plan).length,1);
assert.equal(alarmId('key'),alarmId('key'));assert.ok(alarmId('key')>0&&alarmId('key')<2147483647);
const {AlarmService}=load('frontend/src/app/services/alarm.service.ts');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  let alarms=new AlarmService();await alarms.switchOwner('https://api.test:user-a');await settle();await alarms.chain;
  const reminder=[...pending.values()].find(item=>item.extra.kind==='reminder');assert.ok(reminder);
  assert.equal(reminder.schedule.on.weekday,1,'Domingo nativo=1 para el aviso del lunes de madrugada');assert.equal(reminder.schedule.on.hour,23);assert.equal(reminder.schedule.on.minute,50);
  const timer={key:'series-1',kind:'work',name:'Sentadilla',deadline:now+45000};
  alarms.trackTimer(timer);await settle();await alarms.chain;
  assert.ok([...pending.values()].some(item=>item.extra.key==='series-1'));
  const before=scheduled.length;alarms.trackTimer({...timer});await settle();await alarms.chain;assert.equal(scheduled.length,before,'No duplica una alarma sin cambios');
  alarms.trackTimer(null);await settle();await alarms.chain;assert.ok(![...pending.values()].some(item=>item.extra.key==='series-1'),'Pausa cancela la alarma pendiente');
  alarms.trackTimer({...timer,deadline:now+30000});await settle();await alarms.chain;
  assert.equal([...pending.values()].find(item=>item.extra.key==='series-1').schedule.at.getTime(),now+30000);
  // Reabrir en Inicio conserva el temporizador nativo aunque todavía no se visite Entrenar.
  alarms.ngOnDestroy();alarms=new AlarmService();await alarms.switchOwner('https://api.test:user-a');await settle();await alarms.chain;
  assert.ok([...pending.values()].some(item=>item.extra.key==='series-1'));
  alarms.setEnabled('work',false);await settle();await alarms.chain;assert.ok(![...pending.values()].some(item=>item.extra.key==='series-1'));
  alarms.setEnabled('reminder',false);await settle();await alarms.chain;assert.ok(![...pending.values()].some(item=>item.extra.kind==='reminder'));
  alarms.setEnabled('reminder',true);await settle();await alarms.chain;
  assert.ok([...pending.values()].some(item=>item.extra.kind==='reminder'));
  alarms.updatePlan([]);await settle();await alarms.chain;assert.ok(![...pending.values()].some(item=>item.extra.kind==='reminder'),'Quitar horarios cancela el recordatorio');
  await alarms.switchOwner(null);await settle();await alarms.chain;assert.equal(pending.size,0,'Cerrar sesión cancela los avisos de la cuenta');alarms.ngOnDestroy();
  native=false;pending.clear();alarms=new AlarmService();await alarms.switchOwner('https://api.test:user-a');await settle();
  alarms.unlockAudio();alarms.trackTimer({key:'rest-1',kind:'rest',name:'Sentadilla',deadline:now+1000});now+=1000;
  alarms.timerExpired('rest-1');assert.equal(audioNotes,2);alarms.timerExpired('rest-1');assert.equal(audioNotes,2,'No repite un aviso vencido');
  alarms.setEnabled('work',true);alarms.trackTimer({key:'work-2',kind:'work',name:'Remo',deadline:now+1000});now+=1000;alarms.timerExpired('work-2');assert.equal(audioNotes,5,'Serie y descanso tienen sonidos distintos');
  alarms.trackTimer({key:'rest-paused',kind:'rest',name:'Remo',deadline:now+1000});alarms.trackTimer(null);now+=1000;alarms.checkWeb();assert.equal(audioNotes,5,'Pausa web no deja alarmas fantasma');
  alarms.ngOnDestroy();
  console.log('OK: 15 minutos antes, cruce de semana, IDs, permisos simulados, pausa/reanudación, recuperación nativa, eliminación de horarios, cierre de cuenta y sonido único por fase.');
})().catch(error=>{console.error(error);process.exitCode=1;});
