/** Verificación aislada de JWT, sin servidor ni base de datos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {config} from '../src/config.js';
import {requireAuth} from '../src/middleware/auth.js';
function run(authorization) {
  const req={headers:{authorization}};
  const result={next:0,status:undefined,body:undefined};
  const res={status(value){result.status=value;return this;},json(value){result.body=value;return this;}};
  requireAuth(req,res,()=>{result.next++;});
  return {...result,auth:req.auth};
}
const denied=header=>{const result=run(header);assert.equal(result.status,401);assert.equal(result.next,0);assert.equal(result.auth,undefined);};
test('JWT: rechaza una solicitud sin Authorization',()=>denied(undefined));
test('JWT: rechaza Bearer sin token',()=>denied('Bearer '));
test('JWT: rechaza tokens malformados',()=>denied('Bearer no.es.jwt'));
test('JWT: rechaza una firma de otro secreto',()=>denied(`Bearer ${jwt.sign({sub:'owner'},'a-different-test-key')}`));
test('JWT: rechaza un token vencido',()=>denied(`Bearer ${jwt.sign({sub:'owner'},config.jwtSecret,{expiresIn:-60})}`));
test('JWT: rechaza un token cuya vigencia no comenzó',()=>denied(`Bearer ${jwt.sign({sub:'owner',nbf:Math.floor(Date.now()/1000)+3600},config.jwtSecret)}`));
test('JWT: permite un token válido y conserva su usuario',()=>{const result=run(`Bearer ${jwt.sign({sub:'owner'},config.jwtSecret)}`);assert.equal(result.next,1);assert.equal(result.auth.sub,'owner');assert.equal(result.status,undefined);});
test('JWT: acepta el esquema bearer en minúsculas',()=>{const result=run(`bearer ${jwt.sign({sub:'owner'},config.jwtSecret)}`);assert.equal(result.next,1);assert.equal(result.auth.sub,'owner');});
test('JWT: exige Bearer incluso con firma válida',()=>denied(jwt.sign({sub:'owner'},config.jwtSecret)));
test('JWT: rechaza algoritmos distintos de HS256',()=>denied(`Bearer ${jwt.sign({sub:'owner'},config.jwtSecret,{algorithm:'HS384'})}`));
test('JWT: exige identificador de usuario',()=>{for(const claims of [{},{sub:''},{sub:'   '}])denied(`Bearer ${jwt.sign(claims,config.jwtSecret)}`);});
