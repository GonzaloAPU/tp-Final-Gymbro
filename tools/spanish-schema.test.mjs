/** Ejecuta la traducción sobre una copia con datos y permisos, nunca sobre Supabase. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {spanishTables} from '../backend/src/services/database-names.js';
import {personalRecordsSql} from '../backend/src/services/personal-records.js';
import {leaderboardSql} from '../backend/src/services/leaderboard.js';
const db=new PGlite();after(()=>db.close());
const read=name=>fs.readFileSync(new URL(`../postgres/sql/${name}`,import.meta.url),'utf8');
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
await db.exec(read('01-bootstrap.sql'));
await db.exec(read('02-backend-role.sql').replace('REEMPLAZAR_POR_UNA_CONTRASENA_ALEATORIA','not-a-real-test-password-12345678901234567890'));
const user=randomUUID(),routine=randomUUID(),day=randomUUID(),session=randomUUID(),performed=randomUUID(),set=randomUUID();
const exercise=(await db.query("SELECT id FROM gymbro.exercises WHERE name='Sentadilla'")).rows[0].id;
await db.query("INSERT INTO gymbro.users(id,email,password_hash,name,created_at,updated_at,leaderboard_opt_in,ai_weekly_used) VALUES ($1,'copy@example.invalid','hash-preservado','Copia',now(),now(),true,2)",[user]);
await db.query("INSERT INTO gymbro.routines(id,user_id,name,goal,created_at) VALUES ($1,$2,'Rutina','Fuerza',now())",[routine,user]);
await db.query("INSERT INTO gymbro.routine_days(id,routine_id,name,day_number) VALUES ($1,$2,'Piernas',1)",[day,routine]);
await db.query("INSERT INTO gymbro.training_sessions(id,user_id,routine_day_id,status) VALUES ($1,$2,$3,'COMPLETED')",[session,user,day]);
await db.query('INSERT INTO gymbro.performed_exercises(id,session_id,exercise_id,"order") VALUES ($1,$2,$3,1)',[performed,session,exercise]);
await db.query('INSERT INTO gymbro.performed_sets(id,performed_exercise_id,set_number,weight_kg,repetitions,completed_at) VALUES ($1,$2,1,80,8,now())',[set,performed]);
const before=new Map();
for(const table of Object.keys(spanishTables))before.set(table,(await db.query(`SELECT * FROM gymbro.${table}`)).rows);
const foreignKeys=()=>db.query("SELECT c.oid,c.conrelid,c.confrelid FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='gymbro' AND c.contype='f' ORDER BY c.oid");
const fkBefore=(await foreignKeys()).rows;
const migration=read('08-nombres-espanol.sql');
await db.exec(migration);

test('español: 16 tablas reales, todas las filas y las 19 FK conservadas',async()=>{
 const actual=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'")).rows.map(r=>r.table_name).sort();
 assert.deepEqual(actual,Object.values(spanishTables).sort());
 for(const [name,rows]of before){
  const after=(await db.query(`SELECT * FROM gymbro.${name}`)).rows;
  if(name==='schema_migrations')assert.ok(rows.every(r=>after.some(a=>a.version===r.version)));
  else assert.deepEqual(after,rows,`Contenido de ${name}`);
 }
 assert.equal(fkBefore.length,19);assert.deepEqual((await foreignKeys()).rows,fkBefore);
});
test('español: repetir la migración no pierde datos ni duplica versiones',async()=>{
 await db.exec(migration);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM gymbro.usuarios')).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM gymbro.migraciones_esquema WHERE version='20261103_nombres_espanol'")).rows[0].n,1);
});
test('español: backend anterior escribe mediante vistas y el nuevo lee los mismos datos',async()=>{
 await db.exec('SET ROLE gymbro_backend');
 try{
  await db.query("UPDATE gymbro.users SET name='Actualizado' WHERE id=$1",[user]);
  const row=(await db.query('SELECT nombre,hash_contrasena,generaciones_ia_semana FROM gymbro.usuarios WHERE id=$1',[user])).rows[0];
  assert.deepEqual(row,{nombre:'Actualizado',hash_contrasena:'hash-preservado',generaciones_ia_semana:2});
  await assert.rejects(db.query('DELETE FROM gymbro.usuarios WHERE id=$1',[user]),/permission denied/);
  await assert.rejects(db.query('DELETE FROM gymbro.users WHERE id=$1',[user]),/permission denied/);
  await assert.rejects(db.query('UPDATE gymbro.legal_acceptances SET sports_data_consent=false'),/permission denied/);
 }finally{await db.exec('RESET ROLE');}
});
test('español: trigger del catálogo normaliza y sigue rechazando duplicados',async()=>{
 const id=randomUUID();
 await db.query("INSERT INTO gymbro.ejercicios(id,nombre,grupo_muscular,equipamiento,creado_por_usuario_id) VALUES ($1,'  Ejercicio Privado Á  ','Piernas','Mancuernas',$2)",[id,user]);
 assert.equal((await db.query('SELECT nombre_normalizado FROM gymbro.ejercicios WHERE id=$1',[id])).rows[0].nombre_normalizado,'ejercicio privado a');
 await assert.rejects(db.query("INSERT INTO gymbro.ejercicios(id,nombre,grupo_muscular,equipamiento) VALUES ($1,'SENTADILLA','Piernas','Barra')",[randomUUID()]),/ya existe/);
});
test('español: récords y ranking mantienen el contrato de la API',async()=>{
 const previous=process.env.DB_NAMES_LANGUAGE;process.env.DB_NAMES_LANGUAGE='es';
 try{
  const tables={sets:'gymbro.series_realizadas',performed:'gymbro.ejercicios_realizados',sessions:'gymbro.sesiones_entrenamiento',exercises:'gymbro.ejercicios',users:'gymbro.usuarios'};
  const records=(await db.query(personalRecordsSql(tables).replaceAll(':userId',()=>'$1'),[user])).rows;
  assert.equal(records[0].exercise.name,'Sentadilla');assert.equal(Number(records[0].maxWeightKg),80);
  const ranking=(await db.query(leaderboardSql(tables))).rows;
  assert.equal(ranking.length,1);assert.equal(ranking[0].category,'squat');assert.equal(ranking[0].name,'Actualizado');assert.equal(ranking[0].exerciseName,'Sentadilla');
 }finally{if(previous===undefined)delete process.env.DB_NAMES_LANGUAGE;else process.env.DB_NAMES_LANGUAGE=previous;}
});
test('español: SQL de Sequelize ejecuta JOIN reales y devuelve nombres de API previos',async()=>{
 const previous=process.env.DB_NAMES_LANGUAGE;
 process.env.DB_NAMES_LANGUAGE='es';process.env.DB_CONNECTION_MODE='LOCAL';process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
 const {User,Routine,RoutineDay}=await import('../backend/src/models/index.js');
 const {sequelize}=await import('../backend/src/db.js');
 const original=sequelize.query;
 await db.exec('SET search_path TO gymbro, public');
 sequelize.query=async(sql,options)=>{
  assert.equal(typeof sql,'string');return (await db.query(sql,options?.bind)).rows;
 };
 try{
  const users=await User.findAll({where:{id:user},raw:true});
  assert.equal(users[0].name,'Actualizado');assert.equal(users[0].aiWeeklyUsed,2);assert.equal(users[0].passwordHash,'hash-preservado');
  const routines=await Routine.findAll({where:{userId:user},include:[{model:RoutineDay,as:'days'}],raw:true});
  assert.equal(routines[0].userId,user);assert.equal(routines[0]['days.routineId'],routine);
 }finally{sequelize.query=original;await sequelize.close();await db.exec('RESET search_path');if(previous===undefined)delete process.env.DB_NAMES_LANGUAGE;else process.env.DB_NAMES_LANGUAGE=previous;}
});
test('español: faltan campos previos, la transacción revierte todos los renombres',async()=>{
 const copy=new PGlite();
 try{
  await copy.exec(read('01-bootstrap.sql'));
  await copy.exec('ALTER TABLE gymbro.users DROP COLUMN ai_week_start');
  await assert.rejects(copy.exec(migration),/Faltan campos de usuarios/);
  await copy.exec('ROLLBACK');
  const rows=(await copy.query("SELECT table_name FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'")).rows.map(r=>r.table_name).sort();
  assert.deepEqual(rows,Object.keys(spanishTables).sort());
  assert.equal((await copy.query('SELECT count(*)::int AS n FROM gymbro.exercises')).rows[0].n,190);
 }finally{await copy.close();}
});
test('español: nombres ambiguos se rechazan sin tocar las tablas existentes',async()=>{
 const copy=new PGlite();
 try{
  await copy.exec(read('01-bootstrap.sql'));await copy.exec('CREATE TABLE gymbro.usuarios(id integer)');
  await assert.rejects(copy.exec(migration),/Existen ambas tablas/);await copy.exec('ROLLBACK');
  assert.equal((await copy.query('SELECT count(*)::int AS n FROM gymbro.exercises')).rows[0].n,190);
  assert.equal((await copy.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'")).rows[0].n,17);
 }finally{await copy.close();}
});
