import {sequelize} from '../../src/db.js';
import {legalSchemaSql} from '../../src/services/legal-schema.js';
export async function migrateLegal(){
  await sequelize.transaction(async transaction=>{
    await sequelize.query('SELECT pg_advisory_xact_lock(20261023)',{transaction});
    await sequelize.query(legalSchemaSql(sequelize.options.define.schema||'public'),{transaction});
  });
}
