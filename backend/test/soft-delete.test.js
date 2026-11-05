import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {models,User,Routine,Exercise,RoutineExercise} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {softDeleteTables} from '../src/services/soft-delete.js';
import {accountAccess,requireActiveAccount} from '../src/middleware/active-account.js';
import {allowedCatalog} from '../src/services/welcome-planner.js';
import {httpClient} from '../test-support/http.js';
import {assertExercisesAccessible} from '../src/services/exercise-access.js';
for(const table of softDeleteTables)test(`archivo: ${table} filtra automáticamente deleted_at`,async t=>{
  const model=Object.values(models).find(m=>m.tableName===table),queries=[];
  assert.ok(model.options.paranoid);
  t.mock.method(sequelize,'query',async sql=>{queries.push(typeof sql==='string'?sql:sql.query);return [];});
  await model.findAll();
  assert.match(queries[0],/"deleted_at" IS NULL/);
});
test('archivo: destroy genera UPDATE y restore conserva el mismo registro',async t=>{
  const queries=[];
  t.mock.method(sequelize,'query',async sql=>{queries.push(typeof sql==='string'?sql:sql.query);return 1;});
  const id=randomUUID();await Routine.destroy({where:{id}});await Routine.restore({where:{id}});
  assert.ok(queries.every(sql=>sql.startsWith('UPDATE')));assert.ok(queries.every(sql=>sql.includes('deleted_at')));
});
test('archivo: JWT previo de cuenta archivada se rechaza',async t=>{
  t.mock.method(User,'findByPk',async()=>null);
  const res={status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
  let continued=false;await requireActiveAccount({auth:{sub:randomUUID()}},res,()=>{continued=true;});
  assert.equal(res.code,401);assert.equal(continued,false);
});
test('archivo: cuenta activa puede continuar y consulta respeta paranoid',async t=>{
  let options;t.mock.method(User,'findByPk',async(_id,input)=>{options=input;return {id:'active'};});
  assert.equal(await accountAccess.isActive('active'),true);assert.notEqual(options.paranoid,false);
});
test('archivo: un fallo de base no habilita el acceso',async t=>{
  const failure=Error('sin conexión');t.mock.method(accountAccess,'isActive',async()=>{throw failure;});
  let received;await requireActiveAccount({auth:{sub:'active'}},{},error=>{received=error;});assert.equal(received,failure);
});
test('archivo: generador no recomienda ejercicios archivados',()=>{
  const exercise={id:randomUUID(),name:'Sentadilla con peso corporal',trainingType:'POWER',equipment:'Peso corporal',createdByUserId:null};
  assert.equal(allowedCatalog({equipment:[]},[exercise]).length,1);
  assert.equal(allowedCatalog({equipment:[]},[{...exercise,deletedAt:new Date()}]).length,0);
});
test('archivo: ranking SQL filtra cuentas, sesiones y series anuladas',async t=>{
  let query;t.mock.method(sequelize,'query',async sql=>{query=sql;return [];});
  const request=await httpClient(t);assert.equal((await request('/progress/leaderboard')).status,200);
  for(const alias of ['u','s','pe','ps','e'])assert.ok(query.includes(`${alias}.deleted_at IS NULL`));
});
test('archivo: ejercicio archivado solo se admite en su prescripción existente y propia',async t=>{
  t.mock.method(Exercise,'count',async()=>0);let options;
  t.mock.method(RoutineExercise,'count',async input=>{options=input;return 1;});
  await assert.rejects(assertExercisesAccessible(['exercise'],'owner',{}),/no existe/);
  await assertExercisesAccessible(['exercise'],'owner',{},'original-day');
  assert.equal(options.where.routineDayId,'original-day');
  assert.equal(options.include[1].include[0].where.userId,'owner');
  assert.equal(options.include[0].paranoid,false);
  t.mock.method(RoutineExercise,'count',async()=>0);
  await assert.rejects(assertExercisesAccessible(['exercise'],'other',{},'original-day'),/no existe/);
});
