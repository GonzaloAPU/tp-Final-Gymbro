import {aiQuotaSql} from '../backend/src/services/ai-quota-schema.js';
import './build-spanish-schema.mjs';
/** Genera un instalador limpio desde los modelos actuales. No conecta a ninguna base. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {exerciseData} from '../backend/src/data/exercise-catalog.js';
import {normalizeExerciseName} from '../backend/src/services/exercise-name.js';
import {normalizeNameSql,exerciseGuardSql,tableChecks} from '../backend/src/services/schema-integrity.js';
import {softDeleteSql} from '../backend/src/services/soft-delete.js';
import {legalSchemaSql} from '../backend/src/services/legal-schema.js';
import {passwordRecoverySql} from '../backend/src/services/password-recovery-schema.js';
import {exerciseGuidesSql} from '../backend/src/services/exercise-guides-schema.js';
// Solo este proceso generador usa esta conexión ficticia, nunca abre un socket.
process.env.DB_CONNECTION_MODE='LOCAL';process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
process.env.DB_NAMES_LANGUAGE='en'; // Instalador histórico; SQL 08 realiza la traducción.
const {sequelize}=await import('../backend/src/db.js');
await import('../backend/src/models/index.js');
const generator=sequelize.dialect.queryGenerator;
const statements=[`-- Generado con npm run supabase:sql. Solo esquema, reglas y catálogo oficial.
-- No contiene cuentas, contraseñas, fotos ni sesiones. Ejecutar en SQL Editor como postgres.
-- Si gymbro ya existe, aborta sin borrar ni sobrescribir nada.
BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gymbro')
THEN RAISE EXCEPTION 'El esquema gymbro ya existe: no se modifica. Usar migraciones para actualizarlo.'; END IF; END $$;
CREATE SCHEMA gymbro;
SET LOCAL search_path TO gymbro, public;`];
const models=sequelize.modelManager.getModelsTopoSortedByForeignKey().reverse();
for(const model of models){
  if(model.name==='LegalAcceptance')continue; // DDL compartido con la migración incremental.
  const table={tableName:model.tableName,schema:'gymbro'};
  const attributes=Object.fromEntries(Object.entries(model.rawAttributes).map(([name,attribute])=>{
    const copy={...attribute};
    if(copy.references){const ref=copy.references.model;copy.references={...copy.references,model:{tableName:typeof ref==='string'?ref:ref.tableName,schema:'gymbro'}};}
    return [name,copy];
  }));
  for(const [name,attribute] of Object.entries(attributes))if(attribute.type.key==='ENUM')statements.push(generator.pgEnum(table,attribute.field||name,attribute.type));
  statements.push(generator.createTableQuery(table,generator.attributesToSQL(attributes,{context:'createTable',table}),{uniqueKeys:model.uniqueKeys}));
  for(const index of model.options.indexes)statements.push(generator.addIndexQuery(table,index)+';');
}
statements.push(`CREATE TABLE gymbro.schema_migrations (version varchar(80) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());`);
statements.push(normalizeNameSql+';',exerciseGuardSql+';');
statements.push(`ALTER FUNCTION gymbro.gymbro_normalize_name(text) SET search_path TO gymbro, pg_temp;
ALTER FUNCTION gymbro.gymbro_exercise_name_guard() SET search_path TO gymbro, pg_temp;
CREATE UNIQUE INDEX exercises_official_name_unique ON gymbro.exercises(normalized_name) WHERE created_by_user_id IS NULL;
CREATE UNIQUE INDEX exercises_private_name_unique ON gymbro.exercises(created_by_user_id,normalized_name) WHERE created_by_user_id IS NOT NULL;
CREATE TRIGGER exercises_name_guard BEFORE INSERT OR UPDATE OF name,created_by_user_id,normalized_name ON gymbro.exercises FOR EACH ROW EXECUTE FUNCTION gymbro.gymbro_exercise_name_guard();`);
for(const [table,name,expression]of tableChecks)statements.push(`ALTER TABLE gymbro.${table} ADD CONSTRAINT ${table}_${name} CHECK (${expression});`);
statements.push(`ALTER TABLE gymbro.session_mutations ADD CONSTRAINT session_mutations_valid_kind CHECK (kind IN ('START','EXERCISE','SET','REPLACE','FINISH')), ADD CONSTRAINT session_mutations_valid_status CHECK (status_code IN (200,201));
ALTER TABLE gymbro.welcome_plans ADD CONSTRAINT welcome_plan_source CHECK (source IN ('LOCAL','GEMINI','SKIPPED'));
INSERT INTO gymbro.schema_migrations(version) VALUES ('20261020_normalize'),('20261020_offline_sessions'),('20261021_welcome');`);
const exercises=exerciseData.map(e=>{
  const name=normalizeExerciseName(e.name),hash=createHash('sha256').update('gymbro-official:'+name).digest('hex');
  const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  return {id,name:e.name,normalized_name:name,muscle_group:e.muscleGroup,equipment:e.equipment,movement_pattern:e.movementPattern,description:e.description,video_url:e.videoUrl,training_type:e.trainingType,created_by_user_id:null};
});
if(new Set(exercises.map(e=>e.normalized_name)).size!==190)throw Error('El catálogo debe contener 190 nombres únicos');
statements.push(generator.bulkInsertQuery({tableName:'exercises',schema:'gymbro'},exercises,{}));
statements.push(`-- El esquema de la aplicación no se expone por REST/GraphQL de Supabase.
REVOKE ALL ON SCHEMA gymbro FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA gymbro FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gymbro FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
EXECUTE format('REVOKE ALL ON SCHEMA gymbro FROM %I',role_name);
EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA gymbro FROM %I',role_name);
EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gymbro FROM %I',role_name);
END IF; END LOOP; END $$;
COMMIT;
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE') AS tablas,
(SELECT count(*) FROM gymbro.exercises) AS ejercicios,
(SELECT count(*) FROM gymbro.users) AS usuarios;
-- Resultado esperado: 16 tablas, 190 ejercicios, 0 usuarios.`);
const target=fileURLToPath(new URL('../postgres/sql/01-bootstrap.sql',import.meta.url));
fs.mkdirSync(fileURLToPath(new URL('../postgres/sql/',import.meta.url)),{recursive:true});
// El mismo cambio sirve tanto para un proyecto nuevo como para el ya instalado.
const migration=`-- Ejecutar como postgres sobre la instalación existente. No borra datos.\nBEGIN;\nSET LOCAL search_path TO gymbro, public;\nSELECT pg_advisory_xact_lock(20261022);\n${softDeleteSql('gymbro')}\nCOMMIT;\nSELECT version FROM gymbro.schema_migrations WHERE version='20261022_soft_delete';\n`;
fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/03-soft-delete.sql',import.meta.url)),migration);
// Una instalación nueva ya queda en la versión actual antes de confirmar.
statements.splice(statements.length-1,0,softDeleteSql('gymbro'));
statements.splice(statements.length-1,0,legalSchemaSql('gymbro'));
statements.splice(statements.length-1,0,passwordRecoverySql('gymbro'));
statements.splice(statements.length-1,0,aiQuotaSql('gymbro'));
statements.splice(statements.length-1,0,exerciseGuidesSql('gymbro'));
fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/06-exercise-guides.sql',import.meta.url)),`-- Completa el catálogo oficial sin modificar rutinas, usuarios ni guías existentes.\nBEGIN;\nSELECT pg_advisory_xact_lock(2026102501);\n${exerciseGuidesSql('gymbro')}\nCOMMIT;\nSELECT count(*) AS ejercicios, count(description) AS con_descripcion, count(video_url) AS con_video FROM gymbro.exercises WHERE created_by_user_id IS NULL AND deleted_at IS NULL;\n`);
fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/05-password-recovery.sql',import.meta.url)),`-- Aplicar antes de actualizar Render. Conserva usuarios y contraseñas existentes.\nBEGIN;\nSELECT pg_advisory_xact_lock(20261025);\n${passwordRecoverySql('gymbro')}\nCOMMIT;\n`);
fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/04-legal-consents.sql',import.meta.url)),`-- Aplicar ANTES de actualizar Render. No borra datos ni acepta documentos por los usuarios.\nBEGIN;\nSELECT pg_advisory_xact_lock(20261023);\n${legalSchemaSql('gymbro')}\nCOMMIT;\nSELECT version FROM gymbro.schema_migrations WHERE version='20261022_legal';\n`);
fs.writeFileSync(target,statements.join('\n\n')+'\n');
await sequelize.close();
console.log('OK: instalador Supabase generado desde modelos, restricciones y catálogo.');

fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/07-ai-weekly-quota.sql',import.meta.url)),`-- Aplicar antes de actualizar Render.
BEGIN;
SELECT pg_advisory_xact_lock(20261026);
${aiQuotaSql('gymbro')}
COMMIT;
`);
