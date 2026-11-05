-- Ejecutar en Supabase como administrador DESPUÉS de 01 a 07.
-- Renombra objetos sin borrar registros. Conserva vistas de compatibilidad.
-- Después del SQL, desplegar el backend con DB_NAMES_LANGUAGE=es.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL search_path TO "gymbro", public;
SELECT pg_advisory_xact_lock(20261103);
-- Todos los cambios ocurren dentro de la transacción del llamador.
DO $rename$
DECLARE
 tablas jsonb := '{"users":"usuarios","user_rest_days":"dias_descanso_usuario","exercises":"ejercicios","routines":"rutinas","routine_days":"dias_rutina","routine_exercises":"ejercicios_rutina","routine_schedules":"horarios_rutina","training_sessions":"sesiones_entrenamiento","performed_exercises":"ejercicios_realizados","performed_sets":"series_realizadas","body_weight_histories":"historial_peso_corporal","strength_records":"marcas_fuerza","session_mutations":"operaciones_sesion","welcome_plans":"planes_iniciales","legal_acceptances":"consentimientos_legales","schema_migrations":"migraciones_esquema"}'::jsonb;
 columnas jsonb := '{"active":"activa","id":"id","version":"version","email":"correo_electronico","password_hash":"hash_contrasena","name":"nombre","goal":"objetivo","height_cm":"altura_cm","gym_name":"nombre_gimnasio","discipline":"disciplina","photo_url":"foto_url","created_at":"fecha_creacion","updated_at":"fecha_actualizacion","deleted_at":"fecha_eliminacion","leaderboard_opt_in":"participa_ranking","password_changed_at":"fecha_cambio_contrasena","ai_week_start":"inicio_semana_ia","ai_weekly_used":"generaciones_ia_semana","weekday":"dia_semana","user_id":"usuario_id","preferences":"preferencias","proposal":"propuesta","source":"origen","accepted_at":"fecha_aceptacion","skipped_at":"fecha_omision","routine_id":"rutina_id","normalized_name":"nombre_normalizado","muscle_group":"grupo_muscular","equipment":"equipamiento","movement_pattern":"patron_movimiento","training_type":"tipo_entrenamiento","created_by_user_id":"creado_por_usuario_id","description":"descripcion","video_url":"enlace_video","favorite":"favorita","day_number":"numero_dia","routine_day_id":"dia_rutina_id","order":"orden","target_sets":"series_objetivo","min_reps":"repeticiones_minimas","max_reps":"repeticiones_maximas","rest_seconds":"descanso_segundos","target_duration_minutes":"duracion_objetivo_minutos","target_distance_km":"distancia_objetivo_km","intensity":"intensidad","exercise_id":"ejercicio_id","start_time":"hora_inicio","end_time":"hora_fin","started_at":"fecha_inicio","finished_at":"fecha_fin","duration_seconds":"duracion_segundos","status":"estado","calories":"calorias","total_volume_kg":"volumen_total_kg","session_id":"sesion_id","set_number":"numero_serie","weight_kg":"peso_kg","repetitions":"repeticiones","actual_rest_seconds":"descanso_real_segundos","completed_at":"fecha_finalizacion","performed_exercise_id":"ejercicio_realizado_id","recorded_at":"fecha_registro","max_weight_kg":"peso_maximo_kg","estimated_one_rm":"estimacion_1rm","achieved_at":"fecha_marca","kind":"tipo","request_hash":"hash_solicitud","response":"respuesta","status_code":"codigo_estado","applied_at":"fecha_aplicacion","document_hash":"hash_documento","documents":"documentos","terms_accepted":"terminos_aceptados","privacy_acknowledged":"privacidad_reconocida","adult_confirmed":"mayoria_edad_confirmada","sports_data_consent":"permiso_datos_deportivos"}'::jsonb;
 t record; c record; destino oid; original oid; tipo "char"; nuevo text;
