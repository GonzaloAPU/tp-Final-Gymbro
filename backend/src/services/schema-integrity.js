/** Reglas SQL compartidas por las migraciones y el instalador de Supabase. */
export const normalizeNameSql=String.raw`CREATE OR REPLACE FUNCTION gymbro_normalize_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
SELECT lower(regexp_replace(btrim(regexp_replace(normalize(value, NFD), U&'[\0300-\036f]', '', 'g')), '\s+', ' ', 'g')) $$`;

export const exerciseGuardSql=`CREATE OR REPLACE FUNCTION gymbro_exercise_name_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
NEW.normalized_name := gymbro_normalize_name(NEW.name);
PERFORM pg_advisory_xact_lock(hashtextextended(NEW.normalized_name,0));
IF EXISTS (SELECT 1 FROM exercises e WHERE e.id<>NEW.id AND e.normalized_name=NEW.normalized_name
AND (e.created_by_user_id IS NULL OR NEW.created_by_user_id IS NULL OR e.created_by_user_id=NEW.created_by_user_id))
THEN RAISE EXCEPTION 'El ejercicio ya existe en ese catálogo' USING ERRCODE='23505'; END IF;
RETURN NEW; END $$`;

export const tableChecks=[
  ['user_rest_days','weekday_range','weekday BETWEEN 0 AND 6'],
  ['routine_schedules','weekday_range','weekday BETWEEN 0 AND 6'],
  ['routine_schedules','valid_time_range','start_time < end_time'],
  ['exercises','valid_type',"training_type IN ('POWER','AEROBIC','ANAEROBIC')"],
  ['exercises','valid_name',"length(normalized_name) >= 2 AND normalized_name=gymbro_normalize_name(name)"],
  ['body_weight_histories','valid_weight','weight_kg > 0 AND weight_kg <= 500'],
  ['routine_exercises','valid_targets','target_sets > 0 AND min_reps > 0 AND max_reps >= min_reps AND rest_seconds >= 0'],
  ['performed_sets','valid_values','set_number > 0 AND weight_kg >= 0 AND repetitions > 0 AND duration_seconds >= 0 AND actual_rest_seconds >= 0'],
];
