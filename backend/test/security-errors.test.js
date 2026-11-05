import test from 'node:test';
import assert from 'node:assert/strict';
import {errorHandler} from '../src/middleware/error-handler.js';
function handle(t,error){
  let body,status,logs;
  t.mock.method(console,'error',(...args)=>{logs=args;});
  errorHandler(error,{}, {status(value){status=value;return this;},json(value){body=value;}},()=>{});
  return {body,status,logs};
}
test('seguridad: errores internos y logs no exponen consultas ni parámetros',t=>{
  const error=Object.assign(Error('FAKE_DATABASE_SECRET'),{sql:'SELECT FAKE_PRIVATE_DATA',parameters:{password:'FAKE_PASSWORD'}});
  const result=handle(t,error);assert.equal(result.status,500);
  assert.ok(!JSON.stringify(result).includes('FAKE_'));
});
test('seguridad: JSON inválido no refleja su contenido en el mensaje',t=>{
  const result=handle(t,Object.assign(Error('FAKE_PRIVATE_PAYLOAD'),{type:'entity.parse.failed',status:400}));
  assert.equal(result.status,400);assert.ok(!JSON.stringify(result).includes('FAKE_'));
});
test('seguridad: validación SQL no devuelve instancia ni valor privado',t=>{
  const result=handle(t,{name:'SequelizeValidationError',errors:[{path:'name',value:'FAKE_PRIVATE_VALUE',message:'FAKE_PRIVATE_MESSAGE',instance:{secret:'FAKE_SECRET'}}]});
  assert.equal(result.status,400);assert.ok(!JSON.stringify(result).includes('FAKE_'));
});
