import test from 'node:test';
import assert from 'node:assert/strict';
import {aiQuota,consumeAiGeneration} from '../src/services/ai-quota.js';
const monday=new Date('2026-10-26T03:00:00Z');
function user(values={}){return {...values,async update(patch){Object.assign(this,patch);}};}
test('cupo IA: semana argentina cambia exactamente el lunes a medianoche',()=>{
 const row={aiWeekStart:'2026-10-19T03:00:00Z',aiWeeklyUsed:3};
 assert.equal(aiQuota(row,new Date('2026-10-26T02:59:59Z')).remaining,0);
 const next=aiQuota(row,monday);assert.equal(next.remaining,3);assert.equal(next.resetsAt,'2026-11-02T03:00:00.000Z');
});
test('cupo IA: tres éxitos y cuarto rechazado antes de llamar al proveedor',async()=>{
 const row=user();let calls=0;
 for(let i=0;i<3;i++)await consumeAiGeneration(row,{},async()=>++calls,monday);
 await assert.rejects(consumeAiGeneration(row,{},async()=>++calls,monday),e=>e.status===429);
 assert.equal(calls,3);assert.equal(aiQuota(row,monday).remaining,0);
});
test('cupo IA: error del proveedor no consume y otro usuario conserva su cupo',async()=>{
 const row=user();await assert.rejects(consumeAiGeneration(row,{},async()=>{throw Error('caída');},monday));
 assert.equal(aiQuota(row,monday).remaining,3);
 await consumeAiGeneration(row,{},async()=>({}),monday);
 assert.equal(aiQuota(row,monday).remaining,2);assert.equal(aiQuota(user(),monday).remaining,3);
});
test('cupo IA: consumo persiste al reconstruir la instancia y se renueva en mes/año nuevos',()=>{
 const row=JSON.parse(JSON.stringify({aiWeekStart:monday,aiWeeklyUsed:3}));assert.equal(aiQuota(row,monday).remaining,0);
 assert.equal(aiQuota(row,new Date('2027-01-04T03:00:00Z')).remaining,3);
});
