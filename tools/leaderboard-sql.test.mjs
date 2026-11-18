import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {leaderboardSql} from '../backend/src/services/leaderboard.js';
const db=new PGlite();after(()=>db.close());
await db.exec(`CREATE TABLE users(id text,name text,leaderboard_opt_in boolean,deleted_at timestamptz);
CREATE TABLE exercises(id text,name text,created_by_user_id text,deleted_at timestamptz);
CREATE TABLE training_sessions(id text,user_id text,status text,deleted_at timestamptz);
CREATE TABLE performed_exercises(id text,session_id text,exercise_id text,deleted_at timestamptz);
CREATE TABLE performed_sets(id text,performed_exercise_id text,weight_kg numeric,repetitions int,completed_at timestamptz,deleted_at timestamptz);
INSERT INTO users VALUES ('a','Ana',true,NULL),('b','Bruno',true,NULL),('private','Privado',false,NULL);
INSERT INTO exercises VALUES ('s1','Sentadilla',NULL,NULL),('s2','Sentadilla goblet',NULL,NULL),('b1','Press banca',NULL,NULL),('b2','Press inclinado con mancuernas',NULL,NULL),('d1','Peso muerto convencional',NULL,NULL),('d2','Peso muerto rumano',NULL,NULL),('shoulder','Press militar',NULL,NULL),('custom','Sentadilla personal','a',NULL);
INSERT INTO training_sessions VALUES ('a','a','COMPLETED',NULL),('b','b','COMPLETED',NULL),('private','private','COMPLETED',NULL),('active','a','ACTIVE',NULL);
INSERT INTO performed_exercises SELECT e.id||s.id,s.id,e.id,NULL FROM exercises e CROSS JOIN training_sessions s;
INSERT INTO performed_sets SELECT pe.id,pe.id,CASE WHEN s.id IN ('private','active') OR e.id IN ('shoulder','custom') THEN 999 WHEN e.id IN ('s2','b2','d2') THEN 80 ELSE 60 END,5,'2026-01-01',NULL FROM performed_exercises pe JOIN exercises e ON e.id=pe.exercise_id JOIN training_sessions s ON s.id=pe.session_id;`);
const sql=leaderboardSql({sets:'performed_sets',performed:'performed_exercises',exercises:'exercises',sessions:'training_sessions',users:'users'});
test('ranking: agrupa variantes y conserva una marca por usuario en cada familia',async()=>{
 const {rows}=await db.query(sql);assert.equal(rows.length,6);
 for(const family of ['bench','squat','deadlift']){const group=rows.filter(r=>r.category===family);assert.equal(group.length,2);assert.ok(group.every(r=>Number(r.weightKg)===80&&Number(r.rank)===1));}
 assert.equal(rows.find(r=>r.category==='deadlift').exerciseName,'Peso muerto rumano');
 assert.equal(rows.find(r=>r.category==='bench').exerciseName,'Press inclinado con mancuernas');
 assert.equal(rows.find(r=>r.category==='squat').exerciseName,'Sentadilla goblet');
});
test('ranking: no publica cuentas privadas, sesiones activas ni ejercicios ajenos al grupo o personalizados',async()=>{
 const {rows}=await db.query(sql);assert.ok(rows.every(r=>['a','b'].includes(r.userId)&&Number(r.weightKg)<999));
});
