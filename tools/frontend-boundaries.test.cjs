/** 25 casos nuevos sobre código real de la app, sin navegador, API ni notificaciones reales. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(relative) {
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
  }).outputText;
  vm.runInNewContext(source,{exports,URL,Date,require:name=>{
    if(name==='@angular/core')return {Injectable:()=>target=>target,signal:initial=>()=>initial};
    if(name==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>true}};
    throw Error(`Dependencia inesperada: ${name}`);
  }});return exports;
}
const {normalizeServer}=load('frontend/src/app/services/api-endpoint.service.ts');
const {reminderTime,nextReminder,planReminders,alarmId}=load('frontend/src/app/services/alarm-planning.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
for(const [label,input] of [
  ['dirección vacía',''],['javascript','javascript:alert(1)'],['FTP','ftp://example.com'],
  ['credenciales en URL','https://user:secret@example.com'],['ruta de API','https://example.com/api'],
  ['fragmento','https://example.com/#token'],['parámetro','https://example.com/?token=abc'],
])test(`extra conexión: rechaza ${label}`,()=>assert.throws(()=>normalizeServer(input)));
test('extra conexión: normaliza espacios, dominio y puerto HTTPS estándar',()=>assert.equal(normalizeServer(' HTTPS://EXAMPLE.COM:443/ '),'https://example.com'));
test('extra conexión: conserva IPv6 y puerto de desarrollo',()=>assert.equal(normalizeServer('http://[::1]:3000/'),'http://[::1]:3000'));

for(const [label,weekday,start,expected] of [
  ['domingo al sábado anterior',0,'00:10',{weekday:6,hour:23,minute:55}],
  ['lunes al domingo anterior',1,'00:14',{weekday:0,hour:23,minute:59}],
  ['quince minutos exactos',4,'00:15',{weekday:4,hour:0,minute:0}],
  ['descuento con cambio de hora',2,'12:00',{weekday:2,hour:11,minute:45}],
  ['última hora del sábado',6,'23:59',{weekday:6,hour:23,minute:44}],
  ['horario de tarde',5,'18:42',{weekday:5,hour:18,minute:27}],
])test(`extra recordatorio: ${label}`,()=>assert.deepEqual(plain(reminderTime({weekday,start})),expected));

test('extra próxima alarma: todavía pendiente hoy no salta de semana',()=>{
  const now=new Date(2026,9,21,10,0),result=nextReminder({weekday:3,hour:11,minute:30},now);
  assert.equal(result.getDate(),21);assert.equal(result.getHours(),11);assert.equal(result.getMinutes(),30);
});
test('extra próxima alarma: el instante exacto se considera próxima semana',()=>{
  const now=new Date(2026,9,21,11,30),result=nextReminder({weekday:3,hour:11,minute:30},now);
  assert.equal(result.getDate(),28);
});
test('extra próxima alarma: conserva fin de año al buscar el siguiente día',()=>{
  const result=nextReminder({weekday:5,hour:8,minute:0},new Date(2026,11,31,23,0));
  assert.equal(result.getFullYear(),2027);assert.equal(result.getMonth(),0);assert.equal(result.getDate(),1);
});
test('extra próxima alarma: elimina segundos y milisegundos heredados',()=>{
  const now=new Date(2026,9,21,10,0,37,450),result=nextReminder({weekday:4,hour:8,minute:20},now);
  assert.equal(result.getSeconds(),0);assert.equal(result.getMilliseconds(),0);
});
test('extra próxima alarma: no modifica la fecha de entrada',()=>{
  const now=new Date(2026,9,21,20,0),before=now.getTime();nextReminder({weekday:3,hour:8,minute:0},now);
  assert.equal(now.getTime(),before);
});

test('extra plan: biblioteca vacía no genera avisos',()=>assert.deepEqual(plain(planReminders([])),[]));
test('extra plan: días sin asignación no generan recordatorios',()=>assert.deepEqual(plain(planReminders([{days:[{id:'a',name:'A'},{id:'b',name:'B',schedule:[]}]}])),[]));
test('extra plan: misma rutina en varios días genera avisos independientes sin mutarla',()=>{
  const routines=[{days:[{id:'a',name:'Piernas',schedule:[{weekday:1,start:'08:00',end:'09:00'},{weekday:5,start:'18:00',end:'19:00'}]}]}];
  const before=JSON.stringify(routines),reminders=planReminders(routines);
  assert.equal(reminders.length,2);assert.notEqual(reminders[0].key,reminders[1].key);
  assert.equal(reminders[0].name,'Piernas');assert.equal(JSON.stringify(routines),before);
});
test('extra IDs: claves por cuenta y fase producen identificadores válidos y estables',()=>{
  const keys=['user-a:series-1','user-b:series-1','user-a:rest-1'];
  const ids=keys.map(alarmId);assert.equal(new Set(ids).size,3);
  keys.forEach((key,i)=>{assert.equal(alarmId(key),ids[i]);assert.ok(Number.isInteger(ids[i])&&ids[i]>0&&ids[i]<=2147483647);});
});
test('extra sonidos: los tres WAV tienen PCM válido y duración de tres segundos',()=>{
  for(const kind of ['series','rest','reminder']) {
    const data=fs.readFileSync(path.join(root,`tools/test-support/audio/gymbro_${kind}_3s.wav`));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');
    assert.equal(data.readUInt32LE(4),data.length-8);assert.equal(data.readUInt16LE(20),1);
    assert.equal(data.readUInt32LE(40),data.length-44);assert.equal(data.readUInt32LE(40)/data.readUInt32LE(28),3);
    assert.ok(data.subarray(44).some(byte=>byte!==0),'El aviso no debe estar vacío');
  }
});
