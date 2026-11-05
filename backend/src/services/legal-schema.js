/** Migración aditiva: conserva usuarios existentes sin atribuirles consentimientos. */
export const legalVersion='20261022_legal';
export function legalSchemaSql(schema){
  if(!['public','gymbro'].includes(schema))throw Error('Esquema no permitido');
  return `ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "${schema}".legal_acceptances (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE RESTRICT,
 version varchar(80) NOT NULL, document_hash varchar(64) NOT NULL, documents jsonb NOT NULL,
 terms_accepted boolean NOT NULL CHECK(terms_accepted),
 privacy_acknowledged boolean NOT NULL CHECK(privacy_acknowledged),
 adult_confirmed boolean NOT NULL CHECK(adult_confirmed),
 sports_data_consent boolean NOT NULL, accepted_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_id_accepted_at ON "${schema}".legal_acceptances(user_id,accepted_at);
REVOKE ALL ON "${schema}".legal_acceptances FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
EXECUTE format('REVOKE ALL ON "${schema}".legal_acceptances FROM %I',r);
END IF; END LOOP;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
GRANT SELECT, INSERT ON "${schema}".legal_acceptances TO gymbro_backend;
REVOKE UPDATE, DELETE ON "${schema}".legal_acceptances FROM gymbro_backend;
END IF; END $$;
INSERT INTO "${schema}".schema_migrations(version) VALUES ('${legalVersion}') ON CONFLICT DO NOTHING;`;
}
