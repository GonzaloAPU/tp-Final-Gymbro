import test from 'node:test';
import assert from 'node:assert/strict';
import {httpClient} from '../test-support/http.js';
import {LegalAcceptance,User,UserRestDay,BodyWeightHistory} from '../src/models/index.js';
import {sequelize} from '../src/db.js';
import {legalAccess,legalDocuments,legalInput,recordLegalAcceptance,withdrawSportsConsent} from '../src/services/legal.js';
const consent={version:legalDocuments.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:false};
test('legal: rechaza versión antigua, aceptación implícita y valores simulados',()=>{
  for(const input of [{},{...consent,version:'vieja'},{...consent,termsAccepted:false},{...consent,privacyAcknowledged:false},{...consent,adultConfirmed:false},{...consent,termsAccepted:'true'},{...consent,sportsDataConsent:undefined}])assert.equal(legalInput.safeParse(input).success,false);
  assert.equal(legalInput.safeParse(consent).success,true);
});
test('legal: documentos son públicos sin JWT ni consulta de cuenta',async t=>{
  const request=await httpClient(t);
  const response=await request('/legal/documents','GET',undefined,null);
  assert.equal(response.status,200);assert.equal(response.data.operator,'Envy11Estudio');assert.equal(response.data.hash.length,64);
});
test('legal: estado real no infiere aceptación para cuenta existente',async t=>{
  t.mock.method(LegalAcceptance,'findOne',async()=>null);
  assert.equal((await legalAccess.status('owner')).needsAcceptance,true);
});
test('legal: cambio de texto requiere nueva aceptación aunque coincida versión',async t=>{
  t.mock.method(LegalAcceptance,'findOne',async()=>({version:legalDocuments.version,documentHash:'distinto',sportsDataConsent:true}));
  assert.equal((await legalAccess.status('owner')).needsAcceptance,true);
});
test('legal: sin aceptación bloquea operaciones antes de tocar modelos',async t=>{
  const request=await httpClient(t);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:true,sportsDataConsent:false}));
  const response=await request('/routines');
  assert.equal(response.status,428);assert.equal(response.data.code,'LEGAL_ACCEPTANCE_REQUIRED');
});
test('legal: datos deportivos requieren permiso y no basta aceptar términos',async t=>{
  const request=await httpClient(t);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:false}));
  for(const [path,method,body] of [['/sessions','POST',{}],['/welcome/preview','POST',{}],['/progress/weight','POST',{}],['/auth/me','PATCH',{currentKg:65}],['/auth/me','PATCH',{leaderboardOptIn:true}]]){
    const response=await request(path,method,body);assert.equal(response.status,428);assert.equal(response.data.code,'SPORTS_CONSENT_REQUIRED');
  }
});
test('legal: registro sin consentimiento no crea usuarios',async t=>{
  const request=await httpClient(t);let created=0;
  t.mock.method(User,'create',async()=>{created++;});
  const response=await request('/auth/register','POST',{name:'Ana',email:'ana@example.test',password:'Password1!'});
  assert.equal(response.status,400);assert.equal(created,0);
});
test('legal: registro y recibo comparten transacción y datos públicos excluyen hash',async t=>{
  const request=await httpClient(t),tx={};let received;
  t.mock.method(sequelize,'transaction',async fn=>fn(tx));
  t.mock.method(User,'create',async(input,options)=>{assert.equal(options.transaction,tx);return {id:'owner',email:input.email,toJSON:()=>({...input,id:'owner'})};});
  t.mock.method(LegalAcceptance,'findOne',async()=>null);
  t.mock.method(LegalAcceptance,'create',async(input,options)=>{assert.equal(options.transaction,tx);received=input;return input;});
  t.mock.method(UserRestDay,'findAll',async()=>[]);t.mock.method(BodyWeightHistory,'findOne',async()=>null);
  const response=await request('/auth/register','POST',{name:'Ana',email:'ana@example.test',password:'Password1!',legal:consent});
  assert.equal(response.status,201);assert.equal(response.data.user.passwordHash,undefined);assert.equal(received.sportsDataConsent,false);assert.equal(received.documentHash,legalDocuments.hash);assert.ok(received.documents.privacy.length);
});
test('legal: error al guardar recibo no emite sesión de registro',async t=>{
  const request=await httpClient(t);
  t.mock.method(sequelize,'transaction',async fn=>fn({}));
  t.mock.method(User,'create',async()=>({id:'owner'}));t.mock.method(LegalAcceptance,'findOne',async()=>null);
  t.mock.method(LegalAcceptance,'create',async()=>{throw Error('Recibo no disponible');});
  const response=await request('/auth/register','POST',{name:'Ana',email:'ana@example.test',password:'Password1!',legal:consent});
  assert.equal(response.status,500);assert.equal(response.data.token,undefined);
});
test('legal: recibos sucesivos tienen fecha estrictamente creciente',async t=>{
  const prior=new Date(Date.now()+10000);let receipt;
  t.mock.method(LegalAcceptance,'findOne',async()=>({acceptedAt:prior}));
  t.mock.method(LegalAcceptance,'create',async input=>{receipt=input;});
  await recordLegalAcceptance('owner',consent,{});
  assert.ok(receipt.acceptedAt>prior);
});
test('legal: retirar consentimiento conserva versión anterior y despublica ranking',async t=>{
  const tx={LOCK:{UPDATE:'UPDATE'}},prior={id:'old',userId:'owner',version:'anterior',documentHash:'old-hash',documents:{terms:[]},termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true,acceptedAt:new Date()};let receipt,update;
  t.mock.method(sequelize,'transaction',async fn=>fn(tx));
  t.mock.method(User,'findByPk',async()=>({update:async input=>{update=input;}}));
  t.mock.method(LegalAcceptance,'findOne',async()=>({...prior,toJSON:()=>prior}));
  t.mock.method(LegalAcceptance,'create',async input=>{receipt=input;});
  await withdrawSportsConsent('owner');
  assert.equal(receipt.id,undefined);assert.equal(receipt.version,'anterior');assert.equal(receipt.sportsDataConsent,false);assert.deepEqual(update,{leaderboardOptIn:false});
});
