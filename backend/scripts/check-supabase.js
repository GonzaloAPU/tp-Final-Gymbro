/** Verificación de solo lectura, para ejecutar después del SQL y antes del despliegue. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {sequelize,closeDatabase} from '../src/db.js';
import {Exercise,User} from '../src/models/index.js';
import {physicalTable,databaseLanguage} from '../src/services/database-names.js';
try {
  assert.equal(process.env.DB_CONNECTION_MODE,'SUPABASE','Este comando requiere DB_CONNECTION_MODE=SUPABASE');
  await sequelize.authenticate();
  const [tables]=await sequelize.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'");
  assert.equal(tables[0].total,16,'Faltan tablas: revisar el esquema y las migraciones antes de desplegar');
  const [migrations]=await sequelize.query(`SELECT version FROM gymbro.${physicalTable('schema_migrations')}`);
  const expected=['20261020_normalize','20261020_offline_sessions','20261021_welcome','20261022_soft_delete','20261022_legal','20261025_password_recovery','20261025_exercise_guides','20261026_ai_weekly_quota'];
  if(databaseLanguage()==='es')expected.push('20261103_nombres_espanol');
  for(const version of expected)assert.ok(migrations.some(row=>row.version===version),'Falta migración '+version);
  const exercises=await Exercise.count({where:{createdByUserId:null}});
  assert.ok(exercises>=190,'Falta el catálogo oficial completo');
  const [access]=await sequelize.query(`SELECT has_schema_privilege('anon','gymbro','USAGE') AS exposed, has_table_privilege(current_user,'gymbro.${physicalTable('users')}','INSERT') AS can_write`);
  assert.equal(access[0].exposed,false,'El esquema no debe estar expuesto a anon');
  assert.equal(access[0].can_write,true,'El usuario del backend necesita permisos de escritura');
  console.log(JSON.stringify({verified:true,tables:16,officialExercises:exercises,users:await User.count()}));
} catch(error) {
  console.error(error.name==='AssertionError'?error.message:`No se pudo verificar Supabase (${error.name}). Revisá URI, contraseña, Session pooler y certificado CA.`);
  process.exitCode=1;
} finally {await closeDatabase();}
