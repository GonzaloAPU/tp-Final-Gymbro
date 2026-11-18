/** Ejecuta el SQL entregable en PostgreSQL embebido. No requiere cuenta ni conexiones externas. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {exerciseData} from '../backend/src/data/exercise-catalog.js';
const db=new PGlite();
after(()=>db.close());
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
const sql=fs.readFileSync(new URL('../postgres/sql/01-bootstrap.sql',import.meta.url),'utf8');
await db.exec(sql);
const roleSql=fs.readFileSync(new URL('../postgres/sql/02-backend-role.sql',import.meta.url),'utf8');
const user=randomUUID();
await db.query("INSERT INTO gymbro.users(id,email,password_hash,name,created_at,updated_at) VALUES ($1,'test@example.invalid','not-a-real-hash','Prueba',now(),now())",[user]);
test('Supabase: 16 tablas y 190 ejercicios oficiales',async()=>{
  const rows=(await db.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'")).rows;
  assert.equal(rows[0].total,16);
  const names=(await db.query('SELECT name FROM gymbro.exercises')).rows.map(e=>e.name).sort();
  assert.deepEqual(names,exerciseData.map(e=>e.name).sort());
});
test('Supabase: no copia datos personales al instalador',()=>{assert.ok(!sql.includes('passwordHash'));assert.ok(!/INSERT INTO [^;]*users/i.test(sql));assert.ok(!sql.includes('data:image/'));});
test('Supabase: ocho migraciones registradas',async()=>assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.schema_migrations')).rows[0].total,8));
test('Supabase: recuperación agrega columna sin modificar hashes y permite repetir migración',async()=>{
  const migration=fs.readFileSync(new URL('../postgres/sql/05-password-recovery.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  const saved=(await db.query('SELECT password_hash,password_changed_at FROM gymbro.users WHERE id=$1',[user])).rows[0];assert.equal(saved.password_hash,'not-a-real-hash');assert.equal(saved.password_changed_at,null);
});
test('Supabase: no modifica tablas de public',async()=>assert.equal((await db.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].total,0));

test('Supabase: guías completan datos faltantes y conservan ediciones al repetir',async()=>{
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.exercises WHERE description IS NOT NULL')).rows[0].total,190);
  const migration=fs.readFileSync(new URL('../postgres/sql/06-exercise-guides.sql',import.meta.url),'utf8');
  const original=(await db.query("SELECT description,video_url FROM gymbro.exercises WHERE name='Sentadilla'")).rows[0];
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.exercises WHERE video_url IS NOT NULL')).rows[0].total,190);
  await db.exec("UPDATE gymbro.exercises SET description='Guía editada',video_url='https://www.tiktok.com/@test/video/123' WHERE name='Sentadilla'; UPDATE gymbro.exercises SET description=NULL WHERE name='Press banca';");
  await db.exec(migration);await db.exec(migration);
  const saved=(await db.query("SELECT description,video_url FROM gymbro.exercises WHERE name='Sentadilla'")).rows[0];
  assert.equal(saved.description,'Guía editada');assert.equal(saved.video_url,'https://www.tiktok.com/@test/video/123');
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.exercises WHERE description IS NOT NULL')).rows[0].total,190);
  await db.query("UPDATE gymbro.exercises SET description=$1,video_url=$2 WHERE name='Sentadilla'",[original.description,original.video_url]);
});
test('Supabase: anon y authenticated no pueden acceder al esquema',async()=>{
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_schema_privilege($1,'gymbro','USAGE') AS allowed",[role])).rows[0].allowed,false);
});
test('Supabase: reejecutar aborta sin borrar registros',async()=>{await assert.rejects(db.exec(sql),/ya existe/);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.users')).rows[0].total,1);});
test('Supabase: contraseña de ejemplo no crea un usuario SQL',async()=>{await assert.rejects(db.exec(roleSql),/contraseña/);await db.exec('ROLLBACK');assert.equal((await db.query("SELECT count(*)::int AS total FROM pg_roles WHERE rolname='gymbro_backend'")).rows[0].total,0);});
test('Supabase: usuario backend puede operar pero no crear ni borrar tablas',async()=>{
  await db.exec(roleSql.replaceAll('REEMPLAZAR_POR_UNA_CONTRASENA_ALEATORIA','temporary-test-password-1234567890123456789'));
  await db.exec('SET ROLE gymbro_backend;SET search_path TO gymbro, public;');
  assert.equal((await db.query('SELECT count(*)::int AS total FROM exercises')).rows[0].total,190);
  await assert.rejects(db.exec('CREATE TABLE gymbro.forbidden(id int)'),/permission denied/);
  await assert.rejects(db.exec('DROP TABLE gymbro.welcome_plans'),/owner/);
  await assert.rejects(db.exec("INSERT INTO gymbro.schema_migrations(version) VALUES ('forbidden')"),/permission denied/);
  await db.query('UPDATE users SET gym_name=$1 WHERE id=$2',['Gimnasio de prueba',user]);
  assert.equal((await db.query('SELECT gym_name FROM users WHERE id=$1',[user])).rows[0].gym_name,'Gimnasio de prueba');
  await db.exec('RESET ROLE;');
});
test('Supabase: protege duplicados y normaliza ejercicios privados',async()=>{
  await db.exec('SET ROLE gymbro_backend;SET search_path TO gymbro, public;');
  await assert.rejects(db.query("INSERT INTO exercises(id,name,muscle_group,equipment,training_type) VALUES ($1,'  SENTADILLA  ','Piernas','Barra','POWER')",[randomUUID()]),/ya existe/);
  await db.query("INSERT INTO exercises(id,name,muscle_group,equipment,training_type,created_by_user_id) VALUES ($1,'  Mi ejercicio de PRUEBA  ','Core','Peso corporal','POWER',$2)",[randomUUID(),user]);
  assert.equal((await db.query('SELECT normalized_name FROM exercises WHERE created_by_user_id=$1',[user])).rows[0].normalized_name,'mi ejercicio de prueba');
  await db.exec('RESET ROLE;');
});
test('Supabase: FK y validación de días siguen activas',async()=>{
  await assert.rejects(db.query('INSERT INTO gymbro.user_rest_days(id,user_id,weekday) VALUES ($1,$2,9)',[randomUUID(),user]),/check constraint/);
  await assert.rejects(db.query('INSERT INTO gymbro.user_rest_days(id,user_id,weekday) VALUES ($1,$2,1)',[randomUUID(),randomUUID()]),/foreign key/);
});
test('Supabase: 10 tablas admiten borrado lógico',async()=>{
  const rows=(await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema='gymbro' AND column_name='deleted_at'")).rows;
  assert.equal(rows.length,10);
  assert.ok(!rows.some(row=>['routine_schedules','user_rest_days','session_mutations'].includes(row.table_name)));
});
test('Supabase: archivar una rutina conserva días e historial',async()=>{
  const routine=randomUUID(),day=randomUUID(),session=randomUUID();
  await db.query("INSERT INTO gymbro.routines(id,name,goal,created_at,user_id) VALUES ($1,'Plan','Fuerza',now(),$2)",[routine,user]);
  await db.query("INSERT INTO gymbro.routine_days(id,name,day_number,routine_id) VALUES ($1,'Día',1,$2)",[day,routine]);
  await db.query("INSERT INTO gymbro.training_sessions(id,user_id,routine_day_id,status) VALUES ($1,$2,$3,'COMPLETED')",[session,user,day]);
  await db.exec('SET ROLE gymbro_backend');
  await db.query('UPDATE gymbro.routines SET deleted_at=now() WHERE id=$1',[routine]);
  await assert.rejects(db.query('DELETE FROM gymbro.routines WHERE id=$1',[routine]),/permission denied/);
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.routine_days WHERE id=$1',[day])).rows[0].total,1);
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.training_sessions WHERE id=$1',[session])).rows[0].total,1);
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.routines WHERE id=$1 AND deleted_at IS NULL',[routine])).rows[0].total,0);
  await db.query('UPDATE gymbro.routines SET deleted_at=NULL WHERE id=$1',[routine]);
  assert.equal((await db.query('SELECT count(*)::int AS total FROM gymbro.routines WHERE id=$1 AND deleted_at IS NULL',[routine])).rows[0].total,1);
  await db.exec('RESET ROLE');
});
test('Supabase: migración incremental sirve para el instalador anterior y no pierde filas',async()=>{
  const old=new PGlite();
  try {
    // Reproduce la instalación previa: mismas tablas/datos, sin deleted_at ni versión nueva.
    await old.exec(sql);
    for(const table of ['users','exercises','routines','routine_days','routine_exercises','training_sessions','performed_exercises','performed_sets','body_weight_histories','strength_records'])await old.exec(`ALTER TABLE gymbro.${table} DROP COLUMN deleted_at`);
    await old.exec("DELETE FROM gymbro.schema_migrations WHERE version='20261022_soft_delete'");
    const before=(await old.query('SELECT id FROM gymbro.exercises ORDER BY id')).rows;
    const patch=fs.readFileSync(new URL('../postgres/sql/03-soft-delete.sql',import.meta.url),'utf8');
    await old.exec(patch);await old.exec(patch);
    assert.deepEqual((await old.query('SELECT id FROM gymbro.exercises ORDER BY id')).rows,before);
    assert.equal((await old.query('SELECT count(*)::int AS total FROM gymbro.exercises WHERE deleted_at IS NULL')).rows[0].total,190);
    assert.equal((await old.query('SELECT count(*)::int AS total FROM gymbro.schema_migrations')).rows[0].total,8);
  }finally{await old.close();}
});
test('Supabase: migración legal se puede repetir sin crear consentimientos ni publicar cuentas',async()=>{
  const old=new PGlite();
  try{
    await old.exec(sql);
    await old.exec('DROP TABLE gymbro.legal_acceptances; ALTER TABLE gymbro.users DROP COLUMN leaderboard_opt_in;');
    await old.exec("DELETE FROM gymbro.schema_migrations WHERE version='20261022_legal'");
    const id=randomUUID();
    await old.query("INSERT INTO gymbro.users(id,email,password_hash,name,created_at,updated_at) VALUES ($1,'old@example.test','hash','Anterior',now(),now())",[id]);
    const patch=fs.readFileSync(new URL('../postgres/sql/04-legal-consents.sql',import.meta.url),'utf8');
    await old.exec(patch);await old.exec(patch);
    assert.equal((await old.query('SELECT leaderboard_opt_in FROM gymbro.users WHERE id=$1',[id])).rows[0].leaderboard_opt_in,false);
    assert.equal((await old.query('SELECT count(*)::int AS total FROM gymbro.legal_acceptances')).rows[0].total,0);
    assert.equal((await old.query('SELECT count(*)::int AS total FROM gymbro.schema_migrations')).rows[0].total,8);
  }finally{await old.close();}
});
test('Supabase: backend registra recibos pero no puede alterarlos ni borrarlos',async()=>{
  await db.exec('SET ROLE gymbro_backend');
  try{
    const id=randomUUID();
    await db.query("INSERT INTO gymbro.legal_acceptances(id,user_id,version,document_hash,documents,terms_accepted,privacy_acknowledged,adult_confirmed,sports_data_consent,accepted_at) VALUES ($1,$2,'test','hash','{}',true,true,true,false,now())",[id,user]);
    await assert.rejects(db.query('UPDATE gymbro.legal_acceptances SET sports_data_consent=true WHERE id=$1',[id]),/permission denied/);
    await assert.rejects(db.query('DELETE FROM gymbro.legal_acceptances WHERE id=$1',[id]),/permission denied/);
  }finally{await db.exec('RESET ROLE');}
});

test('Supabase: cupo semanal se instala repetidamente sin perder consumo',async()=>{
 const migration=fs.readFileSync(new URL('../postgres/sql/07-ai-weekly-quota.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.query('UPDATE gymbro.users SET ai_weekly_used=2 WHERE id=$1',[user]);await db.exec(migration);
 const row=(await db.query('SELECT ai_weekly_used,password_hash FROM gymbro.users WHERE id=$1',[user])).rows[0];assert.equal(row.ai_weekly_used,2);assert.equal(row.password_hash,'not-a-real-hash');
 await assert.rejects(db.query('UPDATE gymbro.users SET ai_weekly_used=4 WHERE id=$1',[user]));
});
