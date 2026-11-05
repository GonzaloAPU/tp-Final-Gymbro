/** Aplica migraciones explícitas; no usa sync({alter:true}) ni recrea tablas con datos. */
import 'dotenv/config';
import { sequelize } from '../src/db.js';
import { migrateOfflineSessions } from './migrations/20261020-offline-sessions.js';
import { normalizeSchema } from './migrations/20261020-normalize.js';
import { migrateWelcome } from './migrations/20261021-welcome.js';
import {migrateSoftDelete} from './migrations/20261022-soft-delete.js';
import {migrateLegal} from './migrations/20261022-legal.js';
import {migratePasswordRecovery} from './migrations/20261025-password-recovery.js';
import {migrateExerciseGuides} from './migrations/20261025-exercise-guides.js';
import {migrateAiQuota} from './migrations/20261026-ai-quota.js';
import {migrateSpanishNames} from './migrations/20261103-spanish-names.js';
import {databaseLanguage} from '../src/services/database-names.js';
try {
 await sequelize.authenticate();
 const schema=sequelize.options.define.schema||'public';
 const [translated]=await sequelize.query("SELECT 1 FROM information_schema.tables WHERE table_schema=:schema AND table_name='usuarios' AND table_type='BASE TABLE'",{replacements:{schema}});
 if(translated.length){
  await migrateSpanishNames();
  console.log('Nombres en español verificados; migraciones históricas conservadas.');
 }else{
  if(databaseLanguage()==='es')throw Error('Aplicá primero 08-nombres-espanol.sql o ejecutá db:migrate con DB_NAMES_LANGUAGE=en antes de activar es.');
  await normalizeSchema();
  await migrateOfflineSessions();
  await migrateWelcome();
  await migrateSoftDelete();
  await migrateLegal();
  await migratePasswordRecovery();
  await migrateExerciseGuides();
  await migrateAiQuota();
  await migrateSpanishNames();
  console.log('Migraciones verificadas: esquema normalizado.');
 }
} finally { await sequelize.close(); }
