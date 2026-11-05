-- Ejecutar como postgres, después de 01-bootstrap.sql.
-- Reemplazar UNA sola vez la contraseña por una aleatoria larga. No guardar ni subir la copia editada.
BEGIN;
DO $$
DECLARE backend_password text := 'REEMPLAZAR_POR_UNA_CONTRASENA_ALEATORIA';
BEGIN
IF backend_password LIKE 'REEMPLAZAR_%' OR length(backend_password)<32 THEN
RAISE EXCEPTION 'Elegí una contraseña de al menos 32 caracteres para gymbro_backend antes de ejecutar.';
END IF;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
RAISE EXCEPTION 'gymbro_backend ya existe. No se modifica su contraseña.';
END IF;
EXECUTE format('CREATE ROLE gymbro_backend LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',backend_password);
END $$;
GRANT CONNECT ON DATABASE postgres TO gymbro_backend;
GRANT USAGE ON SCHEMA gymbro TO gymbro_backend;
GRANT SELECT, INSERT, UPDATE ON TABLE
gymbro.users, gymbro.exercises, gymbro.routines, gymbro.routine_days,
gymbro.routine_exercises, gymbro.routine_schedules, gymbro.training_sessions,
gymbro.performed_exercises, gymbro.performed_sets, gymbro.body_weight_histories,
gymbro.strength_records, gymbro.user_rest_days, gymbro.session_mutations, gymbro.welcome_plans
TO gymbro_backend;
-- Solo estas filas auxiliares se reemplazan físicamente desde la aplicación.
GRANT DELETE ON TABLE gymbro.routine_schedules, gymbro.user_rest_days, gymbro.welcome_plans TO gymbro_backend;
GRANT SELECT ON gymbro.schema_migrations TO gymbro_backend;
GRANT SELECT, INSERT ON gymbro.legal_acceptances TO gymbro_backend;
GRANT EXECUTE ON FUNCTION gymbro.gymbro_normalize_name(text), gymbro.gymbro_exercise_name_guard() TO gymbro_backend;
ALTER ROLE gymbro_backend SET search_path TO gymbro, public;
COMMIT;
-- En la URI Session pooler, el usuario será gymbro_backend.PROJECT_REF.
