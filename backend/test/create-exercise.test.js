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
import { sequelize } from '../src/db.js';
import { Exercise } from '../src/models/index.js';

test('exercise creation validates table fields and rejects duplicate names', async t => {
  const originals = [Exercise.findOne, Exercise.create, sequelize.transaction, sequelize.query];
  sequelize.transaction = async callback => callback({});
  sequelize.query = async () => [];
  let duplicate = false;
  let created;
  Exercise.findOne = async () => duplicate ? { id: 'existing' } : null;
  Exercise.create = async data => { created = data; return { id: 'new-exercise', ...data }; };
  t.mock.method(accountAccess,'isActive',async()=>true);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:true}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { [Exercise.findOne, Exercise.create, sequelize.transaction, sequelize.query] = originals; server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/exercises`;
  const headers = { 'content-type': 'application/json', Authorization: `Bearer ${jwt.sign({sub:'owner'},config.jwtSecret)}` };
  const input = { name:' Sentadilla búlgara ', muscleGroup:'Piernas', equipment:'Mancuernas', movementPattern:'Sentadilla unilateral', trainingType:'POWER' };
  const response = await fetch(url, {method:'POST',headers,body:JSON.stringify(input)});
  assert.equal(response.status,201);
  assert.equal(created.name,'Sentadilla búlgara');
  assert.equal(created.createdByUserId,'owner');
  assert.equal(created.normalizedName,'sentadilla bulgara');
  assert.equal((await response.json()).movementPattern,'Sentadilla unilateral');
  duplicate = true;
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(input)})).status,409);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({...input,name:' '})})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({...input,trainingType:'INVALID'})})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})).status,401);
});
