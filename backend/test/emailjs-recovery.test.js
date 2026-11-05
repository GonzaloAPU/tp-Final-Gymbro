import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDelivery} from '../src/services/password-recovery.js';
function configure(t){
  const keys=['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY'];
  const previous=keys.map(key=>process.env[key]);t.after(()=>keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];}));
  keys.forEach((key,index)=>process.env[key]=['service-test','template-test','public-test','private-test-only'][index]);
}
test('EmailJS: envía desde backend con plantilla, destinatario y clave privada',async t=>{
  configure(t);let request;
  t.mock.method(globalThis,'fetch',async(url,options)=>{request={url,options};return new Response('OK',{status:200});});
  await recoveryDelivery.send('destino@example.invalid','https://api.example.invalid/api/auth/reset-password#token=test-token');
  assert.equal(request.url,'https://api.emailjs.com/api/v1.0/email/send');const body=JSON.parse(request.options.body);
  assert.equal(body.service_id,'service-test');assert.equal(body.template_id,'template-test');assert.equal(body.user_id,'public-test');assert.equal(body.accessToken,'private-test-only');
  assert.equal(body.template_params.to_email,'destino@example.invalid');assert.equal(body.template_params.reset_token,'test-token');assert.equal(body.template_params.expires_minutes,15);
});
test('EmailJS: requiere configuración completa y no expone el error del proveedor',async t=>{
  configure(t);delete process.env.EMAILJS_PRIVATE_KEY;assert.equal(recoveryDelivery.configured(),false);process.env.EMAILJS_PRIVATE_KEY='private-test-only';
  t.mock.method(globalThis,'fetch',async()=>new Response('private-test-only',{status:403}));
  await assert.rejects(recoveryDelivery.send('destino@example.invalid','https://api.example.invalid/#token=test'),error=>{
    assert.equal(error.deliveryDiagnostic,'EmailJS HTTP 403: rechazo del proveedor');
    assert.ok(!JSON.stringify(error).includes('private-test-only'));return true;
  });
});

test('EmailJS: diagnostica solicitudes del servidor deshabilitadas sin revelar la respuesta',async t=>{
  configure(t);
  t.mock.method(globalThis,'fetch',async()=>new Response('API requests are disabled for non-browser applications: private-test-only',{status:403}));
  await assert.rejects(recoveryDelivery.send('destino@example.invalid','https://api.example.invalid/#token=test'),error=>{
    assert.equal(error.deliveryDiagnostic,'EmailJS HTTP 403: habilitar solicitudes desde el servidor en EmailJS');
    assert.ok(!JSON.stringify(error).includes('private-test-only'));return true;
  });
});
