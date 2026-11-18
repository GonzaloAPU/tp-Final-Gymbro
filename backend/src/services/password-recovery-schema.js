/** Migración de apoyo a la revocación de sesiones; no almacena enlaces ni tokens. */
export const passwordRecoveryVersion='20261025_password_recovery';
export function passwordRecoverySql(schema){
  // IF NOT EXISTS permite repetir el SQL. Las cuentas previas quedan con NULL.
  // La fecha no calcula la expiración: exp ya viaja firmado dentro del JWT.
  if(!['public','gymbro'].includes(schema))throw Error('Esquema no permitido');
  return `ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
INSERT INTO "${schema}".schema_migrations(version) VALUES ('${passwordRecoveryVersion}') ON CONFLICT DO NOTHING;`;
}
