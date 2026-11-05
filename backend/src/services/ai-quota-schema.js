/** Campos persistentes del cupo semanal, sin modificar rutinas ni sesiones. */
export function aiQuotaSql(schema){
  if(!['public','gymbro'].includes(schema))throw Error('Esquema no permitido');
  return `ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS ai_week_start timestamptz;
ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS ai_weekly_used integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='"${schema}".users'::regclass AND conname='users_ai_weekly_used_range') THEN
 ALTER TABLE "${schema}".users ADD CONSTRAINT users_ai_weekly_used_range CHECK (ai_weekly_used BETWEEN 0 AND 3);
 END IF;
END $$;
INSERT INTO "${schema}".schema_migrations(version) VALUES ('20261026_ai_weekly_quota') ON CONFLICT DO NOTHING;`;
}
