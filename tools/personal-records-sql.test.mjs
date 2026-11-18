/** Ejecuta el cálculo real de marcas en PostgreSQL embebido, sin datos externos. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {personalRecordsSql} from '../backend/src/services/personal-records.js';
const db=new PGlite();after(()=>db.close());
await db.exec(`CREATE TABLE exercises(id text,name text,training_type text,deleted_at timestamptz);
CREATE TABLE training_sessions(id text,user_id text,status text,deleted_at timestamptz);
CREATE TABLE performed_exercises(id text,session_id text,exercise_id text,deleted_at timestamptz);
CREATE TABLE performed_sets(id text,performed_exercise_id text,weight_kg numeric,repetitions int,completed_at timestamptz,deleted_at timestamptz);
INSERT INTO exercises VALUES ('squat','Sentadilla','POWER',NULL),('personal','Mi ejercicio','POWER',now()),('bike','Bicicleta','AEROBIC',NULL);
INSERT INTO training_sessions VALUES ('finished','owner','COMPLETED',NULL),('active','owner','ACTIVE',NULL),('other','other','COMPLETED',NULL),('deleted','owner','COMPLETED',now());
INSERT INTO performed_exercises VALUES ('own','finished','squat',NULL),('ongoing','active','squat',NULL),('foreign','other','squat',NULL),('archived','deleted','squat',NULL),('deleted-exercise','finished','squat',now()),('custom','finished','personal',NULL),('cardio','finished','bike',NULL);
INSERT INTO performed_sets VALUES
('old','own',70,30,'2026-01-01',NULL),('best','own',80,3,'2026-01-02',NULL),('same-later','own',80,3,'2026-01-03',NULL),('fewer-reps','own',80,1,'2026-01-01',NULL),
('not-finished','ongoing',900,1,'2026-01-01',NULL),('not-owner','foreign',1000,1,'2026-01-01',NULL),('deleted-session','archived',1000,1,'2026-01-01',NULL),('deleted-pe','deleted-exercise',1000,1,'2026-01-01',NULL),('deleted-set','own',1000,1,'2026-01-01',now()),
('no-load','own',0,20,'2026-01-01',NULL),('no-reps','own',1000,0,'2026-01-01',NULL),('custom-set','custom',50,8,'2026-01-01',NULL),('cardio-set','cardio',1000,10,'2026-01-01',NULL);`);
const sql=personalRecordsSql({sets:'performed_sets',performed:'performed_exercises',sessions:'training_sessions',exercises:'exercises'}).replaceAll(':userId',()=>'$1');
test('marcas: mayor carga real, desempate estable y todas las sesiones históricas',async()=>{
  const {rows}=await db.query(sql,['owner']);
  assert.equal(rows.length,2);assert.equal(rows[0].id,'best');assert.equal(Number(rows[0].maxWeightKg),80);
  assert.equal(rows[0].repetitions,3);assert.equal(rows[0].exercise.name,'Sentadilla');
});
test('marcas: usuario distinto no recibe datos ajenos',async()=>{
  assert.deepEqual((await db.query(sql,['new-account'])).rows,[]);
  const {rows}=await db.query(sql,['other']);assert.equal(rows.length,1);assert.equal(rows[0].id,'not-owner');
});
test('marcas: ejercicios propios archivados conservan sus marcas históricas',async()=>{
  const {rows}=await db.query(sql,['owner']);assert.ok(rows.some(row=>row.exercise.name==='Mi ejercicio'));
  assert.ok(rows.every(row=>!['not-finished','not-owner','deleted-session','deleted-pe','deleted-set','no-load','no-reps','cardio-set'].includes(row.id)));
});
