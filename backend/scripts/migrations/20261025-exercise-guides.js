import {sequelize} from '../../src/db.js';
import {exerciseGuidesSql} from '../../src/services/exercise-guides-schema.js';
export async function migrateExerciseGuides(){
  await sequelize.transaction(async transaction=>{
    await sequelize.query('SELECT pg_advisory_xact_lock(2026102501)',{transaction});
    await sequelize.query(exerciseGuidesSql(sequelize.options.define.schema||'public'),{transaction});
  });
}
