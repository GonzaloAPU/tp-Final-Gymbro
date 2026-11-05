# Diagrama actualizado de Gymbro

Esquema PostgreSQL: `gymbro`. Generado desde los modelos Sequelize actuales, más la tabla técnica `schema_migrations`. Representa el esquema esperado tras aplicar las migraciones; no inspecciona ni modifica Supabase.

16 tablas, 19 claves foráneas. PK = clave primaria, FK = clave foránea, UK = unicidad de una columna. Las líneas punteadas representan relaciones no identificadoras. Un círculo permite cero; una barra indica uno; el extremo ramificado indica muchos.

## Vista completa

```mermaid
erDiagram
  direction LR
  users {
    uuid id PK "UUID; NOT NULL"
    varchar email UK "VARCHAR(255); NOT NULL"
    varchar password_hash "VARCHAR(255); NOT NULL"
    timestamptz ai_week_start "TIMESTAMP WITH TIME ZONE; NULL"
    integer ai_weekly_used "INTEGER; NOT NULL"
    timestamptz password_changed_at "TIMESTAMP WITH TIME ZONE; NULL"
    varchar name "VARCHAR(255); NOT NULL"
    varchar goal "VARCHAR(255); NULL"
    integer height_cm "INTEGER; NULL"
    varchar gym_name "VARCHAR(255); NULL"
    varchar discipline "VARCHAR(255); NULL"
    text photo_url "TEXT; NULL"
    boolean leaderboard_opt_in "BOOLEAN; NOT NULL"
    timestamptz created_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    timestamptz updated_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
  }
  legal_acceptances {
    uuid id PK "UUID; NOT NULL"
    varchar version "VARCHAR(80); NOT NULL"
    varchar document_hash "VARCHAR(64); NOT NULL"
    jsonb documents "JSONB; NOT NULL"
    boolean terms_accepted "BOOLEAN; NOT NULL"
    boolean privacy_acknowledged "BOOLEAN; NOT NULL"
    boolean adult_confirmed "BOOLEAN; NOT NULL"
    boolean sports_data_consent "BOOLEAN; NOT NULL"
    timestamptz accepted_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    uuid user_id FK "UUID; NOT NULL"
  }
  users ||..o{ legal_acceptances : "user_id"
  user_rest_days {
    uuid id PK "UUID; NOT NULL"
    integer weekday "INTEGER; NOT NULL"
    uuid user_id FK "UUID; NOT NULL"
  }
  users ||..o{ user_rest_days : "user_id"
  welcome_plans {
    uuid id PK "UUID; NOT NULL"
    jsonb preferences "JSONB; NOT NULL"
    jsonb proposal "JSONB; NOT NULL"
    varchar source "VARCHAR(16); NOT NULL"
    timestamptz accepted_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz skipped_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz created_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    timestamptz updated_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    uuid user_id FK, UK "UUID; NOT NULL"
    uuid routine_id FK "UUID; NULL"
  }
  users ||..o| welcome_plans : "user_id"
  routines |o..o{ welcome_plans : "routine_id"
  exercises {
    uuid id PK "UUID; NOT NULL"
    varchar name "VARCHAR(255); NOT NULL"
    varchar normalized_name "VARCHAR(255); NOT NULL"
    varchar muscle_group "VARCHAR(255); NOT NULL"
    varchar equipment "VARCHAR(255); NOT NULL"
    varchar movement_pattern "VARCHAR(255); NULL"
    text description "TEXT; NULL"
    text video_url "TEXT; NULL"
    varchar training_type "VARCHAR(255); NOT NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid created_by_user_id FK "UUID; NULL"
  }
  users |o..o{ exercises : "created_by_user_id"
  routines {
    uuid id PK "UUID; NOT NULL"
    varchar name "VARCHAR(255); NOT NULL"
    varchar goal "VARCHAR(255); NOT NULL"
    boolean active "BOOLEAN; NULL"
    timestamptz created_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid user_id FK "UUID; NOT NULL"
  }
  users ||..o{ routines : "user_id"
  routine_days {
    boolean favorite "BOOLEAN; NOT NULL"
    uuid id PK "UUID; NOT NULL"
    varchar name "VARCHAR(255); NOT NULL"
    integer day_number "INTEGER; NOT NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid routine_id FK "UUID; NOT NULL"
  }
  routines ||..o{ routine_days : "routine_id"
  routine_exercises {
    uuid id PK "UUID; NOT NULL"
    integer order "INTEGER; NOT NULL"
    integer target_sets "INTEGER; NOT NULL"
    integer min_reps "INTEGER; NOT NULL"
    integer max_reps "INTEGER; NOT NULL"
    integer rest_seconds "INTEGER; NULL"
    integer target_duration_minutes "INTEGER; NULL"
    numeric target_distance_km "DECIMAL(7,2); NULL"
    varchar intensity "VARCHAR(255); NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid routine_day_id FK "UUID; NOT NULL"
    uuid exercise_id FK "UUID; NOT NULL"
  }
  routine_days ||..o{ routine_exercises : "routine_day_id"
  exercises ||..o{ routine_exercises : "exercise_id"
  routine_schedules {
    uuid id PK "UUID; NOT NULL"
    integer weekday "INTEGER; NOT NULL"
    time start_time "TIME; NOT NULL"
    time end_time "TIME; NOT NULL"
    timestamptz created_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    timestamptz updated_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    uuid routine_day_id FK "UUID; NOT NULL"
  }
  routine_days ||..o{ routine_schedules : "routine_day_id"
  training_sessions {
    uuid id PK "UUID; NOT NULL"
    timestamptz started_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz finished_at "TIMESTAMP WITH TIME ZONE; NULL"
    integer duration_seconds "INTEGER; NULL"
    enum status "ENUM; NULL"
    numeric calories "DECIMAL(7,2); NULL"
    numeric total_volume_kg "DECIMAL(12,2); NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid user_id FK "UUID; NOT NULL"
    uuid routine_day_id FK "UUID; NULL"
  }
  users ||..o{ training_sessions : "user_id"
  routine_days |o..o{ training_sessions : "routine_day_id"
  performed_exercises {
    uuid id PK "UUID; NOT NULL"
    integer order "INTEGER; NOT NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid session_id FK "UUID; NOT NULL"
    uuid exercise_id FK "UUID; NOT NULL"
  }
  training_sessions ||..o{ performed_exercises : "session_id"
  exercises ||..o{ performed_exercises : "exercise_id"
  performed_sets {
    uuid id PK "UUID; NOT NULL"
    integer set_number "INTEGER; NOT NULL"
    numeric weight_kg "DECIMAL(7,2); NOT NULL"
    integer repetitions "INTEGER; NOT NULL"
    integer duration_seconds "INTEGER; NULL"
    integer actual_rest_seconds "INTEGER; NULL"
    timestamptz completed_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid performed_exercise_id FK "UUID; NOT NULL"
  }
  performed_exercises ||..o{ performed_sets : "performed_exercise_id"
  session_mutations {
    uuid id PK "UUID; NOT NULL"
    varchar kind "VARCHAR(20); NOT NULL"
    varchar request_hash "VARCHAR(64); NOT NULL"
    jsonb response "JSONB; NOT NULL"
    integer status_code "INTEGER; NOT NULL"
    timestamptz created_at "TIMESTAMP WITH TIME ZONE; NOT NULL"
    uuid session_id FK "UUID; NOT NULL"
  }
  training_sessions ||..o{ session_mutations : "session_id"
  body_weight_histories {
    uuid id PK "UUID; NOT NULL"
    numeric weight_kg "DECIMAL(5,2); NOT NULL"
    timestamptz recorded_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid user_id FK "UUID; NOT NULL"
  }
  users ||..o{ body_weight_histories : "user_id"
  strength_records {
    uuid id PK "UUID; NOT NULL"
    numeric max_weight_kg "DECIMAL(7,2); NOT NULL"
    integer repetitions "INTEGER; NOT NULL"
    numeric estimated_one_rm "DECIMAL(7,2); NOT NULL"
    timestamptz achieved_at "TIMESTAMP WITH TIME ZONE; NULL"
    timestamptz deleted_at "TIMESTAMP WITH TIME ZONE; NULL"
    uuid user_id FK "UUID; NOT NULL"
    uuid exercise_id FK "UUID; NOT NULL"
  }
  users ||..o{ strength_records : "user_id"
  exercises ||..o{ strength_records : "exercise_id"
  schema_migrations {
    varchar version PK "VARCHAR(80); NOT NULL"
    timestamptz applied_at "NOT NULL; DEFAULT now()"
  }
```

