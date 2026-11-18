/** Agrega recibos durables para que un reintento no repita ni sobrescriba una operación anterior. */
import {sequelize} from '../../src/db.js';
import {SessionMutation} from '../../src/models/index.js';
export async function migrateOfflineSessions() {
  await sequelize.transaction(async transaction=>{
    await sequelize.query('SELECT pg_advisory_xact_lock(20261020)',{transaction});
    const [done]=await sequelize.query("SELECT version FROM schema_migrations WHERE version='20261020_offline_sessions'",{transaction});
    if(done.length) return;
    await SessionMutation.sync({transaction});
    await sequelize.query("ALTER TABLE session_mutations ADD CONSTRAINT session_mutations_valid_kind CHECK (kind IN ('START','EXERCISE','SET','REPLACE','FINISH')), ADD CONSTRAINT session_mutations_valid_status CHECK (status_code IN (200,201))",{transaction});
    await sequelize.query("INSERT INTO schema_migrations(version) VALUES ('20261020_offline_sessions')",{transaction});
  });
}
