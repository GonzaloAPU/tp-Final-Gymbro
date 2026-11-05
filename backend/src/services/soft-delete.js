/** Entidades archivables. Los enlaces de calendario y recibos técnicos no se archivan. */
export const softDeleteTables=['users','exercises','routines','routine_days','routine_exercises','training_sessions','performed_exercises','performed_sets','body_weight_histories','strength_records'];
export const softDeleteVersion='20261022_soft_delete';
export function softDeleteSql(schema){
  if(!['gymbro','public'].includes(schema))throw Error('Esquema no permitido');
  const names=softDeleteTables.map(table=>`"${schema}"."${table}"`);
  return `${names.map(table=>`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`).join('\n')}
${softDeleteTables.map(table=>`CREATE INDEX IF NOT EXISTS ${table}_deleted_at_idx ON "${schema}"."${table}" (deleted_at) WHERE deleted_at IS NOT NULL;`).join('\n')}
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
REVOKE DELETE ON ${names.join(',')} FROM gymbro_backend;
END IF; END $$;
INSERT INTO "${schema}".schema_migrations(version) VALUES ('${softDeleteVersion}') ON CONFLICT(version) DO NOTHING;`;
}
