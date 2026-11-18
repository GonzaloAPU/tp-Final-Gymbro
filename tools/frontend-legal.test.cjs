const test=require('node:test'),assert=require('node:assert/strict');
const {of,throwError,Subject}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
function register(){
  const state={sent:[],routes:[]};
  const {RegisterComponent}=loadComponent('frontend/src/app/components/register.component.ts',{auth:{register:body=>{state.sent.push(body);return of({});}},router:{navigateByUrl:path=>state.routes.push(path)}});
  const screen=new RegisterComponent();
  return {screen,state,submit:()=>screen.submit({preventDefault(){}},'Ana','ana@example.test','Password1!','Password1!')};
}
test('legal UI: todas las casillas empiezan sin marcar',()=>{const {screen}=register();for(const field of ['terms','privacy','adult','sports'])assert.equal(screen[field](),false);});
for(const missing of ['terms','privacy','adult'])test('legal UI: exige '+missing+' antes del registro',()=>{const {screen,state,submit}=register();for(const field of ['terms','privacy','adult'])screen[field].set(field!==missing);submit();assert.equal(state.sent.length,0);assert.ok(screen.error());});
test('legal UI: permiso deportivo es opcional y no fuerza la bienvenida',()=>{const {screen,state,submit}=register();for(const field of ['terms','privacy','adult'])screen[field].set(true);submit();assert.equal(state.sent[0].legal.sportsDataConsent,false);assert.equal(state.routes[0],'/perfil');});
function guard(status,cache=null,error=false){
  const {legalGuard}=loadComponent('frontend/src/app/guards/legal.guard.ts',{legal:{status:()=>error?throwError(()=>Error('offline')):of(status),cachedStatus:()=>cache},router:{createUrlTree:path=>path[0]}});
  return legalGuard;
}
test('legal guard: cuenta antigua va a leer los documentos',async()=>assert.equal(await guard({needsAcceptance:true})({data:{}}),'/consentimiento'));
test('legal guard: no habilita entrenar sin permiso deportivo',async()=>assert.equal(await guard({needsAcceptance:false,sportsDataConsent:false})({data:{sports:true}}),'/consentimiento'));
test('legal guard: permite consultar perfil sin permiso deportivo',async()=>assert.equal(await guard({needsAcceptance:false,sportsDataConsent:false})({data:{}}),true));
test('legal guard: sin conexión ni comprobación previa no inventa aceptación',async()=>assert.equal(await guard(null,null,true)({data:{}}),'/consentimiento'));
test('legal guard: recupera entrenamiento sin conexión con estado previamente confirmado',async()=>assert.equal(await guard(null,{needsAcceptance:false,sportsDataConsent:true},true)({data:{sports:true}}),true));
test('legal guard: un permiso recién autorizado reemplaza un rechazo antiguo de la caché',async()=>assert.equal(await guard({needsAcceptance:false,sportsDataConsent:true},{needsAcceptance:false,sportsDataConsent:false})({data:{sports:true}}),true));
test('legal guard: recibo confirmado permite entrar sin esperar al servidor',async()=>{
  const pending=new Subject();let calls=0;
  const {legalGuard}=loadComponent('frontend/src/app/guards/legal.guard.ts',{legal:{status:()=>{calls++;return pending;},cachedStatus:()=>({needsAcceptance:false,sportsDataConsent:true})},router:{createUrlTree:path=>path[0]}});
  assert.equal(await legalGuard({data:{sports:true}}),true);assert.equal(calls,1);pending.complete();
});
function privacyFixture(status,error=null){
  const state={writes:[],user:{leaderboardOptIn:false}};
  const legal={cachedStatus:()=>status,status:()=>of(status)};
  const auth={user:()=>state.user,updateProfile:body=>{state.writes.push(body);if(error)return throwError(()=>error);state.user={...state.user,...body};return of(state.user);}};
  const {PrivacySettingsComponent}=loadComponent('frontend/src/app/components/privacy-settings.component.ts',{auth,legal});
  return {screen:new PrivacySettingsComponent(),state};
}
test('privacidad: sin permiso deportivo explica el requisito y no envía PATCH',async()=>{
  const {screen,state}=privacyFixture({needsAcceptance:false,sportsDataConsent:false});const input={checked:true};
  await screen.toggle(input);assert.equal(state.writes.length,0);assert.equal(screen.consentRequired(),true);assert.equal(input.checked,false);assert.equal(screen.saving(),false);
});
test('privacidad: con permisos confirmados habilita el ranking',async()=>{
  const {screen,state}=privacyFixture({needsAcceptance:false,sportsDataConsent:true});await screen.toggle({checked:true});assert.equal(state.writes.length,1);assert.equal(state.user.leaderboardOptIn,true);assert.match(screen.message(),/habilitada/);
});
test('privacidad: 428 identifica consentimiento y no lo presenta como conexión',async()=>{
  const {screen}=privacyFixture({needsAcceptance:false,sportsDataConsent:true},{status:428,error:{code:'SPORTS_CONSENT_REQUIRED',message:'Autorizá el tratamiento de datos deportivos.'}});const input={checked:true};
  await screen.toggle(input);assert.equal(input.checked,false);assert.equal(screen.consentRequired(),true);assert.match(screen.message(),/Autorizá/);assert.doesNotMatch(screen.message(),/conexión/);
});
test('privacidad: permite salir del ranking aunque se haya retirado el permiso deportivo',async()=>{
  const {screen,state}=privacyFixture({needsAcceptance:false,sportsDataConsent:false});state.user.leaderboardOptIn=true;await screen.toggle({checked:false});assert.equal(state.writes.length,1);assert.equal(state.user.leaderboardOptIn,false);
});
