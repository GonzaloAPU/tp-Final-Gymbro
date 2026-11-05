/** Pruebas unitarias de nombres y permisos, sin conectar a PostgreSQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Op} from 'sequelize';
import {Exercise} from '../src/models/index.js';
import {normalizeExerciseName, exerciseScope, assertExercisesAccessible} from '../src/services/exercise-access.js';

test('nombres equivalentes por tildes, Unicode, espacios y mayúsculas se reconocen', () => {
  for (const name of ['Sentadilla búlgara','  SENTADILLA   BÚLGARA  ','\tSentadilla\nBúlgara\t']) {
    assert.equal(normalizeExerciseName(name),'sentadilla bulgara');
  }
  assert.notEqual(normalizeExerciseName('Press banca'),normalizeExerciseName('Press banca inclinado'),'No fusionar variantes de ejercicios');
});

test('el alcance permite oficiales y propios sin incluir otro propietario', () => {
  const scope=exerciseScope('owner');
  const visible=owner=>scope[Op.or].some(rule=>rule.createdByUserId===owner);
  assert.equal(visible(null),true);
  assert.equal(visible('owner'),true);
  assert.equal(visible('other'),false);
});

test('repetir un ejercicio accesible en una rutina no provoca un falso rechazo', async t => {
  const transaction={marker:'transaction'};
  t.mock.method(Exercise,'count',async options=>{
    assert.deepEqual(options.where.id,['first','second']);
    assert.equal(options.transaction,transaction);
    assert.deepEqual(options.where[Op.or],[{createdByUserId:null},{createdByUserId:'owner'}]);
    return 2;
  });
  await assertExercisesAccessible(['first','first','second'],'owner',transaction);
});

test('un ejercicio ajeno o inexistente impide crear la relación', async t => {
  t.mock.method(Exercise,'count',async()=>1);
  await assert.rejects(assertExercisesAccessible(['own','hidden'],'owner'),{status:404});
});

test('una falla de consulta no se interpreta como permiso concedido', async t => {
  const failure=new Error('Conexión interrumpida');
  t.mock.method(Exercise,'count',async()=>{throw failure;});
  await assert.rejects(assertExercisesAccessible(['exercise'],'owner'),error=>error===failure);
});
