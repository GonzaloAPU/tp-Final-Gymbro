/** Migración por RENAME: conserva filas, UUID, relaciones, índices y permisos. */
import {spanishTables,spanishColumns} from './database-names.js';
import {exerciseGuardSql} from './schema-integrity.js';
export const spanishSchemaVersion='20261103_nombres_espanol';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
export function spanishSchemaSql(schema){
 if(!['public','gymbro'].includes(schema))throw Error('Esquema no permitido');
 const guard=exerciseGuardSql
  .replace('FUNCTION gymbro_exercise_name_guard()',`FUNCTION "${schema}".gymbro_exercise_name_guard()`)
  .replace('FROM exercises e',`FROM "${schema}".ejercicios e`)
  .replace(/\b(normalized_name|created_by_user_id|name)\b/g,name=>spanishColumns[name]);
 return `SET LOCAL search_path TO "${schema}", public;
SELECT pg_advisory_xact_lock(20261103);
-- Todos los cambios ocurren dentro de la transacción del llamador.
DO $rename$
DECLARE
 tablas jsonb := ${literal(spanishTables)};
 columnas jsonb := ${literal(spanishColumns)};
 t record; c record; destino oid; original oid; tipo "char"; nuevo text;
BEGIN
 FOR t IN SELECT key AS anterior,value AS actual FROM jsonb_each_text(tablas) LOOP
  original:=to_regclass(format('%I.%I','${schema}',t.anterior));
  destino:=to_regclass(format('%I.%I','${schema}',t.actual));
  SELECT relkind INTO tipo FROM pg_class WHERE oid=original;
  IF tipo IN ('r','p') THEN
   IF destino IS NOT NULL THEN RAISE EXCEPTION 'Existen ambas tablas: % y %. Se cancela sin modificar datos.',t.anterior,t.actual; END IF;
   EXECUTE format('ALTER TABLE %I.%I RENAME TO %I','${schema}',t.anterior,t.actual);
   destino:=to_regclass(format('%I.%I','${schema}',t.actual));
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
    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I','${schema}',t.actual,c.attname,nuevo);
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
${guard};
ALTER FUNCTION "${schema}".gymbro_exercise_name_guard() SET search_path TO "${schema}", pg_temp;

-- Vistas simples actualizables para el backend anterior durante el despliegue.
-- security_invoker conserva los permisos y las políticas de la tabla real.
DO $compatibility$
DECLARE
 tablas jsonb := ${literal(spanishTables)};
 columnas jsonb := ${literal(spanishColumns)};
 t record; seleccion text; permiso text; destino oid;
BEGIN
 FOR t IN SELECT key AS anterior,value AS actual FROM jsonb_each_text(tablas) LOOP
  destino:=to_regclass(format('%I.%I','${schema}',t.actual));
  SELECT string_agg(format('%I AS %I',a.attname,(SELECT key FROM jsonb_each_text(columnas) WHERE value=a.attname)),', ' ORDER BY a.attnum)
   INTO seleccion FROM pg_attribute a WHERE a.attrelid=destino AND a.attnum>0 AND NOT a.attisdropped;
  EXECUTE format('CREATE OR REPLACE VIEW %I.%I WITH (security_invoker=true) AS SELECT %s FROM %I.%I','${schema}',t.anterior,seleccion,'${schema}',t.actual);
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC','${schema}',t.anterior);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gymbro_backend') THEN
   FOREACH permiso IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF has_table_privilege('gymbro_backend',destino,permiso) THEN
     EXECUTE format('GRANT %s ON %I.%I TO gymbro_backend',permiso,'${schema}',t.anterior);
    END IF;
   END LOOP;
  END IF;
 END LOOP;
END $compatibility$;
INSERT INTO "${schema}".migraciones_esquema(version) VALUES ('${spanishSchemaVersion}') ON CONFLICT DO NOTHING;`;
}
