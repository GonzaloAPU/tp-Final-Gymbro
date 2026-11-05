/** Reintentos, cierre inmutable y confirmación posterior al commit, sin PostgreSQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {TrainingSession,PerformedExercise,PerformedSet,SessionMutation} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';

async function fixture(t) {
  const state={created:[],updates:0,finishUpdates:0,set:null,receipts:new Map(),commitFailure:false};
  const session={id:'session',status:'ACTIVE',startedAt:new Date(Date.now()-120000),exercises:[{sets:[{weightKg:30,repetitions:10}]}],update:async input=>{state.finishUpdates++;Object.assign(session,input);}};
  t.mock.method(sequelize,'transaction',async callback=>{const result=await callback({LOCK:{UPDATE:'UPDATE'}});if(state.commitFailure)throw Error('Commit fallido');return result;});
  t.mock.method(TrainingSession,'findOne',async({where})=>where.userId==='owner'?session:null);
  t.mock.method(PerformedExercise,'findOne',async()=>({id:'performed'}));
  t.mock.method(PerformedSet,'findOne',async()=>state.set);
  t.mock.method(PerformedSet,'create',async input=>{
    state.created.push(input);state.set={id:'set',...input,update:async values=>{state.updates++;Object.assign(state.set,values);}};return state.set;
  });
  t.mock.method(SessionMutation,'findByPk',async id=>state.receipts.get(id)||null);
  t.mock.method(SessionMutation,'create',async input=>{state.receipts.set(input.id,input);return input;});
  return {state,session,request:await httpClient(t)};
}
const path='/sessions/session/exercises/performed/sets';
const values={setNumber:1,weightKg:30,repetitions:8,durationSeconds:20,actualRestSeconds:60};

test('finalizar dos veces conserva fecha, duración y totales originales',async t=>{
  const {state,request}=await fixture(t);
  const first=await request('/sessions/session/finish','POST',{durationSeconds:60});
  const second=await request('/sessions/session/finish','POST',{durationSeconds:100});
  assert.equal(first.status,200);assert.deepEqual(second.data,first.data);assert.equal(state.finishUpdates,1);
});
test('una sesión cancelada no se convierte en completada',async t=>{
  const {state,session,request}=await fixture(t);session.status='CANCELLED';
  assert.equal((await request('/sessions/session/finish','POST',{durationSeconds:60})).status,409);assert.equal(state.finishUpdates,0);
});
test('reintentar el mismo operationId devuelve su respuesta y no duplica la serie',async t=>{
  const {state,request}=await fixture(t);const body={...values,operationId:randomUUID()};
  const first=await request(path,'POST',body),second=await request(path,'POST',body);
  assert.equal(first.status,201);assert.deepEqual(second.data,first.data);assert.equal(state.created.length,1);
});
test('un operationId no se puede reutilizar con otros valores',async t=>{
  const {state,request}=await fixture(t);const body={...values,operationId:randomUUID()};await request(path,'POST',body);
  assert.equal((await request(path,'POST',{...body,weightKg:99})).status,409);assert.equal(state.created.length,1);assert.equal(state.set.weightKg,30);
});
test('reintentar una edición antigua no sobrescribe una edición más reciente',async t=>{
  const {state,request}=await fixture(t);await request(path,'POST',values);
  const earlier={...values,weightKg:35,operationId:randomUUID()};
  await request(path+'/1','PUT',earlier);await request(path+'/1','PUT',{...values,weightKg:40,operationId:randomUUID()});
  const replay=await request(path+'/1','PUT',earlier);
  assert.equal(replay.data.weightKg,35);assert.equal(state.set.weightKg,40);assert.equal(state.updates,2);
});
test('un reintento confirmado puede recuperar su respuesta después del cierre',async t=>{
  const {state,session,request}=await fixture(t);const body={...values,operationId:randomUUID()};const first=await request(path,'POST',body);
  session.status='COMPLETED';const replay=await request(path,'POST',body);
  assert.deepEqual(replay.data,first.data);assert.equal(state.created.length,1);
  assert.equal((await request(path,'POST',{...values,setNumber:2,operationId:randomUUID()})).status,409);
});
test('otra cuenta no puede recuperar un recibo de sincronización ajeno',async t=>{
  const {request}=await fixture(t);const body={...values,operationId:randomUUID()};await request(path,'POST',body);
  assert.equal((await request(path,'POST',body,'other-user')).status,404);
});
test('una falla de commit no devuelve una confirmación exitosa',async t=>{
  const {state,request}=await fixture(t);state.commitFailure=true;
  assert.equal((await request(path,'POST',values)).status,500);
});
test('un cliente anterior puede reintentar un POST idéntico sin duplicar',async t=>{
  const {state,request}=await fixture(t);assert.equal((await request(path,'POST',values)).status,201);
  assert.equal((await request(path,'POST',values)).status,200);assert.equal(state.created.length,1);
});
test('un POST anterior con valores distintos requiere una edición explícita',async t=>{
  const {state,request}=await fixture(t);await request(path,'POST',values);
  assert.equal((await request(path,'POST',{...values,weightKg:90})).status,409);assert.equal(state.set.weightKg,30);
});
