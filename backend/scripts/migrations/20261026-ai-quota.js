import {sequelize} from '../../src/db.js';
import {aiQuotaSql} from '../../src/services/ai-quota-schema.js';
export async function migrateAiQuota(){
 await sequelize.transaction(async transaction=>{
  await sequelize.query('SELECT pg_advisory_xact_lock(20261026)',{transaction});
  await sequelize.query(aiQuotaSql(sequelize.options.define.schema||'public'),{transaction});
 });
}
