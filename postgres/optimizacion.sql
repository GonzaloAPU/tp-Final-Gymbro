SET search_path TO gymbro, public;

-- ====================================================================
-- CONSULTA 1: Historial de Series de un Ejercicio en Sala
-- Uso: Pantalla activa de entrenamiento del atleta. Muestra las series completadas
--      de un ejercicio realizado ordenadas cronologicamente por numero de serie.
-- ====================================================================

-- 1. Medicion Inicial (ANTES de Optimizar):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, descanso_real_segundos
FROM gymbro.series_realizadas
WHERE ejercicio_realizado_id = (SELECT id FROM gymbro.ejercicios_realizados LIMIT 1)
ORDER BY numero_serie ASC;

-- 2. Solucion de Ingenieria (Creacion de Indice B-Tree Compuesto):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_series_ejercicio_set
ON gymbro.series_realizadas (ejercicio_realizado_id, numero_serie ASC);

-- 3. Medicion Final (DESPUES de Optimizar):
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, descanso_real_segundos
FROM gymbro.series_realizadas
WHERE ejercicio_realizado_id = (SELECT id FROM gymbro.ejercicios_realizados LIMIT 1)
ORDER BY numero_serie ASC;


-- ====================================================================
-- CONSULTA 2: Series Pesadas y Sobrecarga Progresiva (Rango Compuesto)
-- Uso: Analisis de progreso de fuerza. Filtra series de alta exigencia (peso >= 90kg y reps >= 8).
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, fecha_finalizacion
FROM gymbro.series_realizadas
WHERE peso_kg >= 90.0 AND repeticiones >= 8
ORDER BY fecha_finalizacion DESC
LIMIT 50;

-- 2. Solucion de Ingenieria (Indice B-Tree Compuesto por Carga, Repeticiones y Fecha):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_series_peso_reps_fecha
ON gymbro.series_realizadas (peso_kg DESC, repeticiones DESC, fecha_finalizacion DESC);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, fecha_finalizacion
FROM gymbro.series_realizadas
WHERE peso_kg >= 90.0 AND repeticiones >= 8
ORDER BY fecha_finalizacion DESC
LIMIT 50;


-- ====================================================================
-- CONSULTA 3: Resumen Estadistico y Volumen de Carga (Agregacion)
-- Uso: Resumen de fin de ejercicio. Calcula total de series, volumen (kg*reps), max y promedio.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT ejercicio_realizado_id,
       COUNT(*) AS total_series,
       SUM(peso_kg * repeticiones) AS volumen_total_kg,
       MAX(peso_kg) AS peso_maximo,
       ROUND(AVG(peso_kg)::numeric, 2) AS peso_promedio
FROM gymbro.series_realizadas
WHERE ejercicio_realizado_id = (SELECT id FROM gymbro.ejercicios_realizados LIMIT 1)
GROUP BY ejercicio_realizado_id;

-- 2. Solucion de Ingenieria (Covering Index con Clausula INCLUDE para Index Only Scan):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_series_ejercicio_covering
ON gymbro.series_realizadas (ejercicio_realizado_id) INCLUDE (peso_kg, repeticiones, numero_serie);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT ejercicio_realizado_id,
       COUNT(*) AS total_series,
       SUM(peso_kg * repeticiones) AS volumen_total_kg,
       MAX(peso_kg) AS peso_maximo,
       ROUND(AVG(peso_kg)::numeric, 2) AS peso_promedio
FROM gymbro.series_realizadas
WHERE ejercicio_realizado_id = (SELECT id FROM gymbro.ejercicios_realizados LIMIT 1)
GROUP BY ejercicio_realizado_id;


-- ====================================================================
-- CONSULTA 4: Atletas de Elite y Series de Alta Intensidad (Carga >= 100 kg)
-- Uso: Deteccion de series de atletas avanzados en los ultimos 60 dias.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT sr.id, sr.ejercicio_realizado_id, sr.numero_serie, sr.peso_kg, sr.repeticiones, sr.fecha_finalizacion
FROM gymbro.series_realizadas sr
WHERE sr.peso_kg >= 100.0
  AND sr.fecha_finalizacion >= NOW() - INTERVAL '60 days'
ORDER BY sr.fecha_finalizacion DESC
LIMIT 50;

-- 2. Solucion de Ingenieria (Indice Parcial Filtrado WHERE peso_kg >= 100.0):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_series_parcial_alta_carga
ON gymbro.series_realizadas (fecha_finalizacion DESC, ejercicio_realizado_id, peso_kg)
WHERE peso_kg >= 100.0;

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT sr.id, sr.ejercicio_realizado_id, sr.numero_serie, sr.peso_kg, sr.repeticiones, sr.fecha_finalizacion
FROM gymbro.series_realizadas sr
WHERE sr.peso_kg >= 100.0
  AND sr.fecha_finalizacion >= NOW() - INTERVAL '60 days'
