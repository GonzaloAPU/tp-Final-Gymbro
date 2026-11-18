-- ====================================================================
-- SMARTGYMBRO - DDL DE INDICES DE OPTIMIZACION (PUNTO 5)
-- Tabla de Movimiento Principal: gymbro.series_realizadas (6.000.000 filas)
-- Tablas Relacionadas: ejercicios_realizados, sesiones_entrenamiento, marcas_fuerza, ejercicios
-- ====================================================================

SET search_path TO gymbro, public;

-- Limpieza de indices previos obsoletos (si existieran)
DROP INDEX IF EXISTS gymbro.idx_peso_usuario_fecha_desc;
DROP INDEX IF EXISTS gymbro.idx_peso_usuario_fecha_asc;
DROP INDEX IF EXISTS gymbro.idx_peso_usuario_covering;
DROP INDEX IF EXISTS gymbro.idx_peso_parcial_categoria_pesada;
DROP INDEX IF EXISTS gymbro.idx_peso_fecha_registro;

-- 1. Indice B-Tree Compuesto para Historial de Series de un Ejercicio (Consulta 1)
-- Permite acceso directo al ejercicio realizado y ordenamiento por numero de serie sin Sort adicional
CREATE INDEX IF NOT EXISTS idx_series_ejercicio_set
ON gymbro.series_realizadas (ejercicio_realizado_id, numero_serie ASC);

-- 2. Indice B-Tree Compuesto para Series Pesadas y Sobrecarga Progresiva (Consulta 2)
-- Optimiza filtros compuestos de carga, repeticiones y ordenamiento temporal
CREATE INDEX IF NOT EXISTS idx_series_peso_reps_fecha
ON gymbro.series_realizadas (peso_kg DESC, repeticiones DESC, fecha_finalizacion DESC);

-- 3. Covering Index con Clausula INCLUDE para Calculo de Volumen y Estadisticas (Consulta 3)
-- Permite Index Only Scan sin acceder a las paginas de la tabla (Heap)
CREATE INDEX IF NOT EXISTS idx_series_ejercicio_covering
ON gymbro.series_realizadas (ejercicio_realizado_id) INCLUDE (peso_kg, repeticiones, numero_serie);

-- 4. Indice Parcial Filtrado para Series de Alta Intensidad >= 100 kg (Consulta 4)
-- Reduce drasticamente el tamano del arbol B-Tree indexando solo el subconjunto de elite
CREATE INDEX IF NOT EXISTS idx_series_parcial_alta_carga
ON gymbro.series_realizadas (fecha_finalizacion DESC, ejercicio_realizado_id, peso_kg)
WHERE peso_kg >= 100.0;

-- 5. Indice B-Tree Temporal para Ventana de Actividad Reciente (Consulta 5)
-- Optimiza consultas de monitoreo de trafico y series finalizadas en los ultimos 30 dias
CREATE INDEX IF NOT EXISTS idx_series_fecha_finalizacion
ON gymbro.series_realizadas (fecha_finalizacion DESC);

-- 6. Indice B-Tree de Clave Foranea para Join de Volumen por Catalogo (Consulta 6)
-- Acelera los Hash Joins y Nested Loops entre series_realizadas y ejercicios_realizados
CREATE INDEX IF NOT EXISTS idx_ejercicios_realizados_ejercicio_id
ON gymbro.ejercicios_realizados (ejercicio_id, id);

-- 7. Indice Compuesto para Leaderboard de Fuerza 1RM y Busqueda por Nombre (Consulta 7)
CREATE INDEX IF NOT EXISTS idx_marcas_ejercicio_1rm
ON gymbro.marcas_fuerza (ejercicio_id, estimacion_1rm DESC);

CREATE INDEX IF NOT EXISTS idx_ejercicios_nombre
ON gymbro.ejercicios (nombre);

-- 8. Indice Parcial Compuesto para Sesiones de Alto Gasto Calorico (Consulta 8)
-- Filtra unicamente sesiones con estado COMPLETED evitando registros pausados o cancelados
CREATE INDEX IF NOT EXISTS idx_sesiones_completadas_calorias
ON gymbro.sesiones_entrenamiento (calorias DESC, fecha_inicio)
WHERE estado = 'COMPLETED';