BEGIN
 FOR t IN SELECT key AS anterior,value AS actual FROM jsonb_each_text(tablas) LOOP
  original:=to_regclass(format('%I.%I','gymbro',t.anterior));
  destino:=to_regclass(format('%I.%I','gymbro',t.actual));
  SELECT relkind INTO tipo FROM pg_class WHERE oid=original;
  IF tipo IN ('r','p') THEN
   IF destino IS NOT NULL THEN RAISE EXCEPTION 'Existen ambas tablas: % y %. Se cancela sin modificar datos.',t.anterior,t.actual; END IF;
   EXECUTE format('ALTER TABLE %I.%I RENAME TO %I','gymbro',t.anterior,t.actual);
   destino:=to_regclass(format('%I.%I','gymbro',t.actual));
  END IF;
  IF destino IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=destino AND relkind IN ('r','p')) THEN
   RAISE EXCEPTION 'Falta la tabla %. Aplicar primero las migraciones anteriores.',t.anterior;
  END IF;
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=destino AND attnum>0 AND NOT attisdropped ORDER BY attnum LOOP
   nuevo:=columnas->>c.attname;
   IF nuevo IS NULL THEN
    IF EXISTS(SELECT 1 FROM jsonb_each_text(columnas) WHERE value=c.attname) THEN CONTINUE; END IF;
    RAISE EXCEPTION 'Columna no contemplada: %.%. Revisar antes de migrar.',t.actual,c.attname;
   END IF;
   IF nuevo<>c.attname THEN
    IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=destino AND attname=nuevo AND NOT attisdropped) THEN
     RAISE EXCEPTION 'Existen ambas columnas en %: % y %.',t.actual,c.attname,nuevo;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I','gymbro',t.actual,c.attname,nuevo);
   END IF;
  END LOOP;
  IF t.actual='usuarios' AND (SELECT count(*) FROM pg_attribute WHERE attrelid=destino AND NOT attisdropped AND attname IN ('inicio_semana_ia','generaciones_ia_semana','fecha_cambio_contrasena','participa_ranking'))<>4 THEN
   RAISE EXCEPTION 'Faltan campos de usuarios. Aplicar las migraciones 04, 05 y 07 antes de traducir.';
  END IF;
  IF t.actual='ejercicios' AND (SELECT count(*) FROM pg_attribute WHERE attrelid=destino AND NOT attisdropped AND attname IN ('descripcion','enlace_video'))<>2 THEN
   RAISE EXCEPTION 'Faltan las guías de ejercicios. Aplicar la migración 06 antes de traducir.';
  END IF;
 END LOOP;
END $rename$;

-- PL/pgSQL guarda texto: sus referencias deben actualizarse explícitamente.
CREATE OR REPLACE FUNCTION "gymbro".gymbro_exercise_name_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
NEW.nombre_normalizado := gymbro_normalize_name(NEW.nombre);
PERFORM pg_advisory_xact_lock(hashtextextended(NEW.nombre_normalizado,0));
IF EXISTS (SELECT 1 FROM "gymbro".ejercicios e WHERE e.id<>NEW.id AND e.nombre_normalizado=NEW.nombre_normalizado
AND (e.creado_por_usuario_id IS NULL OR NEW.creado_por_usuario_id IS NULL OR e.creado_por_usuario_id=NEW.creado_por_usuario_id))
THEN RAISE EXCEPTION 'El ejercicio ya existe en ese catálogo' USING ERRCODE='23505'; END IF;
RETURN NEW; END $$;
ALTER FUNCTION "gymbro".gymbro_exercise_name_guard() SET search_path TO "gymbro", pg_temp;