ORDER BY sr.fecha_finalizacion DESC
LIMIT 50;


-- ====================================================================
-- CONSULTA 5: Ventana Temporal y Monitoreo de Series Recientes (Ultimos 14 Dias)
-- Uso: Dashboard de actividad operativa en tiempo real del gimnasio.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, fecha_finalizacion
FROM gymbro.series_realizadas
WHERE fecha_finalizacion >= NOW() - INTERVAL '14 days'
ORDER BY fecha_finalizacion DESC
LIMIT 50;

-- 2. Solucion de Ingenieria (Indice B-Tree en Fecha de Finalizacion DESC):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_series_fecha_finalizacion
ON gymbro.series_realizadas (fecha_finalizacion DESC);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ejercicio_realizado_id, numero_serie, peso_kg, repeticiones, fecha_finalizacion
FROM gymbro.series_realizadas
WHERE fecha_finalizacion >= NOW() - INTERVAL '14 days'
ORDER BY fecha_finalizacion DESC
LIMIT 50;


-- ====================================================================
-- CONSULTA 6: Volumen Total Acumulado por Ejercicio del Catalogo Oficial (JOIN)
-- Uso: Reporte gerencial de ejercicios con mayor adherencia y tonelaje levantado.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT e.nombre AS ejercicio,
       COUNT(sr.id) AS total_series_ejecutadas,
       ROUND(SUM(sr.peso_kg * sr.repeticiones)::numeric, 2) AS volumen_acumulado_kg
FROM gymbro.series_realizadas sr
JOIN gymbro.ejercicios_realizados er ON er.id = sr.ejercicio_realizado_id
JOIN gymbro.ejercicios e ON e.id = er.ejercicio_id
WHERE sr.fecha_finalizacion >= NOW() - INTERVAL '180 days'
GROUP BY e.nombre
ORDER BY volumen_acumulado_kg DESC
LIMIT 10;

-- 2. Solucion de Ingenieria (Indice B-Tree Compuesto en Clave Foranea de Ejercicios Realizados):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_ejercicios_realizados_ejercicio_id
ON gymbro.ejercicios_realizados (ejercicio_id, id);

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.nombre AS ejercicio,
       COUNT(sr.id) AS total_series_ejecutadas,
       ROUND(SUM(sr.peso_kg * sr.repeticiones)::numeric, 2) AS volumen_acumulado_kg
FROM gymbro.series_realizadas sr
JOIN gymbro.ejercicios_realizados er ON er.id = sr.ejercicio_realizado_id
JOIN gymbro.ejercicios e ON e.id = er.ejercicio_id
WHERE sr.fecha_finalizacion >= NOW() - INTERVAL '180 days'
GROUP BY e.nombre
ORDER BY volumen_acumulado_kg DESC
LIMIT 10;


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
WHERE e.nombre ILIKE '%press banca%'
ORDER BY m.estimacion_1rm DESC
LIMIT 10;

-- 2. Solucion de Ingenieria (Indices Compuestos en Marcas de Fuerza y Ejercicios):
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
WHERE e.nombre ILIKE '%press banca%'
ORDER BY m.estimacion_1rm DESC
LIMIT 10;


-- ====================================================================
-- CONSULTA 8: Sesiones de Alto Rendimiento y Gasto Calorico (> 450 kcal)
-- Uso: Auditoria de entrenamientos de alta intensidad completados en la plataforma.
-- ====================================================================

-- 1. Medicion Inicial (ANTES):
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS)
SELECT s.id, u.nombre, s.calorias, s.duracion_segundos, s.volumen_total_kg, s.fecha_inicio
FROM gymbro.sesiones_entrenamiento s
JOIN gymbro.usuarios u ON u.id = s.usuario_id
WHERE s.estado = 'COMPLETED'
  AND s.calorias > 450.0
ORDER BY s.calorias DESC, s.fecha_inicio DESC
LIMIT 50;

-- 2. Solucion de Ingenieria (Indice Parcial Compuesto en Sesiones Completadas):
SET enable_indexscan = on;
SET enable_bitmapscan = on;

CREATE INDEX IF NOT EXISTS idx_sesiones_completadas_calorias
ON gymbro.sesiones_entrenamiento (calorias DESC, fecha_inicio)
WHERE estado = 'COMPLETED';

-- 3. Medicion Final (DESPUES):
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.id, u.nombre, s.calorias, s.duracion_segundos, s.volumen_total_kg, s.fecha_inicio
FROM gymbro.sesiones_entrenamiento s
JOIN gymbro.usuarios u ON u.id = s.usuario_id
WHERE s.estado = 'COMPLETED'
  AND s.calorias > 450.0
ORDER BY s.calorias DESC, s.fecha_inicio DESC
LIMIT 50;
