-- ====================================================================
-- SCRIPT DE OPTIMIZACION SQL Y BENCHMARKING (PUNTO 5)
-- Base de Datos: smartgymbro_tp (PostgreSQL 17 Alpine en Docker)
-- ====================================================================
-- CONSULTA 1: Historial Reciente de Peso de un Atleta (Perfil y Grafico)
-- Uso: Pantalla de Progreso (curva de peso reciente con LIMIT 30).
-- ====================================================================

-- 1. Medicion Inicial (ANTES de Optimizar - Forzando Sequential Scan):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
ORDER BY fecha_registro DESC
LIMIT 30;

-- 2. Solucion de Ingenieria (Creacion de Indice B-Tree Compuesto):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_usuario_fecha_desc
ON gymbro.historial_peso_corporal (usuario_id, fecha_registro DESC);

-- 3. Medicion Final (DESPUES de Optimizar - Index Scan):
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
ORDER BY fecha_registro DESC
LIMIT 30;


-- ====================================================================
-- CONSULTA 2: Rango Temporal de Evolucion Fisica (Ultimos 90 Dias)
-- Uso: Analisis trimestral de progreso corporal de un socio especifico.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
  AND fecha_registro >= NOW() - INTERVAL '90 days'
ORDER BY fecha_registro ASC;

-- 2. Solucion de Ingenieria (Indice B-Tree Compuesto por Clave y Fecha ASC):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_usuario_fecha_asc
ON gymbro.historial_peso_corporal (usuario_id, fecha_registro ASC);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
  AND fecha_registro >= NOW() - INTERVAL '90 days'
ORDER BY fecha_registro ASC;


-- ====================================================================
-- CONSULTA 3: Resumen Estadistico y Agregacion (Min, Max, Promedio)
-- Uso: Ficha medica del socio y metricas consolidadas en el perfil.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT usuario_id,
       COUNT(*) AS total_pesajes,
       MIN(peso_kg) AS peso_minimo,
       MAX(peso_kg) AS peso_maximo,
       ROUND(AVG(peso_kg)::numeric, 2) AS peso_promedio
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
GROUP BY usuario_id;

-- 2. Solucion de Ingenieria (Covering Index con Clausula INCLUDE):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_usuario_covering
ON gymbro.historial_peso_corporal (usuario_id) INCLUDE (peso_kg);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT usuario_id,
       COUNT(*) AS total_pesajes,
       MIN(peso_kg) AS peso_minimo,
       MAX(peso_kg) AS peso_maximo,
       ROUND(AVG(peso_kg)::numeric, 2) AS peso_promedio
FROM gymbro.historial_peso_corporal
WHERE usuario_id = '20f66d35-4381-40cd-9378-42fbf1bae143'
GROUP BY usuario_id;


-- ====================================================================
-- CONSULTA 4: Socios en Categoria Pesada (> 95 kg en Ultimos 60 Dias)
-- Uso: Clasificacion deportiva en torneos de levantamiento y JOIN con usuarios.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.nombre_gimnasio, u.disciplina, h.peso_kg, h.fecha_registro
FROM gymbro.historial_peso_corporal h
JOIN gymbro.usuarios u ON u.id = h.usuario_id
WHERE h.peso_kg > 95.0
  AND h.fecha_registro >= NOW() - INTERVAL '60 days';

-- 2. Solucion de Ingenieria (Indice Parcial Filtrado):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_parcial_categoria_pesada
ON gymbro.historial_peso_corporal (fecha_registro, usuario_id, peso_kg)
WHERE peso_kg > 95.0;

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.nombre_gimnasio, u.disciplina, h.peso_kg, h.fecha_registro
FROM gymbro.historial_peso_corporal h
JOIN gymbro.usuarios u ON u.id = h.usuario_id
WHERE h.peso_kg > 95.0
  AND h.fecha_registro >= NOW() - INTERVAL '60 days';


-- ====================================================================
-- CONSULTA 5: Ultimo Pesaje Vigente de Cada Socio (DISTINCT ON LIMIT 50)
-- Uso: Tablero de recepcion del gimnasio para control de estado actual.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT ON (usuario_id) usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
ORDER BY usuario_id, fecha_registro DESC
LIMIT 50;

