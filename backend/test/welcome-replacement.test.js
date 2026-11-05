/** Reemplazar la semana no debe acumular planes ni borrar sesiones históricas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {httpClient} from '../test-support/http.js';
import {sequelize} from '../src/db.js';
import {User,UserRestDay,BodyWeightHistory,Exercise,Routine,RoutineDay,RoutineExercise,RoutineSchedule,WelcomePlan,TrainingSession} from '../src/models/index.js';
import {exerciseData} from '../src/data/exercise-catalog.js';
import {makeLocalPlan} from '../src/services/welcome-planner.js';

test('bienvenida: reemplaza rutinas y descansos al aceptar y conserva el historial',async t=>{
  const catalog=exerciseData.map(e=>({...e,id:randomUUID(),createdByUserId:null}));
  const preferences={age:30,heightCm:170,weightKg:70,goal:'GENERAL',experience:'BEGINNER',place:'HOME',equipment:[],sessions:3,minutes:45,availability:[1,2,3].map(weekday=>({weekday,start:'18:00',end:'19:00'})),hasRestrictions:false,mode:'LOCAL',aiConsent:false};
  const proposal=makeLocalPlan(preferences,catalog),id=randomUUID(),calls=[];
  const transaction={LOCK:{UPDATE:'UPDATE'}};
  t.mock.method(sequelize,'transaction',async fn=>fn(transaction));
  t.mock.method(User,'findByPk',async()=>({update:async()=>{}}));
  t.mock.method(Exercise,'findAll',async()=>catalog);
  const row={preferences,proposal,update:async values=>Object.assign(row,values)};
  t.mock.method(WelcomePlan,'findOne',async options=>{assert.equal(options.where.userId,'owner');return row;});
  t.mock.method(Routine,'update',async()=>{});
  t.mock.method(Routine,'destroy',async options=>{assert.equal(options.where.userId,'owner');assert.equal(options.transaction,transaction);assert.notEqual(options.force,true);calls.push('archive');});
  t.mock.method(Routine,'create',async()=>{calls.push('create');return {id:'new-routine'};});
  t.mock.method(RoutineDay,'create',async()=>({id:randomUUID()}));
  t.mock.method(RoutineExercise,'bulkCreate',async()=>{});
  const schedules=[];t.mock.method(RoutineSchedule,'create',async slot=>schedules.push(slot));
  t.mock.method(BodyWeightHistory,'findOne',async options=>{assert.equal(options.where.userId,'owner');assert.deepEqual(options.order,[['recordedAt','DESC']]);return {weightKg:65};});
  t.mock.method(BodyWeightHistory,'create',()=>assert.fail('Un plan viejo no debe sobrescribir el historial de pesos'));
  t.mock.method(UserRestDay,'destroy',async()=>{});
  let rests;t.mock.method(UserRestDay,'bulkCreate',async values=>{rests=values;});
  t.mock.method(TrainingSession,'destroy',()=>assert.fail('No borrar historial'));
  // El plan anterior no debe consultarse para bloquear la nueva distribución.
  t.mock.method(RoutineDay,'findAll',()=>assert.fail('No heredar horarios anteriores'));
  const request=await httpClient(t);
  assert.equal((await request('/welcome/accept','POST',{proposalId:id})).status,200);
  assert.deepEqual(calls,['archive','create']);assert.equal(schedules.length,3);
  assert.deepEqual(rests.map(day=>day.weekday),[0,4,5,6]);
  assert.equal((await request('/welcome/accept','POST',{proposalId:id})).status,200);
  assert.deepEqual(calls,['archive','create']); // Reintentar no vuelve a reemplazar.
  const saved=await request('/welcome/draft');
  assert.equal(saved.status,200);assert.equal(saved.data.preferences.age,30);
  assert.equal(saved.data.proposal,null);assert.equal(saved.data.preferences.aiConsent,false);
  assert.equal(saved.data.profile.currentKg,65);
});
