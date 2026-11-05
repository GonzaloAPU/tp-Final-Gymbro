-- Aplicar antes de actualizar Render. Conserva usuarios y contraseñas existentes.
BEGIN;
SELECT pg_advisory_xact_lock(20261025);
ALTER TABLE "gymbro".users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
INSERT INTO "gymbro".schema_migrations(version) VALUES ('20261025_password_recovery') ON CONFLICT DO NOTHING;
COMMIT;
