# Traducción de la base de datos

La API y las propiedades JavaScript conservan sus nombres para mantener compatible la APK. PostgreSQL usa nombres en español sin tildes ni ñ. Los UUID y todos los registros se conservan. Los valores de estado (POWER, COMPLETED, etc.) no cambian.

## Despliegue

1. Conservar una copia de seguridad antes del cambio de nombres.
2. Ejecutar `postgres/sql/08-nombres-espanol.sql` como administrador en Supabase. Requiere las migraciones anteriores, incluida la 07. Si hay una tabla o columna desconocida, o un nombre ambiguo, la transacción se cancela. No ejecutar el instalador 01 sobre una base existente.
3. Configurar `DB_NAMES_LANGUAGE=es` en Render y en el entorno local cuya base ya esté traducida; desplegar el backend nuevo. Mientras se mantiene `en` (valor predeterminado), las vistas de compatibilidad permiten usar el backend anterior con los mismos datos.
4. Verificar ingreso, calendario, entrenamiento, ranking y cupo de IA. Las vistas en inglés no duplican filas. Mantenerlas durante la transición; las tablas reales quedan en español.

Las relaciones, restricciones, índices y permisos existentes siguen vinculados a los mismos objetos. Se actualiza el cuerpo del trigger del catálogo. Los nombres internos de índices, restricciones y funciones pueden conservar su denominación histórica: esta migración traduce tablas y columnas.

Las migraciones históricas 01–07 siguen documentando el esquema anterior. Para una instalación nueva, aplicar 01, crear el rol con 02 y aplicar 08; el instalador 01 ya contiene los cambios 03–07. No se borran ni recrean tablas con datos.

## Tablas

| Anterior | Español |
|---|---|
| `users` | `usuarios` |
| `user_rest_days` | `dias_descanso_usuario` |
| `exercises` | `ejercicios` |
| `routines` | `rutinas` |
| `routine_days` | `dias_rutina` |
| `routine_exercises` | `ejercicios_rutina` |
| `routine_schedules` | `horarios_rutina` |
| `training_sessions` | `sesiones_entrenamiento` |
| `performed_exercises` | `ejercicios_realizados` |
| `performed_sets` | `series_realizadas` |
| `body_weight_histories` | `historial_peso_corporal` |
| `strength_records` | `marcas_fuerza` |
| `session_mutations` | `operaciones_sesion` |
| `welcome_plans` | `planes_iniciales` |
| `legal_acceptances` | `consentimientos_legales` |
| `schema_migrations` | `migraciones_esquema` |

## Campos

| Anterior | Español |
|---|---|
| `active` | `activa` |
| `id` | `id` |
| `version` | `version` |
| `email` | `correo_electronico` |
| `password_hash` | `hash_contrasena` |
| `name` | `nombre` |
| `goal` | `objetivo` |
| `height_cm` | `altura_cm` |
| `gym_name` | `nombre_gimnasio` |
| `discipline` | `disciplina` |
| `photo_url` | `foto_url` |
| `created_at` | `fecha_creacion` |
| `updated_at` | `fecha_actualizacion` |
| `deleted_at` | `fecha_eliminacion` |
| `leaderboard_opt_in` | `participa_ranking` |
| `password_changed_at` | `fecha_cambio_contrasena` |
| `ai_week_start` | `inicio_semana_ia` |
| `ai_weekly_used` | `generaciones_ia_semana` |
| `weekday` | `dia_semana` |
| `user_id` | `usuario_id` |
| `preferences` | `preferencias` |
| `proposal` | `propuesta` |
| `source` | `origen` |
| `accepted_at` | `fecha_aceptacion` |
| `skipped_at` | `fecha_omision` |
| `routine_id` | `rutina_id` |
| `normalized_name` | `nombre_normalizado` |
| `muscle_group` | `grupo_muscular` |
| `equipment` | `equipamiento` |
| `movement_pattern` | `patron_movimiento` |
| `training_type` | `tipo_entrenamiento` |
| `created_by_user_id` | `creado_por_usuario_id` |
| `description` | `descripcion` |
| `video_url` | `enlace_video` |
| `favorite` | `favorita` |
| `day_number` | `numero_dia` |
| `routine_day_id` | `dia_rutina_id` |
| `order` | `orden` |
| `target_sets` | `series_objetivo` |
| `min_reps` | `repeticiones_minimas` |
| `max_reps` | `repeticiones_maximas` |
| `rest_seconds` | `descanso_segundos` |
| `target_duration_minutes` | `duracion_objetivo_minutos` |
| `target_distance_km` | `distancia_objetivo_km` |
| `intensity` | `intensidad` |
| `exercise_id` | `ejercicio_id` |
| `start_time` | `hora_inicio` |
| `end_time` | `hora_fin` |
| `started_at` | `fecha_inicio` |
| `finished_at` | `fecha_fin` |
| `duration_seconds` | `duracion_segundos` |
| `status` | `estado` |
| `calories` | `calorias` |
| `total_volume_kg` | `volumen_total_kg` |
| `session_id` | `sesion_id` |
| `set_number` | `numero_serie` |
| `weight_kg` | `peso_kg` |
| `repetitions` | `repeticiones` |
| `actual_rest_seconds` | `descanso_real_segundos` |
| `completed_at` | `fecha_finalizacion` |
| `performed_exercise_id` | `ejercicio_realizado_id` |
| `recorded_at` | `fecha_registro` |
| `max_weight_kg` | `peso_maximo_kg` |
| `estimated_one_rm` | `estimacion_1rm` |
| `achieved_at` | `fecha_marca` |
| `kind` | `tipo` |
| `request_hash` | `hash_solicitud` |
| `response` | `respuesta` |
| `status_code` | `codigo_estado` |
| `applied_at` | `fecha_aplicacion` |
| `document_hash` | `hash_documento` |
| `documents` | `documentos` |
| `terms_accepted` | `terminos_aceptados` |
| `privacy_acknowledged` | `privacidad_reconocida` |
| `adult_confirmed` | `mayoria_edad_confirmada` |
| `sports_data_consent` | `permiso_datos_deportivos` |

Regenerar este documento y el SQL: `node tools/build-spanish-schema.mjs`.
