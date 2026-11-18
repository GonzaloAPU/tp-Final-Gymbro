/** Prueba HTTP real con una base temporal; no usa producción ni envía correos. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({path:new URL('../backend/.env',import.meta.url),quiet:true});
const url=new URL(process.env.DATABASE_URL);
assert.equal(process.env.DB_CONNECTION_MODE,'LOCAL');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.equal(url.pathname,'/smartgymbro_tp');
const database='smartgymbro_tp_smoke_'+randomBytes(6).toString('hex');
const admin=new pg.Client({connectionString:url.toString()});
let created=false,server,sequelize;
const passed=[];
try{
 await admin.connect();
 await admin.query(`CREATE DATABASE "${database}" TEMPLATE "smartgymbro_tp"`);created=true;
 url.pathname='/'+database;process.env.DATABASE_URL=url.toString();
 process.env.GEMINI_ENABLED='false';
 for(const key of ['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY'])process.env[key]='';
 ({sequelize}=await import('../backend/src/db.js'));
 const {app}=await import('../backend/src/app.js');
 await sequelize.authenticate();
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 let token;
 async function request(path,method='GET',body,status=200){
  const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await res.json();assert.equal(res.status,status,`${method} ${path}: ${data.message||'respuesta inesperada'}`);return data;
 }
 assert.equal((await request('/health')).status,'ok');passed.push('salud');
 const docs=await request('/legal/documents');
 const email=`revision-${randomBytes(6).toString('hex')}@example.invalid`,password=randomBytes(20).toString('hex');
 const account=await request('/auth/register','POST',{name:'Cuenta temporal de verificación',email,password,legal:{version:docs.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true}},201);
 assert.ok(account.user.id);token=(await request('/auth/login','POST',{email,password})).token;assert.ok(token);passed.push('registro e ingreso');
 await request('/auth/me');await request('/legal/status');passed.push('perfil y permisos');
 const exercises=await request('/exercises');assert.ok(exercises.length>=190);assert.ok(exercises.some(e=>e.description&&e.videoUrl));passed.push('catálogo, descripciones y videos');
 const input={age:25,heightCm:175,weightKg:75,goal:'GENERAL',experience:'BEGINNER',place:'HOME',equipment:[],sessions:3,minutes:60,availability:[1,3,5].map(weekday=>({weekday,start:'18:00',end:'19:00'})),hasRestrictions:false,mode:'LOCAL',aiConsent:false};
 const proposal=await request('/welcome/preview','POST',input);assert.ok(proposal.id);
 await request('/welcome/accept','POST',{proposalId:proposal.id});
 const routines=await request('/routines');assert.ok(routines.length>0);passed.push('generación local y aceptación de semana');
 const exercise=exercises.find(e=>/press banca con mancuernas/i.test(e.name))||exercises[0];
 const session=await request('/sessions','POST',{},201);
 const performed=await request(`/sessions/${session.id}/exercises`,'POST',{exerciseId:exercise.id,order:1},201);
 await request(`/sessions/${session.id}/exercises/${performed.id}/sets`,'POST',{setNumber:1,weightKg:20,repetitions:10},201);
 const finished=await request(`/sessions/${session.id}/finish`,'POST',{});assert.equal(finished.status,'COMPLETED');passed.push('entrenamiento, serie y cierre');
 await request('/progress/weight','POST',{weightKg:74},201);
 const summary=await request('/progress/summary');assert.equal(summary.completedSessions,1);assert.ok(summary.records.length>0);assert.ok(summary.weights.length>0);
 await request('/progress/leaderboard');passed.push('peso, progreso, récords y ranking');
 await request('/auth/forgot-password','POST',{email},503);passed.push('correo externo desactivado explícitamente');
 console.log(JSON.stringify({ok:true,comprobaciones:passed,baseTemporal:true},null,2));
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(sequelize)await sequelize.close();
 if(created)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
 await admin.end();
}