-- 2. Solucion de Ingenieria (Indice B-Tree Compuesto Ordenado):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_usuario_fecha_desc
ON gymbro.historial_peso_corporal (usuario_id, fecha_registro DESC);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT ON (usuario_id) usuario_id, peso_kg, fecha_registro
FROM gymbro.historial_peso_corporal
ORDER BY usuario_id, fecha_registro DESC
LIMIT 50;


-- ====================================================================
-- CONSULTA 6: Tendencia Global Mensual de Peso (Agrupacion date_trunc)
-- Uso: Reporte gerencial de estacionalidad y evolucion de toda la cadena.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT date_trunc('month', fecha_registro) AS mes,
       COUNT(*) AS registros_mes,
       ROUND(AVG(peso_kg)::numeric, 2) AS promedio_mensual
FROM gymbro.historial_peso_corporal
WHERE fecha_registro >= NOW() - INTERVAL '365 days'
GROUP BY date_trunc('month', fecha_registro)
ORDER BY mes ASC;

-- 2. Solucion de Ingenieria (Indice B-Tree en Fecha de Registro):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_peso_fecha_registro
ON gymbro.historial_peso_corporal (fecha_registro);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT date_trunc('month', fecha_registro) AS mes,
       COUNT(*) AS registros_mes,
       ROUND(AVG(peso_kg)::numeric, 2) AS promedio_mensual
FROM gymbro.historial_peso_corporal
WHERE fecha_registro >= NOW() - INTERVAL '365 days'
GROUP BY date_trunc('month', fecha_registro)
ORDER BY mes ASC;


-- ====================================================================
-- CONSULTA 7: Leaderboard de Fuerza (Top 10 en Press de Banca por 1RM)
-- Uso: Ranking de gamificacion de la comunidad GymBro (Marcas de Fuerza).
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.nombre_gimnasio, e.nombre AS ejercicio, m.estimacion_1rm, m.fecha_marca
FROM gymbro.marcas_fuerza m
JOIN gymbro.usuarios u ON u.id = m.usuario_id
JOIN gymbro.ejercicios e ON e.id = m.ejercicio_id
WHERE e.nombre ILIKE '%press de banca%'
ORDER BY m.estimacion_1rm DESC
LIMIT 10;

-- 2. Solucion de Ingenieria (Indice Compuesto en Marcas de Fuerza):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_marcas_ejercicio_1rm
ON gymbro.marcas_fuerza (ejercicio_id, estimacion_1rm DESC);

CREATE INDEX IF NOT EXISTS idx_ejercicios_nombre
ON gymbro.ejercicios (nombre);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.nombre_gimnasio, e.nombre AS ejercicio, m.estimacion_1rm, m.fecha_marca
FROM gymbro.marcas_fuerza m
JOIN gymbro.usuarios u ON u.id = m.usuario_id
JOIN gymbro.ejercicios e ON e.id = m.ejercicio_id
WHERE e.nombre ILIKE '%press de banca%'
ORDER BY m.estimacion_1rm DESC
LIMIT 10;


-- ====================================================================
-- CONSULTA 8: Sesiones de Alto Rendimiento y Gasto Calorico (> 450 kcal)
-- Uso: Auditoria de entrenamientos de alta intensidad y engagement.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.disciplina, s.fecha_inicio, s.duracion_segundos, s.calorias, s.volumen_total_kg
FROM gymbro.sesiones_entrenamiento s
JOIN gymbro.usuarios u ON s.usuario_id = u.id
WHERE s.estado = 'COMPLETED'
  AND s.calorias > 450
  AND s.fecha_inicio >= NOW() - interval '30 days'
ORDER BY s.calorias DESC
LIMIT 20;


-- 2. Solucion de Ingenieria (Indice Parcial Compuesto en Sesiones):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_sesiones_completadas_calorias
ON gymbro.sesiones_entrenamiento (calorias DESC, fecha_inicio)
WHERE estado = 'COMPLETED';

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.nombre, u.disciplina, s.fecha_inicio, s.duracion_segundos, s.calorias, s.volumen_total_kg
FROM gymbro.sesiones_entrenamiento s
JOIN gymbro.usuarios u ON s.usuario_id = u.id
WHERE s.estado = 'COMPLETED'
  AND s.calorias > 450
  AND s.fecha_inicio >= NOW() - interval '30 days'
ORDER BY s.calorias DESC
LIMIT 20;


