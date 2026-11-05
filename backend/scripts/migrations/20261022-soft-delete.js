/** Agrega columnas e índices, sin borrar ni cambiar los registros existentes. */
import {sequelize} from '../../src/db.js';
import {softDeleteSql,softDeleteVersion} from '../../src/services/soft-delete.js';
export async function migrateSoftDelete(){
  const schema=sequelize.options.define.schema||'public';
  await sequelize.transaction(async transaction=>{
    await sequelize.query('SELECT pg_advisory_xact_lock(20261022)',{transaction});
    const [done]=await sequelize.query(`SELECT version FROM "${schema}".schema_migrations WHERE version=:version`,{replacements:{version:softDeleteVersion},transaction});
    if(done.length)return;
    await sequelize.query(softDeleteSql(schema),{transaction});
  });
}
