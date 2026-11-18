import {legalAccess} from '../src/services/legal.js';
import {accountAccess} from '../src/middleware/active-account.js';
/**
 * Prueba automatizada del backend: prepara dependencias o datos simulados, ejecuta una operación y usa assert para comprobar el comportamiento. No forma parte del servidor que usa el usuario.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { TrainingSession, BodyWeightHistory, StrengthRecord } from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {httpClient} from '../test-support/http.js';

test('profile summary uses lifetime totals independently of recent sessions', async t => {
  const originals = [TrainingSession.findAll, TrainingSession.sum, TrainingSession.count, BodyWeightHistory.findAll, StrengthRecord.findAll];
  TrainingSession.findAll = async options => { assert.equal(options.limit, 12); return [{ calories: 100 }]; };
  TrainingSession.sum = async (field, { where }) => { assert.equal(field, 'calories'); assert.equal(where.userId, 'profile-owner'); assert.equal(where.status, 'COMPLETED'); return '8979.20'; };
  TrainingSession.count = async () => 27;
  BodyWeightHistory.findAll = async () => [];
  StrengthRecord.findAll = async () => [];
  t.mock.method(sequelize,'query',async(_sql,options)=>{assert.equal(options.replacements.userId,'profile-owner');return [];});
  t.mock.method(accountAccess,'isActive',async()=>true);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:true}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => {
    [TrainingSession.findAll, TrainingSession.sum, TrainingSession.count, BodyWeightHistory.findAll, StrengthRecord.findAll] = originals;
    server.close();
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/progress/summary`, { headers: { Authorization: `Bearer ${jwt.sign({ sub: 'profile-owner' }, config.jwtSecret)}` } });
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.totalCalories, 8979.2);
  assert.equal(summary.completedSessions, 27);
  assert.equal(summary.sessions.length, 1);
});

test('marcas personales: el resumen devuelve las series históricas sin depender de strength_records',async t=>{
  for(const method of ['findAll','sum','count'])t.mock.method(TrainingSession,method,async()=>method==='findAll'?[]:0);
  t.mock.method(BodyWeightHistory,'findAll',async()=>[]);
  t.mock.method(StrengthRecord,'findAll',()=>assert.fail('No consultar una tabla de marcas que no se actualiza'));
  const record={id:'set',maxWeightKg:'80',repetitions:8,estimatedOneRm:'101.33',achievedAt:'2026-10-26',exercise:{id:'exercise',name:'Press banca'}};
  t.mock.method(sequelize,'query',async(sql,options)=>{
    assert.equal(options.replacements.userId,'owner');assert.ok(sql.includes("s.status='COMPLETED'"));
    assert.ok(!sql.includes('leaderboard_opt_in'));return [record];
  });
  const request=await httpClient(t),response=await request('/progress/summary');
  assert.equal(response.status,200);assert.deepEqual(response.data.records,[record]);
});
