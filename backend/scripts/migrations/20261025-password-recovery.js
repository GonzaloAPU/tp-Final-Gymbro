import {sequelize} from '../../src/db.js';
import {passwordRecoverySql} from '../../src/services/password-recovery-schema.js';
export async function migratePasswordRecovery(){
  // Agrupa el cambio de esquema y el registro de versión en una transacción.
  await sequelize.transaction(async transaction=>{
    // Un bloqueo de PostgreSQL evita ejecutar esta migración simultáneamente.
    await sequelize.query('SELECT pg_advisory_xact_lock(20261025)',{transaction});
    await sequelize.query(passwordRecoverySql(sequelize.options.define.schema||'public'),{transaction});
  });
}