-- Vistas simples actualizables para el backend anterior durante el despliegue.
-- security_invoker conserva los permisos y las políticas de la tabla real.
DO $compatibility$
DECLARE
 tablas jsonb := '{"users":"usuarios","user_rest_days":"dias_descanso_usuario","exercises":"ejercicios","routines":"rutinas","routine_days":"dias_rutina","routine_exercises":"ejercicios_rutina","routine_schedules":"horarios_rutina","training_sessions":"sesiones_entrenamiento","performed_exercises":"ejercicios_realizados","performed_sets":"series_realizadas","body_weight_histories":"historial_peso_corporal","strength_records":"marcas_fuerza","session_mutations":"operaciones_sesion","welcome_plans":"planes_iniciales","legal_acceptances":"consentimientos_legales","schema_migrations":"migraciones_esquema"}'::jsonb;
 columnas jsonb := '{"active":"activa","id":"id","version":"version","email":"correo_electronico","password_hash":"hash_contrasena","name":"nombre","goal":"objetivo","height_cm":"altura_cm","gym_name":"nombre_gimnasio","discipline":"disciplina","photo_url":"foto_url","created_at":"fecha_creacion","updated_at":"fecha_actualizacion","deleted_at":"fecha_eliminacion","leaderboard_opt_in":"participa_ranking","password_changed_at":"fecha_cambio_contrasena","ai_week_start":"inicio_semana_ia","ai_weekly_used":"generaciones_ia_semana","weekday":"dia_semana","user_id":"usuario_id","preferences":"preferencias","proposal":"propuesta","source":"origen","accepted_at":"fecha_aceptacion","skipped_at":"fecha_omision","routine_id":"rutina_id","normalized_name":"nombre_normalizado","muscle_group":"grupo_muscular","equipment":"equipamiento","movement_pattern":"patron_movimiento","training_type":"tipo_entrenamiento","created_by_user_id":"creado_por_usuario_id","description":"descripcion","video_url":"enlace_video","favorite":"favorita","day_number":"numero_dia","routine_day_id":"dia_rutina_id","order":"orden","target_sets":"series_objetivo","min_reps":"repeticiones_minimas","max_reps":"repeticiones_maximas","rest_seconds":"descanso_segundos","target_duration_minutes":"duracion_objetivo_minutos","target_distance_km":"distancia_objetivo_km","intensity":"intensidad","exercise_id":"ejercicio_id","start_time":"hora_inicio","end_time":"hora_fin","started_at":"fecha_inicio","finished_at":"fecha_fin","duration_seconds":"duracion_segundos","status":"estado","calories":"calorias","total_volume_kg":"volumen_total_kg","session_id":"sesion_id","set_number":"numero_serie","weight_kg":"peso_kg","repetitions":"repeticiones","actual_rest_seconds":"descanso_real_segundos","completed_at":"fecha_finalizacion","performed_exercise_id":"ejercicio_realizado_id","recorded_at":"fecha_registro","max_weight_kg":"peso_maximo_kg","estimated_one_rm":"estimacion_1rm","achieved_at":"fecha_marca","kind":"tipo","request_hash":"hash_solicitud","response":"respuesta","status_code":"codigo_estado","applied_at":"fecha_aplicacion","document_hash":"hash_documento","documents":"documentos","terms_accepted":"terminos_aceptados","privacy_acknowledged":"privacidad_reconocida","adult_confirmed":"mayoria_edad_confirmada","sports_data_consent":"permiso_datos_deportivos"}'::jsonb;
 t record; seleccion text; permiso text; destino oid;
BEGIN
 FOR t IN SELECT key AS anterior,value AS actual FROM jsonb_each_text(tablas) LOOP
  destino:=to_regclass(format('%I.%I','gymbro',t.actual));
  SELECT string_agg(format('%I AS %I',a.attname,(SELECT key FROM jsonb_each_text(columnas) WHERE value=a.attname)),', ' ORDER BY a.attnum)
   INTO seleccion FROM pg_attribute a WHERE a.attrelid=destino AND a.attnum>0 AND NOT a.attisdropped;
  EXECUTE format('CREATE OR REPLACE VIEW %I.%I WITH (security_invoker=true) AS SELECT %s FROM %I.%I','gymbro',t.anterior,seleccion,'gymbro',t.actual);
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC','gymbro',t.anterior);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
   FOREACH permiso IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF has_table_privilege('gymbro_backend',destino,permiso) THEN
     EXECUTE format('GRANT %s ON %I.%I TO gymbro_backend',permiso,'gymbro',t.anterior);
    END IF;
   END LOOP;
  END IF;
 END LOOP;
END $compatibility$;
INSERT INTO "gymbro".migraciones_esquema(version) VALUES ('20261103_nombres_espanol') ON CONFLICT DO NOTHING;
COMMIT;
SELECT table_name FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE' ORDER BY table_name;
