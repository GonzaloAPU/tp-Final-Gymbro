import {sequelize} from '../../src/db.js';
import {spanishSchemaSql} from '../../src/services/spanish-schema.js';
export async function migrateSpanishNames(){
 await sequelize.transaction(transaction=>sequelize.query(spanishSchemaSql(sequelize.options.define.schema||'public'),{transaction}));
}
