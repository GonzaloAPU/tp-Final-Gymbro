/** Agrega propuestas de bienvenida sin cambiar datos de cuentas ni rutinas existentes. */
import {sequelize} from '../../src/db.js';
import {WelcomePlan} from '../../src/models/index.js';
export async function migrateWelcome() {
  await sequelize.transaction(async transaction=>{
    await sequelize.query('SELECT pg_advisory_xact_lock(20261021)',{transaction});
    const [done]=await sequelize.query("SELECT version FROM schema_migrations WHERE version='20261021_welcome'",{transaction});
    if(done.length)return;
    await WelcomePlan.sync({transaction});
    await sequelize.query("ALTER TABLE welcome_plans ADD CONSTRAINT welcome_plan_source CHECK (source IN ('LOCAL','GEMINI','SKIPPED'))",{transaction});
    await sequelize.query("INSERT INTO schema_migrations(version) VALUES ('20261021_welcome')",{transaction});
  });
}
