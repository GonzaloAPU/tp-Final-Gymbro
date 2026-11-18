/** Prueba integrada sobre una copia dedicada. Nunca apunta a la base de trabajo. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const target = new URL(process.env.DATABASE_URL);
target.pathname='/gymbro_normalization_test';
process.env.DATABASE_URL=target.toString();
const {sequelize} = await import('../src/db.js');
const {models,User,Exercise,UserRestDay,BodyWeightHistory} = await import('../src/models/index.js');
const {normalizeSchema} = await import('./migrations/20261020-normalize.js');
const {migrateOfflineSessions}=await import('./migrations/20261020-offline-sessions.js');
const {app} = await import('../src/app.js');
const {config} = await import('../src/config.js');
const {default:jwt} = await import('jsonwebtoken');
const {migrateLegal}=await import('./migrations/20261022-legal.js');
const {recordLegalAcceptance,legalDocuments}=await import('../src/services/legal.js');
const {LegalAcceptance}=await import('../src/models/index.js');
const fixtureConsent={version:legalDocuments.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true};
let server;
const users=[];
try {
  await migrateLegal();
  await migrateOfflineSessions();
  const counts = async () => Object.fromEntries(await Promise.all(Object.entries(models).map(async ([key,m])=>[key,await m.count()])));
  const before=await counts(); await normalizeSchema(); assert.deepEqual(await counts(),before,'Repetir la migración no altera datos');
  const columns=await sequelize.getQueryInterface().describeTable('users');
  assert.ok(!columns.rest_days && !columns.current_kg);
  assert.ok(!(await sequelize.getQueryInterface().describeTable('routine_days')).schedule);
  const marker=randomUUID();
  for(let index=0;index<2;index++) users.push(await User.create({name:`Prueba ${index}`,email:`normalization-${marker}-${index}@example.invalid`,passwordHash:'test-only'}));
  for(const account of users)await recordLegalAcceptance(account.id,fixtureConsent);
  server=app.listen(0); await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const request=async(index,path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${jwt.sign({sub:users[index].id},config.jwtSecret)}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const exercise={name:`Éjercicio   privado ${marker}`,muscleGroup:'Espalda',equipment:'Polea',trainingType:'POWER'};
  const first=await request(0,'/exercises','POST',exercise); assert.equal(first.status,201);
  assert.equal(first.data.createdByUserId,users[0].id);
  const equivalent={...exercise,name:`  EJERCICIO privado ${marker}  `};
  assert.equal((await request(0,'/exercises','POST',equivalent)).status,409);
  assert.equal((await request(1,'/exercises','POST',equivalent)).status,201,'Dos propietarios pueden tener el mismo nombre privado');
  assert.equal((await request(0,'/exercises','POST',{...exercise,name:'  SENTÁDILLA '})).status,409,'No duplica un oficial');
  const catalog=await request(1,'/exercises'); assert.equal(catalog.status,200);
  assert.ok(!catalog.data.some(item=>item.id===first.data.id),'Otro usuario no ve el privado');
  assert.ok(catalog.data.some(item=>item.name==='Sentadilla'));
  const routine={name:'Prueba',goal:'Verificación',days:[{name:'Día',dayNumber:1,exercises:[{exerciseId:first.data.id,order:1}]}]};
  assert.equal((await request(1,'/routines','POST',routine)).status,404,'No admite IDs privados ajenos');
  const own=await request(0,'/routines','POST',routine); assert.equal(own.status,201);
  assert.equal((await request(1,'/sessions','POST',{routineDayId:own.data.days[0].id})).status,404);
  const session=await request(1,'/sessions','POST',{});
  assert.equal((await request(1,`/sessions/${session.data.id}/exercises`,'POST',{exerciseId:first.data.id,order:1})).status,404);
  // Una carrera de solicitudes equivalentes solo debe crear un registro.
  const concurrent=await Promise.all(Array.from({length:5},()=>request(0,'/exercises','POST',{...exercise,name:`Carrera ${marker}`})));
  assert.equal(concurrent.filter(result=>result.status===201).length,1);
  assert.equal(concurrent.filter(result=>result.status===409).length,4);
  await assert.rejects(Exercise.create({...exercise,name:'sentadilla',createdByUserId:users[0].id}));
  // Descansos e historial conservan la forma pública de la API sin columnas redundantes.
  assert.equal((await request(0,'/auth/me','PATCH',{restDays:[2,4],currentKg:70})).status,200);
  assert.equal(await UserRestDay.count({where:{userId:users[0].id}}),2);
  const profile=await request(0,'/auth/me'); assert.deepEqual(profile.data.restDays,[2,4]); assert.equal(profile.data.currentKg,70);
  await request(0,'/auth/me','PATCH',{name:'Prueba renombrada',currentKg:70});
  assert.equal(await BodyWeightHistory.count({where:{userId:users[0].id}}),1,'Editar sin cambiar peso no duplica');
  assert.equal((await request(0,'/progress/weight','POST',{weightKg:65,recordedAt:'2020-01-01T12:00:00Z'})).status,201);
  assert.equal((await request(0,'/auth/me')).data.currentKg,70,'Un pesaje antiguo no altera el actual');
  assert.equal((await request(0,`/routines/${own.data.id}/days/${own.data.days[0].id}/schedule`,'PUT',{schedule:[{weekday:2,start:'10:00',end:'11:00'}]})).status,409);
  assert.equal((await request(0,'/auth/me','PATCH',{restDays:[]})).status,200);
  assert.equal(await UserRestDay.count({where:{userId:users[0].id}}),0);
  console.log('OK: migración repetible, nombres equivalentes, aislamiento, permisos, concurrencia, descansos y peso derivado.');
} finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  for(const user of users) {
    await models.Routine.destroy({where:{userId:user.id},force:true});
    await models.TrainingSession.destroy({where:{userId:user.id},force:true});
    await Exercise.destroy({where:{createdByUserId:user.id},force:true});
    await LegalAcceptance.destroy({where:{userId:user.id}});
    await user.destroy({force:true});
  }
  await sequelize.close();
}
