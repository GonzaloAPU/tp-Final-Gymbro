-- Aplicar antes de actualizar Render.
BEGIN;
SELECT pg_advisory_xact_lock(20261026);
ALTER TABLE "gymbro".users ADD COLUMN IF NOT EXISTS ai_week_start timestamptz;
ALTER TABLE "gymbro".users ADD COLUMN IF NOT EXISTS ai_weekly_used integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='"gymbro".users'::regclass AND conname='users_ai_weekly_used_range') THEN
 ALTER TABLE "gymbro".users ADD CONSTRAINT users_ai_weekly_used_range CHECK (ai_weekly_used BETWEEN 0 AND 3);
 END IF;
END $$;
INSERT INTO "gymbro".schema_migrations(version) VALUES ('20261026_ai_weekly_quota') ON CONFLICT DO NOTHING;
COMMIT;
