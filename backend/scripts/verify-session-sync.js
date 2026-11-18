/** Integración de sincronización sobre la copia aislada, nunca sobre smartgymbro. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const target=new URL(process.env.DATABASE_URL);target.pathname='/gymbro_normalization_test';process.env.DATABASE_URL=target.toString();
const {sequelize}=await import('../src/db.js');
const {User,Exercise,TrainingSession,PerformedExercise,PerformedSet,SessionMutation}=await import('../src/models/index.js');
const {migrateOfflineSessions}=await import('./migrations/20261020-offline-sessions.js');
const {app}=await import('../src/app.js');
const {config}=await import('../src/config.js');
const {default:jwt}=await import('jsonwebtoken');
const {migrateLegal}=await import('./migrations/20261022-legal.js');
const {recordLegalAcceptance,legalDocuments}=await import('../src/services/legal.js');
const {LegalAcceptance}=await import('../src/models/index.js');
const fixtureConsent={version:legalDocuments.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true};
let user,server;
const originalError=console.error;
try {
  await migrateLegal();
  await migrateOfflineSessions();
  user=await User.create({name:'Sync test',email:`sync-${randomUUID()}@example.invalid`,passwordHash:'test-only'});
  const exercise=await Exercise.findOne({where:{createdByUserId:null}});assert.ok(exercise);
  await recordLegalAcceptance(user.id,fixtureConsent);
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/sessions`;
  const request=async(path,body,method='POST',owner=user.id)=>{
    const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${jwt.sign({sub:owner},config.jwtSecret)}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  console.error=()=>{}; // Los rechazos esperados se verifican por su estado, sin ensuciar la salida.
  const clientSessionId=randomUUID();
  const start={clientSessionId,operationId:randomUUID(),startedAt:new Date(Date.now()-120000).toISOString()};
  const starts=await Promise.all(Array.from({length:5},()=>request('',start)));
  assert.ok(starts.every(result=>result.status===201));
  assert.equal(await TrainingSession.count({where:{id:clientSessionId}}),1);
  const minimalOperationId=randomUUID();
  const minimalFirst=await request('',{operationId:minimalOperationId});
  const minimalReplay=await request('',{operationId:minimalOperationId});
  assert.equal(minimalFirst.status,201);assert.deepEqual(minimalReplay.data,minimalFirst.data);
  assert.equal(await TrainingSession.count({where:{id:minimalOperationId}}),1);
  const performedId=randomUUID();
  const add={exerciseId:exercise.id,order:1,clientExerciseId:performedId,operationId:randomUUID()};
  const exercises=await Promise.all(Array.from({length:5},()=>request(`/${clientSessionId}/exercises`,add)));
  assert.ok(exercises.every(result=>result.status===201));
  assert.equal(await PerformedExercise.count({where:{sessionId:clientSessionId}}),1);
  const path=`/${clientSessionId}/exercises/${performedId}/sets`;
  const first={setNumber:1,weightKg:30,repetitions:8,durationSeconds:20,actualRestSeconds:60,completedAt:new Date(Date.now()-60000).toISOString(),operationId:randomUUID()};
  const sets=await Promise.all(Array.from({length:10},()=>request(path,first)));
  assert.ok(sets.every(result=>result.status===201));
  assert.equal(await PerformedSet.count({where:{performedExerciseId:performedId}}),1);
  assert.equal(await SessionMutation.count({where:{sessionId:clientSessionId}}),3);
  const earlier={...first,weightKg:35,operationId:randomUUID()};
  assert.equal((await request(path+'/1',earlier,'PUT')).status,200);
  assert.equal((await request(path+'/1',{...first,weightKg:40,operationId:randomUUID()},'PUT')).status,200);
  assert.equal((await request(path+'/1',earlier,'PUT')).data.weightKg,35);
  assert.equal(Number((await PerformedSet.findOne({where:{performedExerciseId:performedId}})).weightKg),40);
  assert.equal((await request(path,{...first,weightKg:99})).status,409);
  // Si guardar y finalizar compiten, el bloqueo deja los totales consistentes en ambos órdenes posibles.
  const finish={durationSeconds:90,operationId:randomUUID()};
  const [finished,lastSet]=await Promise.all([
    request(`/${clientSessionId}/finish`,finish),
    request(path,{...first,setNumber:2,operationId:randomUUID()}),
  ]);
  assert.equal(finished.status,200);assert.ok([201,409].includes(lastSet.status));
  const stored=await TrainingSession.findByPk(clientSessionId);
  const actual=await PerformedSet.findAll({where:{performedExerciseId:performedId}});
  assert.equal(Number(stored.totalVolumeKg),actual.reduce((sum,set)=>sum+Number(set.weightKg)*set.repetitions,0));
  const repeatClosures=await Promise.all(Array.from({length:5},()=>request(`/${clientSessionId}/finish`,{durationSeconds:1,operationId:randomUUID()})));
  assert.ok(repeatClosures.every(result=>result.status===200&&result.data.durationSeconds===90&&new Date(result.data.finishedAt).getTime()===stored.finishedAt.getTime()));
  assert.equal((await request(path,first)).status,201,'Un reintento perdido recupera el recibo aun con sesión cerrada');
  assert.equal((await request(path,first,'POST',randomUUID())).status,404);
  assert.equal((await request(path,{...first,operationId:randomUUID()})).status,409);
  console.log('OK: PostgreSQL real, inicio/ejercicio/serie concurrentes sin duplicados, recibos, edición antigua, cierre inmutable y carrera guardar/finalizar.');
} finally {
  console.error=originalError;
  if(server)await new Promise(resolve=>server.close(resolve));
  if(user)await LegalAcceptance.destroy({where:{userId:user.id}});
  if(user)await user.destroy({force:true});
  await sequelize.close();
}
