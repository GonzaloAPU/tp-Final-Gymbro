/**
 * SMARTGYMBRO - INYECCION MASIVA DE DATOS 
 * 
 * Tabla Maestra: 20.000 usuarios (gymbro.usuarios)
 * Tabla de Movimiento Principal: 6.000.000 de series (gymbro.series_realizadas)
 * Jerarquia relacional transaccional:
 *   - 20.000 usuarios
 *   - 500.000 sesiones de entrenamiento (25 entrenamientos por usuario a lo largo de 2 anos)
 *   - 2.000.000 ejercicios realizados (4 ejercicios por sesion)
 *   - 6.000.000 series realizadas (3 series de sobrecarga progresiva por ejercicio)
 */
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../backend/.env', import.meta.url), quiet: true });

const { sequelize, closeDatabase } = await import('../backend/src/db.js');

async function generateBenchmarkData() {
  console.log('=================================================================');
  console.log('SMARTGYMBRO - INYECCION MASIVA CON DATOS REALISTAS (6.000.000 FILAS)');
  console.log('Tabla de Movimiento: gymbro.series_realizadas');
  console.log('=================================================================\n');

  try {
    await sequelize.authenticate();
    console.log('[OK] Conexion establecida con PostgreSQL 17 en Docker.');

    // -----------------------------------------------------------------
    // 1. POBLAR TABLA MAESTRA (20.000 USUARIOS)
    // -----------------------------------------------------------------
    console.log('\n[1/4] Verificando poblacion de usuarios en la tabla maestra...');
    const [userCountBefore] = await sequelize.query(`
      SELECT count(*)::int AS total FROM gymbro.usuarios;
    `);

    if (userCountBefore[0].total < 20000) {
      console.log('Generando 20.000 usuarios con nombres, gimnasios y disciplinas reales...');
      const userStart = Date.now();
      
      await sequelize.query(`
        INSERT INTO gymbro.usuarios (
          id, correo_electronico, hash_contrasena, nombre, objetivo, altura_cm, nombre_gimnasio, disciplina, generaciones_ia_semana, participa_ranking, fecha_creacion, fecha_actualizacion
        )
        SELECT 
          gen_random_uuid(),
          LOWER(
            (ARRAY['lucas', 'mateo', 'santiago', 'nicolas', 'joaquin', 'facundo', 'martin', 'tomas', 'ignacio', 'gonzalo',
                   'valentina', 'camila', 'sofia', 'martina', 'lucia', 'julieta', 'florencia', 'milagros', 'agustina', 'paula'])[1 + (s % 20)]
            || '.' ||
            (ARRAY['gonzalez', 'rodriguez', 'gomez', 'fernandez', 'lopez', 'diaz', 'martinez', 'perez', 'garcia', 'sanchez',
                   'romero', 'sosa', 'alvarez', 'torres', 'ruiz', 'ramirez', 'flores', 'benitez', 'acosta', 'medina'])[1 + ((s / 20) % 20)]
            || '_' || s || '@smartgymbro.com'
          ),
          '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
          (ARRAY['Lucas', 'Mateo', 'Santiago', 'Nicolás', 'Joaquín', 'Facundo', 'Martín', 'Tomás', 'Ignacio', 'Gonzalo',
                 'Valentina', 'Camila', 'Sofía', 'Martina', 'Lucía', 'Julieta', 'Florencia', 'Milagros', 'Agustina', 'Paula'])[1 + (s % 20)] 
          || ' ' || 
          (ARRAY['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez',
                 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina'])[1 + ((s / 20) % 20)],
          (ARRAY['HIPERTROFIA', 'FUERZA_MAXIMA', 'PERDIDA_GRASA', 'RESISTENCIA', 'SALUD_GENERAL', 'RECOMPOSICION_CORPORAL'])[1 + (s % 6)],
          155 + (s % 42),
          (ARRAY['Smart Gym Palermo', 'Iron Paradise Recoleta', 'GymBro Belgrano', 'Megatlon Centro', 
                 'SportClub Almagro', 'PowerFit Caballito', 'Olympus San Telmo', 'Titan Gym Flores', 
                 'CrossFit Barracas', 'Fuerza Pura Villa Urquiza'])[1 + (s % 10)],
          (ARRAY['Powerlifting', 'Bodybuilding', 'Crossfit', 'Calistenia', 'Fitness Funcional', 'Halterofilia', 'Acondicionamiento General'])[1 + (s % 7)],
          (s % 4),
          (s % 3 != 0),
          NOW() - ((s % 730) || ' days')::interval,
          NOW()
        FROM generate_series(1, 20000) AS s
        ON CONFLICT (correo_electronico) DO NOTHING;
      `);

      const userSeconds = ((Date.now() - userStart) / 1000).toFixed(2);
      console.log(`[OK] 20.000 usuarios creados exitosamente en ${userSeconds} segundos.`);
    } else {
      console.log(`[INFO] La tabla de usuarios ya cuenta con ${userCountBefore[0].total.toLocaleString('es-AR')} usuarios.`);
    }

    // -----------------------------------------------------------------
    // 2. SESIONES DE ENTRENAMIENTO (500.000 SESIONES)
    // -----------------------------------------------------------------
    console.log('\n[2/4] Verificando sesiones de entrenamiento (gymbro.sesiones_entrenamiento)...');
    const [sesCountBefore] = await sequelize.query(`
      SELECT count(*)::int AS total FROM gymbro.sesiones_entrenamiento;
    `);

    if (sesCountBefore[0].total < 500000) {
      console.log('Generando 500.000 entrenamientos (25 sesiones por usuario en 2 anos)...');
      const sesStart = Date.now();

      await sequelize.query(`
        INSERT INTO gymbro.sesiones_entrenamiento (
          id, usuario_id, fecha_inicio, fecha_fin, duracion_segundos, estado, calorias, volumen_total_kg
        )
        SELECT 
          gen_random_uuid(),
          u.id,
          NOW() - ((s * 28) || ' hours')::interval - interval '55 minutes',
          NOW() - ((s * 28) || ' hours')::interval,
          3300 + ((s % 15) * 60),
          'COMPLETED'::gymbro.enum_training_sessions_status,
          ROUND((320 + ((s % 30) * 11) + (random() * 50))::numeric, 2),
          ROUND((2800 + ((s % 50) * 85) + (random() * 200))::numeric, 2)
        FROM (
          SELECT id FROM gymbro.usuarios ORDER BY fecha_creacion LIMIT 20000
        ) u
        CROSS JOIN generate_series(1, 25) AS s;
      `);

      const sesSeconds = ((Date.now() - sesStart) / 1000).toFixed(2);
      console.log(`[OK] 500.000 sesiones creadas exitosamente en ${sesSeconds} segundos.`);
    } else {
      console.log(`[INFO] La tabla de sesiones ya cuenta con ${sesCountBefore[0].total.toLocaleString('es-AR')} registros.`);
    }

    // -----------------------------------------------------------------
    // 3. EJERCICIOS REALIZADOS (2.000.000 EJERCICIOS)
    // -----------------------------------------------------------------
    console.log('\n[3/4] Verificando ejercicios realizados (gymbro.ejercicios_realizados)...');
    const [ejCountBefore] = await sequelize.query(`
      SELECT count(*)::int AS total FROM gymbro.ejercicios_realizados;
    `);

    if (ejCountBefore[0].total < 2000000) {
      console.log('Generando 2.000.000 de ejercicios realizados (4 ejercicios por sesion)...');
      const ejStart = Date.now();

      await sequelize.query(`
        WITH catalogo AS (
          SELECT id, row_number() OVER () AS rnum FROM gymbro.ejercicios LIMIT 190
        )
        INSERT INTO gymbro.ejercicios_realizados (id, orden, sesion_id, ejercicio_id)
        SELECT 
          gen_random_uuid(),
          s,
          ses.id,
          cat.id
        FROM gymbro.sesiones_entrenamiento ses
        CROSS JOIN generate_series(1, 4) AS s
        JOIN catalogo cat ON cat.rnum = (1 + ((abs(hashtext(ses.id::text)) + s) % 190));
      `);

      const ejSeconds = ((Date.now() - ejStart) / 1000).toFixed(2);
      console.log(`[OK] 2.000.000 ejercicios realizados creados exitosamente en ${ejSeconds} segundos.`);
    } else {
      console.log(`[INFO] La tabla de ejercicios realizados ya cuenta con ${ejCountBefore[0].total.toLocaleString('es-AR')} registros.`);
    }

    // -----------------------------------------------------------------
    // 4. TABLA DE MOVIMIENTO PRINCIPAL: SERIES REALIZADAS (6.000.000)
    // -----------------------------------------------------------------
    console.log('\n[4/4] Verificando tabla de movimiento principal (gymbro.series_realizadas)...');
    const [countResult] = await sequelize.query(`
      SELECT count(*)::int AS total FROM gymbro.series_realizadas;
    `);
    const currentCount = parseInt(countResult[0].total, 10);
    console.log(`Series actuales: ${currentCount.toLocaleString('es-AR')}`);

    if (currentCount >= 6000000) {
      console.log('La tabla de series_realizadas ya cuenta con los 6.000.000 de registros.');
    } else {
      console.log('Iniciando inyeccion masiva de 6.000.000 de series realizadas...');
      console.log('[INFO] Distribucion: 2.000.000 ejercicios realizados x 3 series de sobrecarga progresiva cada uno.');
      console.log('Procesando en 3 lotes optimizados de 2.000.000 para optimizar el uso de memoria...');

      const startTime = Date.now();

      for (let serieNum = 1; serieNum <= 3; serieNum++) {
        const batchStart = Date.now();
        console.log(` -> Insertando Lote ${serieNum}/3: Serie Numero ${serieNum} (2.000.000 filas)...`);

        await sequelize.query(`
          INSERT INTO gymbro.series_realizadas (
            id, numero_serie, peso_kg, repeticiones, duracion_segundos, descanso_real_segundos, fecha_finalizacion, ejercicio_realizado_id
          )
          SELECT 
            gen_random_uuid(),
            ${serieNum},
            ROUND((30 + (${serieNum} * 15) + ((abs(hashtext(er.id::text)) % 45)))::numeric, 2),
            GREATEST(6, 14 - (${serieNum} * 2) + ((abs(hashtext(er.id::text)) % 3))),
            35 + (${serieNum} * 5),
            60 + (${serieNum} * 30),
            ses.fecha_inicio + (((${serieNum} * 10) + er.orden * 12) || ' minutes')::interval,
            er.id
          FROM gymbro.ejercicios_realizados er
          JOIN gymbro.sesiones_entrenamiento ses ON ses.id = er.sesion_id;
        `);

        const batchSec = ((Date.now() - batchStart) / 1000).toFixed(2);
        console.log(`    [OK] Lote ${serieNum} completado en ${batchSec} segundos.`);
      }

      const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n[OK] Inyeccion masiva completada con exito en ${totalTimeSeconds} segundos!`);
      const rps = Math.round(6000000 / (totalTimeSeconds || 1));
      console.log(`Rendimiento: ${rps.toLocaleString('es-AR')} registros por segundo.`);
    }

    // -----------------------------------------------------------------
    // 5. METRICAS TECNICAS
    // -----------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('METRICAS TECNICAS DEL MODELO TRANSACCIONAL');
    console.log('=================================================================');

    const [finalUsers] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.usuarios;`);
    const [finalSessions] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.sesiones_entrenamiento;`);
    const [finalEjRealizados] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.ejercicios_realizados;`);
    const [finalSeries] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.series_realizadas;`);

    const [tableSize] = await sequelize.query(`
      SELECT 
        pg_size_pretty(pg_relation_size('gymbro.series_realizadas')) AS data_size,
        pg_size_pretty(pg_indexes_size('gymbro.series_realizadas')) AS index_size,
        pg_size_pretty(pg_total_relation_size('gymbro.series_realizadas')) AS total_size;
    `);
    const [dbSize] = await sequelize.query(`SELECT pg_size_pretty(pg_database_size('smartgymbro_tp')) AS total_db_size;`);

    console.log(`- Total usuarios maestros          : ${parseInt(finalUsers[0].total, 10).toLocaleString('es-AR')} usuarios`);
    console.log(`- Total sesiones de entrenamiento  : ${parseInt(finalSessions[0].total, 10).toLocaleString('es-AR')} sesiones`);
    console.log(`- Total ejercicios realizados      : ${parseInt(finalEjRealizados[0].total, 10).toLocaleString('es-AR')} ejercicios`);
    console.log(`- TOTAL SERIES REALIZADAS (MOV.)   : ${parseInt(finalSeries[0].total, 10).toLocaleString('es-AR')} series`);
    console.log(`- Relacion transaccional           : 25 sesiones/usuario x 4 ejerc. x 3 series = 300 series/usuario`);
    console.log(`- Tamano de datos de tabla         : ${tableSize[0].data_size}`);
    console.log(`- Tamano de indices B-Tree         : ${tableSize[0].index_size}`);
    console.log(`- Tamano total de series_realizadas: ${tableSize[0].total_size}`);
    console.log(`- Tamano total base de datos       : ${dbSize[0].total_db_size}`);
    console.log('=================================================================\n');

  } catch (error) {
    console.error('[ERROR] Error durante la generacion de datos:', error);
  } finally {
    await closeDatabase();
  }
}

generateBenchmarkData();
