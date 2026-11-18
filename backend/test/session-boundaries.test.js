/** Series y totales de sesión con modelos completamente simulados. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingSession,PerformedExercise,PerformedSet} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';
const setPath='/sessions/session/exercises/performed/sets';
const valid={setNumber:1,weightKg:30,repetitions:8,durationSeconds:20,actualRestSeconds:60};
async function fixture(t) {
  t.mock.method(sequelize,'transaction',async callback=>callback({LOCK:{UPDATE:'UPDATE'}}));
  const state={performed:true,existing:false,created:[],updates:[]};
  const session={id:'session',status:'PAUSED',startedAt:new Date(Date.now()-120000),exercises:[{sets:[{weightKg:30,repetitions:10},{weightKg:20,repetitions:12}]}],update:async data=>{state.updates.push(data);Object.assign(session,data);}};
  t.mock.method(TrainingSession,'findOne',async()=>session);
  t.mock.method(PerformedExercise,'findOne',async()=>state.performed?{id:'performed'}:null);
  t.mock.method(PerformedSet,'findOne',async()=>state.existing?{update:async()=>{}}:null);
  t.mock.method(PerformedSet,'create',async input=>{state.created.push(input);return {id:'set',...input};});
  return {state,session,request:await httpClient(t)};
}
test('sesión: una serie pausada permite guardar kilos, repeticiones y tiempos',async t=>{const {state,request}=await fixture(t);const result=await request(setPath,'POST',valid);assert.equal(result.status,201);assert.equal(state.created[0].weightKg,30);assert.equal(state.created[0].repetitions,8);assert.equal(state.created[0].durationSeconds,20);assert.equal(state.created[0].actualRestSeconds,60);});
test('sesión: no permite guardar cero repeticiones',async t=>{const {state,request}=await fixture(t);assert.equal((await request(setPath,'POST',{...valid,repetitions:0})).status,400);assert.equal(state.created.length,0);});
test('sesión: no permite kilos negativos',async t=>{const {state,request}=await fixture(t);assert.equal((await request(setPath,'POST',{...valid,weightKg:-1})).status,400);assert.equal(state.created.length,0);});
test('sesión: no registra series de un ejercicio realizado inexistente',async t=>{const {state,request}=await fixture(t);state.performed=false;assert.equal((await request(setPath,'POST',valid)).status,404);assert.equal(state.created.length,0);});
test('sesión: repetir una serie inexistente no crea una nueva',async t=>{const {state,request}=await fixture(t);assert.equal((await request(setPath+'/1','PUT',valid)).status,404);assert.equal(state.created.length,0);});
test('sesión: finalizar suma el volumen real de todas las series',async t=>{const {state,request}=await fixture(t);const result=await request('/sessions/session/finish','POST',{durationSeconds:60});assert.equal(result.status,200);assert.equal(result.data.totalVolumeKg,540);assert.equal(state.updates[0].status,'COMPLETED');});
test('sesión: la estimación de calorías usa la duración activa enviada',async t=>{const {request}=await fixture(t);const result=await request('/sessions/session/finish','POST',{durationSeconds:60});assert.equal(result.status,200);assert.equal(result.data.calories,6.5);assert.equal(result.data.durationSeconds,60);});
test('sesión: limita una duración mayor al tiempo real transcurrido',async t=>{const {request,session}=await fixture(t);const result=await request('/sessions/session/finish','POST',{durationSeconds:99999});assert.equal(result.status,200);const maximum=Math.round((Date.now()-session.startedAt)/1000);assert.ok(result.data.durationSeconds<=maximum);assert.ok(result.data.durationSeconds<99999);});
