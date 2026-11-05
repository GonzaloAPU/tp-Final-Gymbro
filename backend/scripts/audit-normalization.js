/** Guarda solo huellas y comprueba que la migración conserve los registros y su significado. */
import 'dotenv/config';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sequelize} from '../src/db.js';
const path=new URL('../../backups/normalization-audit-2026-10-20.json',import.meta.url);
const tables=['users','exercises','routines','routine_days','routine_exercises','routine_schedules','training_sessions','performed_exercises','performed_sets','body_weight_histories','strength_records'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mode=process.argv[2];
try {
  assert.ok(['before','after'].includes(mode));
  const snapshot={};
  const raw={};
  for(const table of tables) {
    const [rows]=await sequelize.query(`SELECT * FROM ${table} ORDER BY id`);
    raw[table]=rows;
    snapshot[table]=Object.fromEntries(rows.map(row=>{
      const copy={...row};
      if(table==='users') {delete copy.current_kg;delete copy.rest_days;}
      if(table==='routine_days') delete copy.schedule;
      if(table==='exercises') {delete copy.normalized_name;delete copy.created_by_user_id;}
      return [row.id,hash(copy)];
    }));
  }
  if(mode==='before') {
    snapshot.profiles=Object.fromEntries(raw.users.map(user=>[user.id,hash({
      restDays:[...(user.rest_days||[])].sort(),
      currentKg:user.current_kg == null ? null : Number(user.current_kg)
    })]));
    fs.mkdirSync(new URL('../../backups/',import.meta.url),{recursive:true});
    fs.writeFileSync(path,JSON.stringify(snapshot,null,2));
    console.log('Huellas previas guardadas; no se imprimen datos personales.');
  } else {
    const before=JSON.parse(fs.readFileSync(path,'utf8'));
    for(const table of tables) {
      for(const [id,digest] of Object.entries(before[table])) assert.equal(snapshot[table][id],digest,`Registro alterado en ${table}`);
      if(table!=='body_weight_histories') assert.equal(Object.keys(snapshot[table]).length,Object.keys(before[table]).length,`Cantidad alterada en ${table}`);
    }
    const [rest]=await sequelize.query('SELECT user_id,weekday FROM user_rest_days');
    for(const user of raw.users) {
      const weights=raw.body_weight_histories.filter(row=>row.user_id===user.id).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));
      assert.equal(hash({restDays:rest.filter(row=>row.user_id===user.id).map(row=>row.weekday).sort(),currentKg:weights[0]?Number(weights[0].weight_kg):null}),before.profiles[user.id], 'No coincide el perfil migrado');
    }
    console.log('OK: se conservaron todos los registros originales, perfiles, pesos actuales y descansos.');
  }
} finally {await sequelize.close();}
