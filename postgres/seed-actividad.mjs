/**
 * SMARTGYMBRO - POBLAMIENTO DE ACTIVIDAD Y ENTRENAMIENTOS
 * 
 * Llena las tablas operativas del sistema con datos realistas:
 * 1. Rutinas de entrenamiento
 * 2. Dias de rutina (Split Empuje / Traccion / Piernas)
 * 3. Ejercicios programados en rutina
 * 4. Marcas personales de fuerza (Estimacion 1RM)
 * 5. Historial periodico de peso corporal (Baja frecuencia: 4-6 registros por atleta)
 */
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../backend/.env', import.meta.url), quiet: true });

const { sequelize, closeDatabase } = await import('../backend/src/db.js');

async function poblarActividad() {
  console.log('=================================================================');
  console.log('SMARTGYMBRO - POBLAMIENTO DE ACTIVIDAD Y ENTRENAMIENTOS');
  console.log('=================================================================\n');

  try {
    await sequelize.authenticate();
    console.log('[OK] Conexion establecida con PostgreSQL 17 en Docker.');

    // 1. Rutinas (2.000 rutinas para los primeros 2.000 usuarios)
    console.log('[1/5] Generando 2.000 rutinas activas...');
    await sequelize.query(`
      INSERT INTO gymbro.rutinas (id, nombre, objetivo, activa, fecha_creacion, usuario_id)
      SELECT 
        gen_random_uuid(),
        (ARRAY['Hipertrofia PPL', 'Fuerza 5x5', 'Torso-Pierna', 'Fullbody Funcional'])[1 + (s % 4)],
        (ARRAY['HIPERTROFIA', 'FUERZA_MAXIMA', 'RESISTENCIA', 'PERDIDA_GRASA'])[1 + (s % 4)],
        true,
        NOW() - ((s % 365) || ' days')::interval,
        u.id
      FROM (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.usuarios LIMIT 2000
      ) u
      JOIN generate_series(1, 2000) s ON s = u.rnum;
    `);

    // 2. Dias de rutina (3 dias por rutina = 6.000 dias)
    console.log('[2/5] Generando 6.000 dias de entrenamiento programados...');
    await sequelize.query(`
      INSERT INTO gymbro.dias_rutina (id, nombre, numero_dia, favorita, rutina_id)
      SELECT 
        gen_random_uuid(),
        (ARRAY['Dia 1: Empuje (Pecho, Hombro, Triceps)', 'Dia 2: Traccion (Espalda, Biceps)', 'Dia 3: Piernas y Core'])[s],
        s,
        (s = 1),
        r.id
      FROM gymbro.rutinas r
      CROSS JOIN generate_series(1, 3) AS s;
    `);

    // 3. Ejercicios en rutina (4 ejercicios por dia = 24.000 ejercicios)
    console.log('[3/5] Asignando 24.000 ejercicios oficiales a las rutinas...');
    await sequelize.query(`
      WITH ejercicios_oficiales AS (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.ejercicios LIMIT 190
      )
      INSERT INTO gymbro.ejercicios_rutina (id, orden, series_objetivo, repeticiones_minimas, repeticiones_maximas, descanso_segundos, dia_rutina_id, ejercicio_id)
      SELECT 
        gen_random_uuid(),
        s,
        (ARRAY[3, 4])[1 + (s % 2)],
        8,
        12,
        90,
        d.id,
        e.id
      FROM gymbro.dias_rutina d
      CROSS JOIN generate_series(1, 4) AS s
      JOIN ejercicios_oficiales e ON e.rnum = (1 + ((abs(hashtext(d.id::text)) + s) % 190));
    `);

    // 4. Marcas de fuerza (10.000 records con estimacion 1RM)
    console.log('[4/5] Calculando 10.000 marcas personales de fuerza (1RM)...');
    await sequelize.query(`
      WITH ejercicios_oficiales AS (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.ejercicios LIMIT 190
      )
      INSERT INTO gymbro.marcas_fuerza (id, usuario_id, ejercicio_id, peso_maximo_kg, repeticiones, estimacion_1rm, fecha_marca)
      SELECT 
        gen_random_uuid(),
        u.id,
        e.id,
        ROUND((60 + (random() * 80))::numeric, 2),
        3 + (s % 5),
        ROUND(((60 + (random() * 80)) * (1 + (3 + (s % 5))::numeric / 30))::numeric, 2),
        NOW() - ((s % 180) || ' days')::interval
      FROM (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.usuarios LIMIT 2000
      ) u
      JOIN generate_series(1, 10000) s ON u.rnum = (1 + (s % 2000))
      JOIN ejercicios_oficiales e ON e.rnum = (1 + (s % 190));
    `);

    // 5. Historial periodico de peso corporal (Baja frecuencia: 100.000 pesajes realistas)
    console.log('[5/5] Registrando 100.000 pesajes de control periodico (5 por usuario)...');
    await sequelize.query(`
      INSERT INTO gymbro.historial_peso_corporal (id, usuario_id, peso_kg, fecha_registro)
      SELECT 
        gen_random_uuid(),
        u.id,
        ROUND((58 + (random() * 38))::numeric, 2),
        NOW() - ((s * 45) || ' days')::interval - (random() * interval '8 hours')
      FROM (
        SELECT id FROM gymbro.usuarios ORDER BY fecha_creacion LIMIT 20000
      ) u
      CROSS JOIN generate_series(1, 5) AS s;
    `);

    console.log('\n[OK] Todas las tablas de actividad y catalogo quedaron pobladas exitosamente.');
  } catch (error) {
    console.error('[ERROR] Error durante el poblamiento de actividad:', error);
  } finally {
    await closeDatabase();
  }
}

poblarActividad();
