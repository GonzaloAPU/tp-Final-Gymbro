-- ====================================================================
-- SMARTGYMBRO - DDL DE INDICES DE OPTIMIZACION (PUNTO 5)
-- ====================================================================

SET search_path TO gymbro, public;

-- 1. Indice Compuesto para Historial Reciente (Consulta 1 y Consulta 5)
CREATE INDEX IF NOT EXISTS idx_peso_usuario_fecha_desc
ON gymbro.historial_peso_corporal (usuario_id, fecha_registro DESC);

-- 2. Indice Compuesto para Ventanas Temporales (Consulta 2)
CREATE INDEX IF NOT EXISTS idx_peso_usuario_fecha_asc
ON gymbro.historial_peso_corporal (usuario_id, fecha_registro ASC);

-- 3. Covering Index para Agregaciones Min, Max, Avg (Consulta 3)
CREATE INDEX IF NOT EXISTS idx_peso_usuario_covering
ON gymbro.historial_peso_corporal (usuario_id) INCLUDE (peso_kg);

-- 4. Indice Parcial para Categorias Pesadas > 95 kg (Consulta 4)
CREATE INDEX IF NOT EXISTS idx_peso_parcial_categoria_pesada
ON gymbro.historial_peso_corporal (fecha_registro, usuario_id, peso_kg)
WHERE peso_kg > 95.0;

-- 5. Indice Simple en Fecha de Registro (Consulta 6)
CREATE INDEX IF NOT EXISTS idx_peso_fecha_registro
ON gymbro.historial_peso_corporal (fecha_registro);

-- 6. Indice Compuesto en Marcas de Fuerza 1RM (Consulta 7)
CREATE INDEX IF NOT EXISTS idx_marcas_ejercicio_1rm
ON gymbro.marcas_fuerza (ejercicio_id, estimacion_1rm DESC);

-- 7. Indice Simple en Nombre de Ejercicio (Consulta 7)
CREATE INDEX IF NOT EXISTS idx_ejercicios_nombre
ON gymbro.ejercicios (nombre);

-- 8. Indice Parcial Compuesto en Sesiones de Entrenamiento (Consulta 8)
CREATE INDEX IF NOT EXISTS idx_sesiones_completadas_calorias
ON gymbro.sesiones_entrenamiento (calorias DESC, fecha_inicio)
WHERE estado = 'COMPLETED';
