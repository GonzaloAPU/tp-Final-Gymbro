/** Integración sobre gymbro_normalization_test. Nunca crea datos en la base principal. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const target=new URL(process.env.DATABASE_URL);target.pathname='/gymbro_normalization_test';process.env.DATABASE_URL=target.toString();
const {sequelize}=await import('../src/db.js');
const {User,Routine,RoutineSchedule,WelcomePlan,BodyWeightHistory}=await import('../src/models/index.js');
const {migrateWelcome}=await import('./migrations/20261021-welcome.js');
const {app}=await import('../src/app.js');
const {config}=await import('../src/config.js');
const {default:jwt}=await import('jsonwebtoken');
const {migrateLegal}=await import('./migrations/20261022-legal.js');
const {recordLegalAcceptance,legalDocuments}=await import('../src/services/legal.js');
const {LegalAcceptance}=await import('../src/models/index.js');
const fixtureConsent={version:legalDocuments.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true};
let user,server;
try {
  await migrateLegal();
  await migrateWelcome();
  user=await User.create({name:'Welcome verification',email:`welcome-${randomUUID()}@example.invalid`,passwordHash:'not-a-login'});
  await recordLegalAcceptance(user.id,fixtureConsent);
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const token=jwt.sign({sub:user.id},config.jwtSecret),base=`http://127.0.0.1:${server.address().port}/api`;
  const request=async(path,body,ownerToken=token)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${ownerToken}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const input={age:30,heightCm:170,weightKg:70,goal:'GENERAL',experience:'BEGINNER',place:'HOME',equipment:[],sessions:3,minutes:45,availability:[1,3,5].map(weekday=>({weekday,start:'18:00',end:'19:00'})),hasRestrictions:false,mode:'LOCAL',aiConsent:false};
  assert.equal((await request('/welcome/status')).data.needed,true);
  const preview=await request('/welcome/preview',input);assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.equal(preview.data.sessions.length,3);assert.equal(await Routine.count({where:{userId:user.id}}),0,'Preview no crea rutina');
  assert.equal((await request('/welcome/draft')).data.proposal.id,preview.data.id,'La propuesta sobrevive una recarga');
  const other=jwt.sign({sub:randomUUID()},config.jwtSecret);
  assert.equal((await request('/welcome/accept',{proposalId:preview.data.id},other)).status,404,'Otra cuenta no puede aceptar');
  const originalCreate=RoutineSchedule.create;
  RoutineSchedule.create=async()=>{throw Error('Simulated calendar failure');};
  try {assert.equal((await request('/welcome/accept',{proposalId:preview.data.id})).status,500);}finally{RoutineSchedule.create=originalCreate;}
  assert.equal(await Routine.count({where:{userId:user.id}}),0,'Fallo de horario revierte la rutina');
  assert.equal((await WelcomePlan.findByPk(preview.data.id)).acceptedAt,null,'No confirma un fallo');
  const accepted=await request('/welcome/accept',{proposalId:preview.data.id});assert.equal(accepted.status,200,JSON.stringify(accepted.data));
  const retried=await request('/welcome/accept',{proposalId:preview.data.id});assert.deepEqual(retried.data,accepted.data);
  assert.equal(await Routine.count({where:{userId:user.id}}),1,'Reintento no duplica rutina');
  assert.equal(await BodyWeightHistory.count({where:{userId:user.id}}),1,'Reintento no duplica pesaje');
  const routines=await request('/routines');assert.equal(routines.data[0].days.length,3);
  assert.equal(routines.data[0].days[0].schedule[0].start,'18:00');
  assert.equal((await request('/welcome/status')).data.needed,false);
  assert.equal((await request('/auth/me')).data.restDays.length,4);
  assert.equal((await request('/welcome/draft')).data,null);
  console.log('OK: bienvenida local, propuesta persistente, aislamiento, rollback real, aceptación idempotente, perfil, peso, descansos y horarios.');
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  if(user)await LegalAcceptance.destroy({where:{userId:user.id}});
  if(user)await User.destroy({where:{id:user.id},force:true});
  await sequelize.close();
}
