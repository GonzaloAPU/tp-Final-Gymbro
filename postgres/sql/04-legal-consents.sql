-- Aplicar ANTES de actualizar Render. No borra datos ni acepta documentos por los usuarios.
BEGIN;
SELECT pg_advisory_xact_lock(20261023);
ALTER TABLE "gymbro".users ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "gymbro".legal_acceptances (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES "gymbro".users(id) ON DELETE RESTRICT,
 version varchar(80) NOT NULL, document_hash varchar(64) NOT NULL, documents jsonb NOT NULL,
 terms_accepted boolean NOT NULL CHECK(terms_accepted),
 privacy_acknowledged boolean NOT NULL CHECK(privacy_acknowledged),
 adult_confirmed boolean NOT NULL CHECK(adult_confirmed),
 sports_data_consent boolean NOT NULL, accepted_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_id_accepted_at ON "gymbro".legal_acceptances(user_id,accepted_at);
REVOKE ALL ON "gymbro".legal_acceptances FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
EXECUTE format('REVOKE ALL ON "gymbro".legal_acceptances FROM %I',r);
END IF; END LOOP;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
GRANT SELECT, INSERT ON "gymbro".legal_acceptances TO gymbro_backend;
REVOKE UPDATE, DELETE ON "gymbro".legal_acceptances FROM gymbro_backend;
END IF; END $$;
INSERT INTO "gymbro".schema_migrations(version) VALUES ('20261022_legal') ON CONFLICT DO NOTHING;
COMMIT;
SELECT version FROM gymbro.schema_migrations WHERE version='20261022_legal';
