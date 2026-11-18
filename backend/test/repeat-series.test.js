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
import {sequelize} from '../src/db.js';
import { TrainingSession, PerformedExercise, PerformedSet } from '../src/models/index.js';

test('repeating a series updates its record and enforces session ownership', async t => {
  t.mock.method(sequelize,'transaction',async callback=>callback({LOCK:{UPDATE:'UPDATE'}}));
  const originals = [TrainingSession.findOne, PerformedExercise.findOne, PerformedSet.findOne];
  let status = 'ACTIVE';
  let exists = true;
  let updates = 0;
  const saved = { setNumber: 1, weightKg: 20, repetitions: 8, async update(data) { Object.assign(this, data); updates++; } };
  TrainingSession.findOne = async ({ where }) => where.userId === 'owner' ? { status } : null;
  PerformedExercise.findOne = async () => ({ id: 'exercise' });
  PerformedSet.findOne = async () => exists ? saved : null;
  t.mock.method(accountAccess,'isActive',async()=>true);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:true}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => {
    [TrainingSession.findOne, PerformedExercise.findOne, PerformedSet.findOne] = originals;
    server.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api/sessions/session/exercises/exercise/sets/1`;
  const request = (user = 'owner', setNumber = 1) => fetch(url, { method: 'PUT', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ sub: user }, config.jwtSecret)}`,
  }, body: JSON.stringify({ setNumber, weightKg: 35, repetitions: 10, durationSeconds: 12 }) });
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal((await result.json()).weightKg, 35);
  assert.equal(updates, 1);
  assert.equal((await request('other-user')).status, 404);
  assert.equal((await request('owner', 2)).status, 400);
  status = 'COMPLETED';
  assert.equal((await request()).status, 409);
  status = 'ACTIVE'; exists = false;
  assert.equal((await request()).status, 404);
  assert.equal(updates, 1, 'Rejected requests must not change the saved record');
});
