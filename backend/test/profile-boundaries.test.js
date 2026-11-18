/** Validación y casos límite del perfil normalizado, sin datos reales. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {User,UserRestDay,BodyWeightHistory,RoutineSchedule} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';
async function fixture(t) {
  const state={missing:false,weights:[],updates:[]};
  const transaction={LOCK:{UPDATE:'UPDATE'}};
  const user={id:'owner',toJSON:()=>({id:'owner',name:'Ana'}),update:async input=>state.updates.push(input)};
  t.mock.method(sequelize,'transaction',async callback=>callback(transaction));
  t.mock.method(User,'findByPk',async()=>state.missing?null:user);
  t.mock.method(UserRestDay,'findAll',async()=>[]);
  t.mock.method(RoutineSchedule,'count',async()=>0);
  t.mock.method(BodyWeightHistory,'findOne',async()=>state.weights.at(-1)||null);
  t.mock.method(BodyWeightHistory,'create',async input=>{state.weights.push(input);return input;});
  return {state,request:await httpClient(t)};
}
test('perfil: una edición sin token no escribe datos',async t=>{const {state,request}=await fixture(t);assert.equal((await request('/auth/me','PATCH',{name:'Cambio'},null)).status,401);assert.equal(state.updates.length,0);});
test('perfil: rechaza descansos duplicados antes de guardar',async t=>{const {state,request}=await fixture(t);assert.equal((await request('/auth/me','PATCH',{restDays:[2,2]})).status,400);assert.equal(state.updates.length,0);});
test('perfil: rechaza un día de descanso fuera de rango',async t=>{const {state,request}=await fixture(t);assert.equal((await request('/auth/me','PATCH',{restDays:[-1]})).status,400);assert.equal(state.updates.length,0);});
test('perfil: rechaza un día de descanso fraccionario',async t=>{const {state,request}=await fixture(t);assert.equal((await request('/auth/me','PATCH',{restDays:[2.5]})).status,400);assert.equal(state.updates.length,0);});
test('perfil: editar un usuario inexistente devuelve 404',async t=>{const {state,request}=await fixture(t);state.missing=true;assert.equal((await request('/auth/me','PATCH',{name:'Ana'})).status,404);assert.equal(state.updates.length,0);});
test('perfil: la primera medición crea el historial y el peso de respuesta',async t=>{const {state,request}=await fixture(t);const result=await request('/auth/me','PATCH',{currentKg:68.5});assert.equal(result.status,200);assert.equal(state.weights.length,1);assert.equal(state.weights[0].userId,'owner');assert.equal(result.data.currentKg,68.5);});
test('perfil: un peso nulo no elimina el historial existente',async t=>{const {state,request}=await fixture(t);state.weights.push({weightKg:69});const result=await request('/auth/me','PATCH',{currentKg:null});assert.equal(result.status,200);assert.equal(result.data.currentKg,69);assert.equal(state.weights.length,1);});
test('perfil: un peso negativo se rechaza antes de escribir',async t=>{const {state,request}=await fixture(t);assert.equal((await request('/auth/me','PATCH',{currentKg:-5})).status,400);assert.equal(state.updates.length,0);assert.equal(state.weights.length,0);});
