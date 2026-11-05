import {legalAccess} from '../src/services/legal.js';
import {accountAccess} from '../src/middleware/active-account.js';
/** Prueba los handlers con modelos simulados: no lee ni escribe datos reales. */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {app} from '../src/app.js';
import {config} from '../src/config.js';
import {sequelize} from '../src/db.js';
import {User,UserRestDay,BodyWeightHistory,RoutineSchedule} from '../src/models/index.js';

test('perfil normalizado e historial corporal con dependencias simuladas', async t => {
  let days,weights,updates,conflicts;
  const reset=()=>{days=[2,4];weights=[{id:'baseline',weightKg:'70.00',recordedAt:'2025-01-01T12:00:00Z'}];updates=[];conflicts=0;};
  reset();
  const transaction={LOCK:{UPDATE:'UPDATE'}};
  const user={id:'owner',toJSON:()=>({id:'owner',name:'Ana',passwordHash:'secret-hash'}),update:async input=>updates.push(input)};
  t.mock.method(console,'error',()=>{});
  t.mock.method(sequelize,'transaction',async callback=>callback(transaction));
  t.mock.method(User,'findByPk',async()=>user);
  t.mock.method(UserRestDay,'findAll',async()=>days.map(weekday=>({weekday})));
  t.mock.method(UserRestDay,'destroy',async()=>{days=[];});
  t.mock.method(UserRestDay,'bulkCreate',async rows=>{days=rows.map(row=>row.weekday);});
  t.mock.method(RoutineSchedule,'count',async()=>conflicts);
  t.mock.method(BodyWeightHistory,'findOne',async()=>[...weights].sort((a,b)=>new Date(b.recordedAt)-new Date(a.recordedAt))[0]||null);
  t.mock.method(BodyWeightHistory,'create',async (input,options)=>{
    assert.equal(options.transaction,transaction);
    const row={id:`weight-${weights.length}`,recordedAt:new Date().toISOString(),...input};
    weights.push(row);return row;
  });
  t.mock.method(accountAccess,'isActive',async()=>true);
  t.mock.method(legalAccess,'status',async()=>({needsAcceptance:false,sportsDataConsent:true}));
  const server=app.listen(0,'127.0.0.1');
  t.after(()=>server.close());
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const request=async(path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({sub:'owner'},config.jwtSecret)}`},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };

  await t.test('el perfil deriva descansos y peso sin exponer el hash',async()=>{
    reset();const response=await request('/auth/me');
    assert.equal(response.status,200);assert.equal(response.data.currentKg,70);
    assert.deepEqual(response.data.restDays,[2,4]);assert.equal(response.data.passwordHash,undefined);
  });
  await t.test('sin mediciones devuelve peso nulo',async()=>{
    reset();weights=[];assert.equal((await request('/auth/me')).data.currentKg,null);
  });
  await t.test('quitar todos los descansos elimina sus filas sin volver a guardar el JSON',async()=>{
    reset();const response=await request('/auth/me','PATCH',{restDays:[]});
    assert.equal(response.status,200);assert.deepEqual(days,[]);
    assert.equal(updates[0].restDays,undefined);assert.equal(weights.length,1);
  });
  await t.test('editar el peso conserva las mediciones anteriores y no duplica el mismo valor',async()=>{
    reset();await request('/auth/me','PATCH',{currentKg:70});assert.equal(weights.length,1);
    const response=await request('/auth/me','PATCH',{currentKg:72});
    assert.equal(response.status,200);assert.equal(response.data.currentKg,72);
    assert.equal(weights.length,2);assert.equal(weights[0].weightKg,'70.00');
    assert.ok(updates.every(input=>input.currentKg===undefined));
  });
  await t.test('un descanso incompatible rechaza el cambio antes de escribir',async()=>{
    reset();conflicts=1;
    assert.equal((await request('/auth/me','PATCH',{restDays:[1]})).status,409);
    assert.deepEqual(days,[2,4]);assert.equal(updates.length,0);
  });
  await t.test('un pesaje anterior persiste sin reemplazar el peso actual',async()=>{
    reset();const response=await request('/progress/weight','POST',{weightKg:65,recordedAt:'2020-01-01T12:00:00Z'});
    assert.equal(response.status,201);assert.equal(weights.length,2);
    assert.equal(new Date(response.data.recordedAt).toISOString(),'2020-01-01T12:00:00.000Z');
    assert.equal((await request('/auth/me')).data.currentKg,70);
    assert.equal(updates.length,0);
  });
  await t.test('valores inválidos y fechas futuras no agregan mediciones',async()=>{
    reset();
    for(const body of [{weightKg:0},{weightKg:-1},{weightKg:501},{weightKg:70,recordedAt:'invalida'},{weightKg:70,recordedAt:new Date(Date.now()+86400000).toISOString()}]) {
      assert.equal((await request('/progress/weight','POST',body)).status,400);
    }
    assert.equal(weights.length,1);
  });
});