## Cambios recientes

- `users.ai_week_start` y `users.ai_weekly_used`: cupo de tres generaciones de IA por semana. La migración 07 agrega estos campos y la restricción entre 0 y 3.
- `users.password_changed_at`: revocación de sesiones después del cambio de contraseña. Los tokens de recuperación no se almacenan en una tabla.
- `users.leaderboard_opt_in` y `legal_acceptances`: participación en el ranking y recibos de consentimiento.
- `exercises.description` y `exercises.video_url`: instrucciones y enlace al video, sin almacenar el video.
- `welcome_plans`: conserva una propuesta por usuario. Sus preferencias y propuesta son JSONB; al aceptar se crean rutinas, ejercicios y horarios normalizados.
- `session_mutations`: recibos durables que evitan aplicar dos veces la misma operación al sincronizar entrenamientos.

## Cómo se organiza

- Planificación: `routines → routine_days → routine_exercises`. Los horarios viven en `routine_schedules`; `day_number` es un orden interno y `weekday` identifica el día semanal.
- Ejecución real: `training_sessions → performed_exercises → performed_sets`.
- `strength_records` sigue presente por compatibilidad. Las marcas personales y el ranking actuales se calculan desde `performed_sets` de sesiones completadas. El ranking no tiene una tabla propia.
- `created_by_user_id` nulo identifica un ejercicio oficial; con usuario identifica un ejercicio privado.
- `deleted_at` permite borrar lógicamente sin eliminar físicamente los registros históricos.
- `schema_migrations` es una tabla técnica independiente, sin FK.

## Unicidad compuesta

Además del email único y de una propuesta por usuario, hay índices únicos sobre:

- `user_rest_days(user_id, weekday)`.
- `routine_days(routine_id, day_number)`.
- `routine_exercises(routine_day_id, order)`.
- `routine_schedules(routine_day_id, weekday, start_time, end_time)`.
- `performed_exercises(session_id, order)`.
- `performed_sets(performed_exercise_id, set_number)`.

El catálogo también protege la unicidad del nombre normalizado mediante índices y trigger: distingue ejercicios oficiales de privados.

Para regenerar: `node tools/build-database-diagram.mjs`. El SQL entregable está en `postgres/sql`.
