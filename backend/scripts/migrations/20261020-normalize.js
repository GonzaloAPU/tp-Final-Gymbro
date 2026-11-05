/** Migración versionada y transaccional. Migra datos antes de retirar columnas redundantes. */
import { sequelize } from '../../src/db.js';
import { UserRestDay, RoutineSchedule, BodyWeightHistory } from '../../src/models/index.js';
import { exerciseData } from '../../src/data/exercise-catalog.js';
import { normalizeExerciseName } from '../../src/services/exercise-access.js';
import {normalizeNameSql,exerciseGuardSql,tableChecks} from '../../src/services/schema-integrity.js';
import {softDeleteTables} from '../../src/services/soft-delete.js';

export async function normalizeSchema() {
  await sequelize.transaction(async transaction => {
    const query = (sql, replacements) => sequelize.query(sql, {transaction,replacements});
    await query('SELECT pg_advisory_xact_lock(20261020)');
    await query('CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(80) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const [done] = await query("SELECT version FROM schema_migrations WHERE version='20261020_normalize'");
    if (done.length) return;
    // sync crea solo las tablas ausentes; los cambios sobre tablas existentes son explícitos abajo.
    await sequelize.sync({transaction});
    // Los modelos actuales ya filtran deleted_at al leer datos heredados.
    for(const table of softDeleteTables)await query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
    const [users] = await query('SELECT * FROM users');
    const [days] = await query('SELECT * FROM routine_days');
    for (const user of users) {
      for (const weekday of user.rest_days || []) await UserRestDay.findOrCreate({where:{userId:user.id,weekday},transaction});
      if (user.current_kg != null) {
        const latest = await BodyWeightHistory.findOne({where:{userId:user.id},order:[['recordedAt','DESC']],transaction});
        // Conserva un peso actual que no estuviera reflejado en el historial. Fecha = momento de migración.
        if (!latest || Number(latest.weightKg) !== Number(user.current_kg)) await BodyWeightHistory.create({userId:user.id,weightKg:user.current_kg},{transaction});
      }
    }
    for (const day of days) {
      for (const slot of day.schedule || []) await RoutineSchedule.findOrCreate({where:{routineDayId:day.id,weekday:slot.weekday,start:slot.start,end:slot.end},transaction});
    }
    await query('ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE');
    await query('ALTER TABLE exercises ADD COLUMN IF NOT EXISTS normalized_name varchar(255)');
    // PostgreSQL y JavaScript usan la misma normalización: tildes, mayúsculas y espacios.
    await query(normalizeNameSql);
    await query('UPDATE exercises SET normalized_name=gymbro_normalize_name(name)');
    const [exercises] = await query('SELECT id,name,normalized_name FROM exercises');
    const official = new Set(exerciseData.map(item=>normalizeExerciseName(item.name)));
    // No inventamos un propietario para datos heredados desconocidos. Abortamos antes de modificar el esquema.
    const unknown = exercises.filter(item=>!official.has(item.normalized_name));
    if (unknown.length) throw Error(`Hay ${unknown.length} ejercicios heredados fuera del catálogo. Asignales propietario antes de migrar.`);
    const names = new Set();
    for (const exercise of exercises) {
      if (names.has(exercise.normalized_name)) throw Error('Hay nombres equivalentes heredados. Se requiere revisar referencias antes de unificarlos.');
      names.add(exercise.normalized_name);
    }
    // Sustituye la unicidad global por una clave oficial y otra por propietario.
    await query(`DO $$ DECLARE item record; BEGIN
      FOR item IN SELECT c.conname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid='exercises'::regclass AND c.contype='u' AND cardinality(c.conkey)=1 AND a.attname='name'
      LOOP EXECUTE format('ALTER TABLE exercises DROP CONSTRAINT %I',item.conname); END LOOP;
    END $$`);
    await query('ALTER TABLE exercises ALTER COLUMN normalized_name SET NOT NULL');
    await query('CREATE UNIQUE INDEX exercises_official_name_unique ON exercises(normalized_name) WHERE created_by_user_id IS NULL');
    await query('CREATE UNIQUE INDEX exercises_private_name_unique ON exercises(created_by_user_id,normalized_name) WHERE created_by_user_id IS NOT NULL');
    await query(exerciseGuardSql);
    await query('CREATE TRIGGER exercises_name_guard BEFORE INSERT OR UPDATE OF name,created_by_user_id,normalized_name ON exercises FOR EACH ROW EXECUTE FUNCTION gymbro_exercise_name_guard()');
    // Restricciones comprobadas por SQL, también cuando se escribe desde pgAdmin o scripts.
    for (const [table,name,expression] of tableChecks) await query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_${name} CHECK (${expression})`);
    // La transferencia ya terminó: cada dato tiene una sola fuente relacional.
    await query('ALTER TABLE users DROP COLUMN IF EXISTS rest_days, DROP COLUMN IF EXISTS current_kg');
    await query('ALTER TABLE routine_days DROP COLUMN IF EXISTS schedule');
    await query("INSERT INTO schema_migrations(version) VALUES ('20261020_normalize')");
  });
}
