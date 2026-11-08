/**
 * Script de generación de actividad completa para SmartGymBro.
 * Llena las tablas de entrenamiento para que la aplicación tenga vida:
 * Rutinas, Días, Ejercicios en rutina, Sesiones, Series y Marcas 1RM.
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
    console.log('[OK] Conexion establecida con PostgreSQL en Docker.');

    // 1. Rutinas (2.000 rutinas para los primeros 2.000 usuarios)
    console.log('[1/7] Generando 2.000 rutinas activas...');
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

    // 2. Días de rutina (3 días por rutina = 6.000 días)
    console.log('[2/7] Generando 6.000 días de entrenamiento programados...');
    await sequelize.query(`
      INSERT INTO gymbro.dias_rutina (id, nombre, numero_dia, favorita, rutina_id)
      SELECT 
        gen_random_uuid(),
        (ARRAY['Día 1: Empuje (Pecho, Hombro, Tríceps)', 'Día 2: Tracción (Espalda, Bíceps)', 'Día 3: Piernas y Core'])[s],
        s,
        (s = 1),
        r.id
      FROM gymbro.rutinas r
      CROSS JOIN generate_series(1, 3) AS s;
    `);

    // 3. Ejercicios en rutina (4 ejercicios por día = 24.000 ejercicios)
    console.log('[3/7] Asignando 24.000 ejercicios oficiales a las rutinas...');
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

    // 4. Sesiones de entrenamiento (10.000 sesiones completadas)
    console.log('[4/7] Generando 10.000 entrenamientos completados en el gimnasio...');
    await sequelize.query(`
      WITH dias_disponibles AS (
        SELECT id, rutina_id, row_number() OVER () AS rnum FROM gymbro.dias_rutina
      )
      INSERT INTO gymbro.sesiones_entrenamiento (id, usuario_id, dia_rutina_id, fecha_inicio, fecha_fin, duracion_segundos, estado, calorias, volumen_total_kg)
      SELECT 
        gen_random_uuid(),
        u.id,
        d.id,
        NOW() - ((s * 3) || ' hours')::interval - interval '60 minutes',
        NOW() - ((s * 3) || ' hours')::interval,
        3600,
        'COMPLETED'::gymbro.enum_training_sessions_status,
        ROUND((350 + (random() * 250))::numeric, 2),
        ROUND((3500 + (random() * 4500))::numeric, 2)
      FROM (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.usuarios LIMIT 2000
      ) u
      JOIN generate_series(1, 10000) s ON u.rnum = (1 + (s % 2000))
      JOIN dias_disponibles d ON d.rnum = (1 + (s % 6000));
    `);

    // 5. Ejercicios realizados (4 por sesión = 40.000)
    console.log('[5/7] Registrando 40.000 ejercicios realizados en sala...');
    await sequelize.query(`
      WITH ejercicios_oficiales AS (
        SELECT id, row_number() OVER () AS rnum FROM gymbro.ejercicios LIMIT 190
      )
      INSERT INTO gymbro.ejercicios_realizados (id, orden, sesion_id, ejercicio_id)
      SELECT 
        gen_random_uuid(),
        s,
        ses.id,
        e.id
      FROM gymbro.sesiones_entrenamiento ses
      CROSS JOIN generate_series(1, 4) AS s
      JOIN ejercicios_oficiales e ON e.rnum = (1 + ((abs(hashtext(ses.id::text)) + s) % 190));
    `);

    // 6. Series realizadas (120.000 series levantadas)
    console.log('[6/7] Generando 120.000 series con peso levantado, repeticiones y descanso...');
    await sequelize.query(`
      INSERT INTO gymbro.series_realizadas (id, numero_serie, peso_kg, repeticiones, duracion_segundos, descanso_real_segundos, fecha_finalizacion, ejercicio_realizado_id)
      SELECT 
        gen_random_uuid(),
        s,
        ROUND((30 + (random() * 90))::numeric, 2),
        6 + (s * 2),
        45,
        90,
        NOW() - ((s * 2) || ' minutes')::interval,
        er.id
      FROM gymbro.ejercicios_realizados er
      CROSS JOIN generate_series(1, 3) AS s;
    `);

    // 7. Marcas de fuerza (5.000 récords con estimación 1RM)
    console.log('[7/7] Calculando 5.000 marcas personales de fuerza (1RM)...');
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
      JOIN generate_series(1, 5000) s ON u.rnum = (1 + (s % 2000))
      JOIN ejercicios_oficiales e ON e.rnum = (1 + (s % 190));
    `);

    console.log('\n[OK] ¡Todas las tablas de GymBro quedaron pobladas con datos realistas!');
  } catch (error) {
    console.error('[ERROR] Error durante el poblamiento:', error);
  } finally {
    await closeDatabase();
  }
}

poblarActividad();