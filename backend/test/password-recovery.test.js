import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {User} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {config} from '../src/config.js';
import {app} from '../src/app.js';
import {createResetToken,resetPassword,recoveryDelivery,recoveryLimiter,RecoveryLimiter,ResetAttemptLimiter,newPassword} from '../src/services/password-recovery.js';
import {credentialsMatch,sessionToken} from '../src/services/credentials.js';
import {requireActiveAccount} from '../src/middleware/active-account.js';
import {httpClient} from '../test-support/http.js';

async function fixture(t){
  const state={writes:[],sent:[],missing:false};
  const user={id:randomUUID(),email:'recuperacion@example.invalid',passwordHash:await bcrypt.hash('Anterior123!',4),passwordChangedAt:null,
    async update(body){state.writes.push(body);Object.assign(this,body);}};
  t.mock.method(User,'findOne',async()=>state.missing?null:user);
  t.mock.method(User,'findByPk',async()=>state.missing?null:user);
  let tail=Promise.resolve();
  t.mock.method(sequelize,'transaction',callback=>{const result=tail.then(()=>callback({LOCK:{UPDATE:'UPDATE'}}));tail=result.catch(()=>{});return result;});
  t.mock.method(recoveryDelivery,'configured',()=>true);
  t.mock.method(recoveryDelivery,'send',async(to,link)=>state.sent.push({to,link}));
  t.mock.method(recoveryLimiter,'allow',()=>true);
  return {state,user,request:await httpClient(t)};
}
test('recuperación: solicitud pública devuelve lo mismo con y sin cuenta',async t=>{
  const {request,state}=await fixture(t);
  const found=await request('/auth/forgot-password','POST',{email:'recuperacion@example.invalid'},null);state.missing=true;
  const absent=await request('/auth/forgot-password','POST',{email:'otra@example.invalid'},null);
  assert.equal(found.status,202);assert.deepEqual(found,absent);assert.equal(state.sent.length,1);
  const link=new URL(state.sent[0].link);assert.equal(link.search,'');const token=new URLSearchParams(link.hash.slice(1)).get('token');
  const claims=jwt.decode(token);assert.equal(claims.exp-claims.iat,900);assert.ok(!JSON.stringify(found).includes(token));
});
test('recuperación: valida correo y no depende del consentimiento deportivo',async t=>{
  const {request,state}=await fixture(t);assert.equal((await request('/auth/forgot-password','POST',{email:'no-es-email'},null)).status,400);assert.equal(state.sent.length,0);
});
test('recuperación: sin transporte configurado no simula un envío exitoso',async t=>{
  const {request,state}=await fixture(t);t.mock.method(recoveryDelivery,'configured',()=>false);
  assert.equal((await request('/auth/forgot-password','POST',{email:'recuperacion@example.invalid'},null)).status,503);assert.equal(state.sent.length,0);
});
test('recuperación: guarda solo hash, invalida sesiones y no inicia sesión automáticamente',async t=>{
  const {request,state,user}=await fixture(t);const oldSession=jwt.decode(sessionToken(user)),token=createResetToken(user);
  const response=await request('/auth/reset-password','POST',{token,password:'NuevaClave123!'},null);
  assert.equal(response.status,200);assert.equal(response.data.token,undefined);assert.equal(state.writes.length,1);
  assert.equal(state.writes[0].password,undefined);assert.equal(await bcrypt.compare('NuevaClave123!',user.passwordHash),true);
  assert.equal(await bcrypt.compare('Anterior123!',user.passwordHash),false);assert.equal(credentialsMatch(user,oldSession),false);
  assert.equal(credentialsMatch(user,{sub:user.id}),false);assert.equal(credentialsMatch(user,jwt.decode(sessionToken(user))),true);
});
test('recuperación: un enlace solo permite un cambio aunque se repita la contraseña',async t=>{
  const {user,state}=await fixture(t);const token=createResetToken(user);await resetPassword(token,'Anterior123!');
  await assert.rejects(resetPassword(token,'OtraClave123!'),/venció|utilizado/);assert.equal(state.writes.length,1);
});
test('recuperación: dos consumos simultáneos solo guardan una vez',async t=>{
  const {user,state}=await fixture(t);const token=createResetToken(user);
  const outcomes=await Promise.allSettled([resetPassword(token,'NuevaClave123!'),resetPassword(token,'OtraClave123!')]);
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);assert.equal(state.writes.length,1);
});
test('recuperación: rechaza enlaces vencidos o firmados para iniciar sesión',async t=>{
  const {user,state}=await fixture(t);for(const token of [createResetToken(user,-1),sessionToken(user),'token-malformado'])await assert.rejects(resetPassword(token,'NuevaClave123!'),/venció|utilizado/);assert.equal(state.writes.length,0);
});
test('recuperación: cuenta archivada no permite restablecer',async t=>{
  const {user,state}=await fixture(t);const token=createResetToken(user);state.missing=true;await assert.rejects(resetPassword(token,'NuevaClave123!'));assert.equal(state.writes.length,0);
});
test('recuperación: contraseña corta o demasiado larga se rechaza antes de guardar',async t=>{
  const {request,state,user}=await fixture(t);for(const password of ['123','a'.repeat(73),'🔑'.repeat(20)])assert.equal((await request('/auth/reset-password','POST',{token:createResetToken(user),password},null)).status,400);
  assert.equal(state.writes.length,0);assert.equal(newPassword.safeParse('ClaveValida123!').success,true);
});
test('recuperación: limitador aplica espera, cuota y no almacena correos en claro',()=>{
  let now=1000000;const limiter=new RecoveryLimiter(()=>now);assert.equal(limiter.allow('ana@example.invalid'),true);assert.equal(limiter.allow('ANA@example.invalid'),false);
  now+=61000;assert.equal(limiter.allow('ana@example.invalid'),true);now+=61000;assert.equal(limiter.allow('ana@example.invalid'),true);now+=61000;assert.equal(limiter.allow('ana@example.invalid'),false);
  assert.ok(!JSON.stringify([...limiter.entries.keys()]).includes('ana@'));now+=16*60000;assert.equal(limiter.allow('ana@example.invalid'),true);
});
test('recuperación: formulario público protege el enlace y no requiere JWT',async t=>{
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/reset-password`);const html=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(html,/location.hash/);assert.match(html,/history.replaceState/);assert.match(html,/Las contraseñas no coinciden/);
});
test('recuperación: limita intentos de reset sin conservar el enlace original',()=>{
  let now=1000000;const limiter=new ResetAttemptLimiter(()=>now);for(let i=0;i<10;i++)assert.equal(limiter.allow('enlace-de-prueba'),true);assert.equal(limiter.allow('enlace-de-prueba'),false);assert.ok(!JSON.stringify([...limiter.entries.keys()]).includes('enlace-de-prueba'));now+=16*60000;assert.equal(limiter.allow('enlace-de-prueba'),true);
});
test('recuperación: el middleware rechaza sesiones anteriores al cambio de contraseña',async t=>{
  const user={id:randomUUID(),email:'sesion@example.invalid',passwordHash:'hash-anterior',passwordChangedAt:null};
  const claims=jwt.decode(sessionToken(user));t.mock.method(User,'findByPk',async()=>user);
  user.passwordHash='hash-nuevo';user.passwordChangedAt=new Date();
  const state={status:null,next:0};const res={status(value){state.status=value;return this;},json(){return this;}};
  await requireActiveAccount({auth:claims},res,()=>state.next++);assert.equal(state.status,401);assert.equal(state.next,0);
  await requireActiveAccount({auth:jwt.decode(sessionToken(user))},res,()=>state.next++);assert.equal(state.next,1);
});
test('recuperación: el enlace de cambio nunca funciona como un JWT de sesión',async t=>{
  const {user}=await fixture(t);assert.throws(()=>jwt.verify(createResetToken(user),config.jwtSecret));
});
