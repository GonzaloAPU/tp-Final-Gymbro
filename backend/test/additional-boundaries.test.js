/** 25 regresiones de rutas: permisos, pesajes y progreso. No usa PostgreSQL real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {User,BodyWeightHistory,TrainingSession,StrengthRecord} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';

async function fixture(t) {
  const state={weights:[],missing:false};
  t.mock.method(sequelize,'transaction',async callback=>callback({LOCK:{UPDATE:'UPDATE'}}));
  t.mock.method(User,'findByPk',async id=>state.missing?null:{id});
  t.mock.method(BodyWeightHistory,'create',async input=>{state.weights.push(input);return input;});
  return {state,request:await httpClient(t)};
}
const invalidWeights=[
  ['cero',{weightKg:0}], ['más de 500 kg',{weightKg:500.01}],
  ['peso como texto',{weightKg:'70'}], ['peso nulo',{weightKg:null}],
  ['peso como objeto',{weightKg:{value:70}}], ['peso como lista',{weightKg:[70]}],
  ['fracción negativa',{weightKg:-0.1}], ['peso ausente',{}],
  ['fecha futura',{weightKg:70,recordedAt:'2999-01-01T00:00:00.000Z'}],
  ['fecha imposible de interpretar',{weightKg:70,recordedAt:'ayer'}],
];
for(const [label,body] of invalidWeights)test(`extra pesaje: rechaza ${label} sin escribir`,async t=>{
  const {state,request}=await fixture(t);
  assert.equal((await request('/progress/weight','POST',body)).status,400);
  assert.equal(state.weights.length,0);
});
for(const weightKg of [500,0.1])test(`extra pesaje: acepta el límite válido ${weightKg}`,async t=>{
  const {state,request}=await fixture(t);
  const result=await request('/progress/weight','POST',{weightKg});
  assert.equal(result.status,201);assert.equal(result.data.weightKg,weightKg);
  assert.equal(state.weights[0].userId,'owner');assert.ok(state.weights[0].recordedAt instanceof Date);
});
test('extra pesaje: conserva la fecha elegida sin sustituirla por hoy',async t=>{
  const {request}=await fixture(t),recordedAt='2020-02-29T23:59:00.000Z';
  const result=await request('/progress/weight','POST',{weightKg:72.3,recordedAt});
  assert.equal(result.status,201);assert.equal(result.data.recordedAt,recordedAt);
});
test('extra pesaje: usuario eliminado devuelve 404 sin crear mediciones',async t=>{
  const {state,request}=await fixture(t);state.missing=true;
  assert.equal((await request('/progress/weight','POST',{weightKg:70})).status,404);
  assert.equal(state.weights.length,0);
});
test('extra pesaje: ausencia de JWT no llega a escribir una medición',async t=>{
  const {state,request}=await fixture(t);
  assert.equal((await request('/progress/weight','POST',{weightKg:70},null)).status,401);
  assert.equal(state.weights.length,0);
});
for(const route of ['/progress/summary','/progress/leaderboard','/routines','/exercises','/sessions'])test(`extra permisos: ${route} exige sesión`,async t=>{
  const request=await httpClient(t);
  assert.equal((await request(route,'GET',undefined,null)).status,401);
});

async function summaryFixture(t,{weights=[],calories=null,count=0}={}) {
  const queries=[];
  for(const [model,method,result] of [
    [TrainingSession,'findAll',[]],[BodyWeightHistory,'findAll',weights],
    [StrengthRecord,'findAll',[]],[TrainingSession,'sum',calories],[TrainingSession,'count',count],
  ])t.mock.method(model,method,async(...args)=>{queries.push({method,options:args.at(-1)});return result;});
  t.mock.method(sequelize,'query',async(_sql,options)=>{queries.push({method:'query',options});return [];});
  return {queries,request:await httpClient(t)};
}
test('extra progreso: cuenta nueva devuelve listas vacías y totales cero',async t=>{
  const {request}=await summaryFixture(t);
  assert.deepEqual((await request('/progress/summary')).data,{sessions:[],weights:[],records:[],totalCalories:0,completedSessions:0});
});
test('extra progreso: todas las consultas del resumen se limitan al propietario',async t=>{
  const {request,queries}=await summaryFixture(t,{calories:'123.5',count:25});
  const result=await request('/progress/summary');assert.equal(result.status,200);
  assert.equal(result.data.totalCalories,123.5);assert.equal(result.data.completedSessions,25);
  assert.equal(queries.length,5);for(const query of queries)assert.equal(query.method==='query'?query.options.replacements.userId:query.options.where.userId,'owner');
  for(const query of queries.filter(q=>q.method==='sum'||q.method==='count'))assert.equal(query.options.where.status,'COMPLETED');
});
test('extra progreso: historial de peso se entrega cronológicamente',async t=>{
  const {request}=await summaryFixture(t,{weights:[{id:'recent'},{id:'middle'},{id:'old'}]});
  assert.deepEqual((await request('/progress/summary')).data.weights.map(w=>w.id),['old','middle','recent']);
});
test('extra ranking: convierte valores SQL y distingue la marca propia',async t=>{
  t.mock.method(sequelize,'query',async()=>[
    {category:'bench',userId:'owner',name:'Yo',exerciseName:'Press inclinado con mancuernas',weightKg:'80.50',repetitions:5,rank:'1'},
    {category:'bench',userId:'other',name:'Otra',weightKg:'70',repetitions:8,rank:'2'},
  ]);
  const request=await httpClient(t),result=await request('/progress/leaderboard');
  assert.equal(result.status,200);const users=result.data.exercises[0].users;
  assert.equal(users[0].weightKg,80.5);assert.equal(users[0].rank,1);assert.equal(users[0].exerciseName,'Press inclinado con mancuernas');
  assert.equal(users[0].isCurrentUser,true);assert.equal(users[1].isCurrentUser,false);
});
test('extra ranking: sin marcas conserva las tres categorías vacías',async t=>{
  t.mock.method(sequelize,'query',async()=>[]);
  const request=await httpClient(t),result=await request('/progress/leaderboard');
  assert.equal(result.status,200);
  assert.deepEqual(result.data.exercises.map(e=>e.key),['bench','squat','deadlift']);
  assert.ok(result.data.exercises.every(e=>e.users.length===0));
});
