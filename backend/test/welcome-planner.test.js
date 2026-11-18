/** Planes locales y respuestas de Gemini: lógica real, sin llamar al proveedor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {exerciseData} from '../src/data/exercise-catalog.js';
import {welcomeSchema,makeLocalPlan,allowedCatalog,scheduleSessions,validateAIPlan,estimateMinutes} from '../src/services/welcome-planner.js';
import {generateGeminiPlan} from '../src/services/gemini-plan.js';
const catalog=exerciseData.map(e=>({...e,id:randomUUID(),createdByUserId:null}));
const input=(changes={})=>welcomeSchema.parse({age:30,heightCm:170,weightKg:70,goal:'GENERAL',experience:'BEGINNER',place:'HOME',equipment:[],sessions:3,minutes:45,availability:[1,3,5].map(weekday=>({weekday,start:'18:00',end:'20:00'})),hasRestrictions:false,mode:'LOCAL',...changes});
const aiShape=plan=>({sessions:plan.sessions.map(({exercises})=>({exercises}))});
for(const [label,changes]of [
  ['menor de edad',{age:17}],['edad fraccionaria',{age:30.5}],['peso no finito',{weightKg:Infinity}],
  ['objetivo clínico',{goal:'PHYSIOTHERAPY'}],['equipamiento desconocido',{equipment:['MAGIC']}],
  ['nombre personal no permitido',{name:'No enviar'}],['días duplicados',{availability:[1,1,3].map(weekday=>({weekday,start:'18:00',end:'19:00'}))}],
  ['menos días que sesiones',{sessions:4}],['ventana muy corta',{minutes:90,availability:[1,3,5].map(weekday=>({weekday,start:'18:00',end:'18:30'}))}],
  ['rango nocturno invertido',{availability:[1,3,5].map(weekday=>({weekday,start:'23:00',end:'01:00'}))}],
])test(`bienvenida: rechaza ${label}`,()=>assert.throws(()=>input(changes)));
test('bienvenida: genera plan sin claves, con horarios y descanso complementario',()=>{
  const plan=makeLocalPlan(input(),catalog);assert.equal(plan.source,'LOCAL');assert.equal(plan.sessions.length,3);
  assert.deepEqual(plan.sessions.map(s=>s.slot.weekday),[1,3,5]);assert.deepEqual(plan.restDays,[0,2,4,6]);
  assert.ok(plan.sessions.every(s=>estimateMinutes(s.exercises)<=45&&s.exercises.every(e=>e.targetSets===3)));
});
test('bienvenida: casa sin equipo solo usa ejercicios de peso corporal',()=>{
  assert.ok(allowedCatalog(input(),catalog).every(e=>['Peso corporal','Colchoneta','Pared'].includes(e.equipment)));
});
test('bienvenida: press de banco requiere banco además de mancuernas',()=>{
  assert.ok(!allowedCatalog(input({equipment:['DUMBBELLS']}),catalog).some(e=>e.name==='Press banca con mancuernas'));
  assert.ok(allowedCatalog(input({equipment:['DUMBBELLS','BENCH']}),catalog).some(e=>e.name==='Press banca con mancuernas'));
});
test('bienvenida: nunca incluye ejercicios privados aunque tengan el mismo nombre',()=>{
  assert.equal(allowedCatalog(input(),catalog.map(e=>({...e,createdByUserId:'other'}))).length,0);
});
test('bienvenida: dolor o restricciones impiden generación automática',()=>assert.throws(()=>makeLocalPlan(input({hasRestrictions:true}),catalog),{status:422}));
test('bienvenida: domingo y lunes consecutivos alternan grupos sin exigir descanso',()=>{
  const data=input({sessions:2,availability:[0,1].map(weekday=>({weekday,start:'18:00',end:'19:00'}))});
  const plan=makeLocalPlan(data,catalog);
  assert.equal(plan.sessions.length,2);
  assert.match(plan.sessions[0].name,/superior/);assert.match(plan.sessions[1].name,/inferior/);
  assert.doesNotThrow(()=>validateAIPlan(aiShape(plan),data,catalog,plan));
});

for(const count of [3,4,5,6,7])test(`bienvenida: ${count} días consecutivos generan un plan válido`,()=>{
  const data=input({sessions:count,availability:[1,2,3,4,5,6,0].slice(0,count).map(weekday=>({weekday,start:'18:00',end:'19:00'}))});
  const plan=makeLocalPlan(data,catalog);
  assert.equal(plan.sessions.length,count);assert.equal(plan.restDays.length,7-count);
  assert.doesNotThrow(()=>validateAIPlan(aiShape(plan),data,catalog,plan));
});
test('bienvenida: cuatro sesiones alternan tren superior e inferior',()=>{
  const data=input({sessions:4,availability:[1,2,4,5].map(weekday=>({weekday,start:'18:00',end:'19:00'}))});
  const plan=makeLocalPlan(data,catalog);assert.ok(plan.sessions[0].name.includes('superior'));assert.ok(plan.sessions[1].name.includes('inferior'));
  assert.doesNotThrow(()=>validateAIPlan(aiShape(plan),data,catalog,plan));
});
test('bienvenida: mueve el inicio dentro de la ventana para no pisar una reserva',()=>{
  const slots=scheduleSessions(input(),[{weekday:1,start:'18:00',end:'18:30'}]);assert.equal(slots[0].start,'18:30');assert.equal(slots[0].end,'19:15');
});
test('bienvenida: no ofrece un cuarto bloque en un día ocupado',()=>{
  assert.throws(()=>scheduleSessions(input(),[1,2,3].map(i=>({weekday:1,start:`0${i}:00`,end:`0${i}:30`}))),{status:422});
});
test('bienvenida: conserva el mínimo solicitado de tres series',()=>{
  const plan=makeLocalPlan(input({age:65,experience:'INTERMEDIATE'}),catalog);assert.ok(plan.sessions.every(s=>s.exercises.every(e=>e.targetSets===3)));
});
test('bienvenida: no reduce series ni cambia el horario si 30 minutos no alcanzan',()=>{
  assert.throws(()=>makeLocalPlan(input({minutes:30}),catalog),/45 minutos/);
});

test('bienvenida: cuatro ejercicios de tres series caben en 45 minutos para fuerza',()=>{
  const data=input({minutes:45,goal:'STRENGTH',experience:'INTERMEDIATE'}),plan=makeLocalPlan(data,catalog);
  assert.ok(plan.sessions.every(session=>session.exercises.length===4&&session.exercises.every(e=>e.targetSets===3)&&estimateMinutes(session.exercises)<=45));
  assert.doesNotThrow(()=>validateAIPlan(aiShape(plan),data,catalog,plan));
});

test('bienvenida: rechaza una respuesta de Gemini con menos de cuatro ejercicios',()=>{
  const data=input(),plan=makeLocalPlan(data,catalog),raw=aiShape(structuredClone(plan));
  raw.sessions[0].exercises.pop();assert.throws(()=>validateAIPlan(raw,data,catalog,plan),{status:502});
});
test('bienvenida: catálogo incompleto no produce una rutina vacía',()=>assert.throws(()=>makeLocalPlan(input(),[]),{status:422}));
test('bienvenida: respuesta IA con ID inventado se rechaza',()=>{
  const data=input(),plan=makeLocalPlan(data,catalog),raw=aiShape(structuredClone(plan));raw.sessions[0].exercises[0].exerciseId=randomUUID();
  assert.throws(()=>validateAIPlan(raw,data,catalog,plan),{status:502});
});
test('bienvenida: respuesta IA con ejercicios repetidos se rechaza',()=>{
  const data=input(),plan=makeLocalPlan(data,catalog),raw=aiShape(structuredClone(plan));raw.sessions[0].exercises[1]=raw.sessions[0].exercises[0];
  assert.throws(()=>validateAIPlan(raw,data,catalog,plan),{status:502});
});
test('bienvenida: IA no puede ofrecer menos de tres series',()=>{
  const data=input(),plan=makeLocalPlan(data,catalog),raw=aiShape(structuredClone(plan));raw.sessions[0].exercises[0].targetSets=2;
  assert.throws(()=>validateAIPlan(raw,data,catalog,plan),{status:502});
});
test('bienvenida: IA no puede cambiar cantidad de sesiones',()=>{
  const data=input(),plan=makeLocalPlan(data,catalog),raw=aiShape(plan);raw.sessions.pop();assert.throws(()=>validateAIPlan(raw,data,catalog,plan),{status:502});
});
test('Gemini: sin configuración no llama a la red',async t=>{
  const old=process.env.GEMINI_ENABLED;process.env.GEMINI_ENABLED='false';t.after(()=>{if(old===undefined)delete process.env.GEMINI_ENABLED;else process.env.GEMINI_ENABLED=old;});
  const data=input(),plan=makeLocalPlan(data,catalog);await assert.rejects(generateGeminiPlan(data,catalog,plan,()=>assert.fail('No llamar proveedor')),{status:503});
});
test('Gemini: envía solo parámetros deportivos y valida la respuesta',async t=>{
  const old={key:process.env.GEMINI_API_KEY,enabled:process.env.GEMINI_ENABLED};process.env.GEMINI_API_KEY='fake-test-key';process.env.GEMINI_ENABLED='true';
  t.after(()=>{for(const [key,value]of [['GEMINI_API_KEY',old.key],['GEMINI_ENABLED',old.enabled]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
  const data=input({mode:'GEMINI',aiConsent:true}),plan=makeLocalPlan(data,catalog);
  const result=await generateGeminiPlan(data,catalog,plan,async(url,options)=>{
    assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));const body=JSON.parse(options.body);
    assert.ok(!body.contents[0].parts[0].text.includes('18:00'));assert.ok(!body.contents[0].parts[0].text.includes('fake-test-key'));
    const parameters=JSON.parse(body.contents[0].parts[0].text.split('Parámetros: ')[1].split('\nCatálogo: ')[0]);
    assert.deepEqual(Object.keys(parameters).sort(),['equipment','experience','goal','minutes','place','sessions']);
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(aiShape(plan))}]}}]})};
  });assert.equal(result.source,'GEMINI');assert.deepEqual(result.sessions.map(s=>s.slot),plan.sessions.map(s=>s.slot));
});
