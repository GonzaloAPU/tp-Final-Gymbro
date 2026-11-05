/** Verifica el límite en la API, aunque se evite el botón del frontend. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {httpClient} from '../test-support/http.js';
import {sequelize} from '../src/db.js';
import {User,Exercise,WelcomePlan} from '../src/models/index.js';
import {exerciseData} from '../src/data/exercise-catalog.js';
import {aiQuota} from '../src/services/ai-quota.js';

test('cupo API: bloquea cuarta generación, exige bloqueo de fila y permite plan local sin descontar',async t=>{
 const oldEnabled=process.env.GEMINI_ENABLED,oldKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_ENABLED='true';process.env.GEMINI_API_KEY='fake-test-key';
 t.after(()=>{for(const [k,v]of [['GEMINI_ENABLED',oldEnabled],['GEMINI_API_KEY',oldKey]])if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const transaction={LOCK:{UPDATE:'UPDATE'}};
 const row={aiWeekStart:aiQuota({}).weekStart,aiWeeklyUsed:3,update:()=>assert.fail('No descontar')};
 t.mock.method(sequelize,'transaction',async fn=>fn(transaction));
 t.mock.method(User,'findByPk',async(id,options)=>{assert.equal(id,'owner');assert.equal(options.lock,'UPDATE');return row;});
 t.mock.method(Exercise,'findAll',async()=>exerciseData.map(e=>({...e,id:randomUUID()})));
 t.mock.method(WelcomePlan,'findOne',async()=>null);
 t.mock.method(WelcomePlan,'create',async values=>values);
 const realFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',(url,options)=>{if(String(url).includes('generativelanguage.googleapis.com'))assert.fail('No consultar proveedor cuando no queda cupo');return realFetch(url,options);});
 const input={age:30,heightCm:170,weightKg:70,goal:'GENERAL',experience:'BEGINNER',place:'HOME',equipment:[],sessions:3,minutes:45,availability:[1,3,5].map(weekday=>({weekday,start:'18:00',end:'19:00'})),hasRestrictions:false,mode:'GEMINI',aiConsent:true};
 const request=await httpClient(t);
 const denied=await request('/welcome/preview','POST',input);assert.equal(denied.status,429);assert.match(denied.data.message,/3 generaciones/);
 const local=await request('/welcome/preview','POST',{...input,mode:'LOCAL',aiConsent:false});assert.equal(local.status,200);assert.equal(local.data.source,'LOCAL');assert.equal(row.aiWeeklyUsed,3);
});
