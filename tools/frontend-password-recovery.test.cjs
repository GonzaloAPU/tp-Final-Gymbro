const test=require('node:test'),assert=require('node:assert/strict');
const {Subject,of,throwError}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
function fixture(){const pending=new Subject(),sent=[];
  const auth={forgotPassword:email=>{sent.push(email);return pending;}};
  const {ForgotPasswordComponent}=loadComponent('frontend/src/app/components/forgot-password.component.ts',{auth});return {screen:new ForgotPasswordComponent(),auth,sent,pending};
}
test('recuperación UI: rechaza correo vacío sin llamar a la API',()=>{const {screen,sent}=fixture();screen.submit({preventDefault(){}},'');assert.equal(sent.length,0);assert.ok(screen.error());});
test('recuperación UI: limpia espacios, impide doble envío y muestra confirmación',()=>{const {screen,sent,pending}=fixture();screen.submit({preventDefault(){}},' ana@example.invalid ');screen.submit({preventDefault(){}},'ana@example.invalid');assert.deepEqual(sent,['ana@example.invalid']);assert.equal(screen.loading(),true);pending.next({message:'Revisá tu correo.'});pending.complete();assert.equal(screen.loading(),false);assert.equal(screen.sent(),true);assert.equal(screen.message(),'Revisá tu correo.');});
test('recuperación UI: error conserva correo y permite reintentar',()=>{const {screen,auth}=fixture();auth.forgotPassword=()=>throwError(()=>({error:{message:'Correo no configurado'}}));screen.submit({preventDefault(){}},'ana@example.invalid');assert.equal(screen.sent(),false);assert.equal(screen.loading(),false);assert.equal(screen.emailDraft(),'ana@example.invalid');assert.equal(screen.error(),'Correo no configurado');});
test('recuperación UI: pedir enlace no modifica la sesión del usuario',()=>{const {screen,auth}=fixture();let logouts=0;auth.logout=()=>logouts++;auth.forgotPassword=()=>of({message:'Revisá tu correo.'});screen.submit({preventDefault(){}},'ana@example.invalid');assert.equal(logouts,0);});
