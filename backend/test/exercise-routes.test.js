/** Catálogo y creación privada con consultas simuladas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Op} from 'sequelize';
import {Exercise} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';
const valid={name:'Remo de prueba',muscleGroup:'Espalda',equipment:'Polea',trainingType:'POWER'};
async function fixture(t) {
  const state={duplicate:null,created:[],queries:[],failure:null};
  t.mock.method(sequelize,'transaction',async callback=>callback({}));
  t.mock.method(sequelize,'query',async()=>[]);
  t.mock.method(Exercise,'findOne',async()=>state.duplicate);
  t.mock.method(Exercise,'findAll',async options=>{state.queries.push(options);return [];});
  t.mock.method(Exercise,'create',async input=>{if(state.failure)throw state.failure;state.created.push(input);return {id:'new',...input};});
  return {state,request:await httpClient(t)};
}
test('catálogo: la consulta siempre limita resultados a oficiales y propios',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises')).status,200);
  assert.deepEqual(state.queries[0].where[Op.or],[{createdByUserId:null},{createdByUserId:'owner'}]);
});
test('catálogo: filtrar por tipo conserva el límite de propietario',async t=>{
  const {request,state}=await fixture(t);await request('/exercises?trainingType=AEROBIC');
  assert.equal(state.queries[0].where.trainingType,'AEROBIC');assert.ok(state.queries[0].where[Op.or]);
});
test('catálogo: permite filtrar por grupo muscular',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises?muscleGroup=Pecho')).status,200);assert.equal(state.queries[0].where.muscleGroup,'Pecho');
});
test('catálogo: un filtro de tipo inválido no consulta los modelos',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises?trainingType=INVALID')).status,400);assert.equal(state.queries.length,0);
});
test('ejercicios: ignora un propietario falsificado enviado en el cuerpo',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises','POST',{...valid,createdByUserId:'other',visibility:'OFFICIAL'})).status,201);
  assert.equal(state.created[0].createdByUserId,'owner');assert.equal(state.created[0].visibility,undefined);
});
test('ejercicios: un nombre oficial existente no se vuelve a insertar',async t=>{
  const {request,state}=await fixture(t);state.duplicate={id:'official',createdByUserId:null};assert.equal((await request('/exercises','POST',valid)).status,409);assert.equal(state.created.length,0);
});
test('ejercicios: un nombre privado propio existente no se vuelve a insertar',async t=>{
  const {request,state}=await fixture(t);state.duplicate={id:'own',createdByUserId:'owner'};assert.equal((await request('/exercises','POST',valid)).status,409);assert.equal(state.created.length,0);
});
test('ejercicios: rechaza crear sin autenticación antes de escribir',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises','POST',valid,null)).status,401);assert.equal(state.created.length,0);
});
test('ejercicios: rechaza equipamiento vacío',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/exercises','POST',{...valid,equipment:'  '})).status,400);assert.equal(state.created.length,0);
});
test('ejercicios: una falla al guardar no devuelve una creación exitosa',async t=>{
  const {request,state}=await fixture(t);state.failure=new Error('Fallo simulado');assert.equal((await request('/exercises','POST',valid)).status,500);assert.equal(state.created.length,0);
});
