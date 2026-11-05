import {legalAccess} from '../src/services/legal.js';
/** Servidor temporal para pruebas de rutas; los modelos se simulan en cada caso. */
import jwt from 'jsonwebtoken';
import {app} from '../src/app.js';
import {config} from '../src/config.js';
import {accountAccess} from '../src/middleware/active-account.js';

export async function httpClient(t) {
  t.mock.method(accountAccess,'isActive',async()=>true);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:true}));
  t.mock.method(console,'error',()=>{});
  const server=app.listen(0,'127.0.0.1');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  await new Promise(resolve=>server.once('listening',resolve));
  return async (path,method='GET',body,user='owner')=>{
    const headers={'Content-Type':'application/json'};
    if(user) headers.Authorization=`Bearer ${jwt.sign({sub:user},config.jwtSecret)}`;
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
}
