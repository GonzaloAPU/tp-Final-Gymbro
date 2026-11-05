import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseDiagnostic} from '../src/database-diagnostic.js';
for(const [code,label]of [['SELF_SIGNED_CERT_IN_CHAIN','DB_TLS'],['28P01','DB_AUTH'],['42501','DB_PERMISSIONS'],['ENOTFOUND','DB_DNS'],['ETIMEDOUT','DB_NETWORK']])test(`diagnóstico: ${code} sin revelar secretos`,()=>{
  const output=databaseDiagnostic({parent:{code,message:'postgresql://secret:private-password@example/db'}});
  assert.ok(output.startsWith(label));assert.ok(!output.includes('private-password'));assert.ok(!output.includes('postgresql://'));
});
test('diagnóstico: reconoce error del pooler',()=>assert.match(databaseDiagnostic({original:{message:'Tenant or user not found'}}),/^DB_POOLER/));
test('diagnóstico: error desconocido no publica mensaje ni SQL',()=>{const output=databaseDiagnostic({message:'private-password SELECT secret FROM users'});assert.match(output,/^DB_CONNECTION/);assert.ok(!output.includes('private-password'));assert.ok(!output.includes('SELECT'));});
