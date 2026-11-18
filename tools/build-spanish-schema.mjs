/** Produce el SQL entregable y el diccionario; nunca se conecta a PostgreSQL. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spanishSchemaSql} from '../backend/src/services/spanish-schema.js';
import {spanishTables,spanishColumns} from '../backend/src/services/database-names.js';
const sql=`-- Ejecutar en Supabase como administrador DESPUÉS de 01 a 07.
-- Renombra objetos sin borrar registros. Conserva vistas de compatibilidad.
-- Después del SQL, desplegar el backend con DB_NAMES_LANGUAGE=es.
BEGIN;
SET LOCAL lock_timeout='10s';
${spanishSchemaSql('gymbro')}
COMMIT;
SELECT table_name FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE' ORDER BY table_name;
`;
fs.writeFileSync(fileURLToPath(new URL('../postgres/sql/08-nombres-espanol.sql',import.meta.url)),sql);
const list=map=>Object.entries(map).map(([from,to])=>`| \`${from}\` | \`${to}\` |`).join('\n');
fs.writeFileSync(fileURLToPath(new URL('../docs/NOMBRES-BASE-ESPANOL.md',import.meta.url)),`# Traducción de la base de datos

La API y las propiedades JavaScript conservan sus nombres para mantener compatible la APK. PostgreSQL usa nombres en español sin tildes ni ñ. Los UUID y todos los registros se conservan. Los valores de estado (POWER, COMPLETED, etc.) no cambian.

## Despliegue

1. Conservar una copia de seguridad antes del cambio de nombres.
2. Ejecutar \`postgres/sql/08-nombres-espanol.sql\` como administrador en Supabase. Requiere las migraciones anteriores, incluida la 07. Si hay una tabla o columna desconocida, o un nombre ambiguo, la transacción se cancela. No ejecutar el instalador 01 sobre una base existente.
3. Configurar \`DB_NAMES_LANGUAGE=es\` en Render y en el entorno local cuya base ya esté traducida; desplegar el backend nuevo. Mientras se mantiene \`en\` (valor predeterminado), las vistas de compatibilidad permiten usar el backend anterior con los mismos datos.
4. Verificar ingreso, calendario, entrenamiento, ranking y cupo de IA. Las vistas en inglés no duplican filas. Mantenerlas durante la transición; las tablas reales quedan en español.

Las relaciones, restricciones, índices y permisos existentes siguen vinculados a los mismos objetos. Se actualiza el cuerpo del trigger del catálogo. Los nombres internos de índices, restricciones y funciones pueden conservar su denominación histórica: esta migración traduce tablas y columnas.

Las migraciones históricas 01–07 siguen documentando el esquema anterior. Para una instalación nueva, aplicar 01, crear el rol con 02 y aplicar 08; el instalador 01 ya contiene los cambios 03–07. No se borran ni recrean tablas con datos.

## Tablas

| Anterior | Español |
|---|---|
${list(spanishTables)}

## Campos

| Anterior | Español |
|---|---|
${list(spanishColumns)}

Regenerar este documento y el SQL: \`node tools/build-spanish-schema.mjs\`.
`);
console.log('SQL 08 y diccionario generados sin conexiones externas.');
