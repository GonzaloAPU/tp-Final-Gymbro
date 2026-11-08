/**
 * Inyección masiva de 6.000.000 de registros sintéticos realistas.
 * 
 * Arquitectura:
 * 1. Tabla Maestra: 20.000 usuarios en gymbro.usuarios 
 * 2. Tabla de Movimiento: 6.000.000 de pesajes en gymbro.historial_peso_corporal
 *    distribuidos de forma equitativa (300 pesajes por usuario a lo largo de 2 años).
 */
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../backend/.env', import.meta.url), quiet: true });

// Importación dinámica para asegurar la lectura previa de variables de entorno
const { sequelize, closeDatabase } = await import('../backend/src/db.js');

async function generateBenchmarkData() {
  console.log('=================================================================');
  console.log('SMARTGYMBRO - INYECCION MASIVA CON DATOS REALISTAS (6.000.000 FILAS)');
  console.log('=================================================================\n');

  try {
    await sequelize.authenticate();
    console.log('[OK] Conexion establecida con PostgreSQL 17 en Docker.');

    // -----------------------------------------------------------------
    // 1. POBLAR TABLA MAESTRA (20.000 USUARIOS)
    // -----------------------------------------------------------------
    console.log('\n[1/2] Verificando poblacion de usuarios en la tabla maestra...');
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
      console.log(`[OK] 20.000 usuarios realistas creados exitosamente en ${userSeconds} segundos.`);
    } else {
      console.log(`[INFO] La tabla de usuarios ya cuenta con ${userCountBefore[0].total.toLocaleString('es-AR')} usuarios.`);
    }

    // -----------------------------------------------------------------
    // 2. POBLAR TABLA DE MOVIMIENTO (6.000.000)
    // -----------------------------------------------------------------
    console.log('\n[2/2] Verificando tabla de movimiento (historial_peso_corporal)...');
    const [countResult] = await sequelize.query(`
      SELECT count(*)::int AS total FROM gymbro.historial_peso_corporal;
    `);
    const currentCount = parseInt(countResult[0].total, 10);
    console.log(`Registros actuales: ${currentCount.toLocaleString('es-AR')}`);

    if (currentCount >= 6000000) {
      console.log('La tabla ya cuenta con los 6.000.000 de registros.');
    } else {
      console.log('Iniciando inyeccion masiva de 6.000.000 de pesajes...');
      console.log('[INFO] Distribucion: 20.000 usuarios x 300 pesajes historicos cada uno.');
      console.log('Por favor espera unos 45-60 segundos mientras PostgreSQL procesa en memoria...');

      const startTime = Date.now();

      // 20.000 usuarios x 300 pesajes = 6.000.000 filas correlativas a lo largo de 2 años
      await sequelize.query(`
        INSERT INTO gymbro.historial_peso_corporal (id, usuario_id, peso_kg, fecha_registro)
        SELECT 
          gen_random_uuid(),
          u.id,
          ROUND((55 + (random() * 45))::numeric, 2),
          NOW() - ((s * 2) || ' days')::interval - (random() * interval '12 hours')
        FROM (
          SELECT id FROM gymbro.usuarios ORDER BY fecha_creacion LIMIT 20000
        ) u
        CROSS JOIN generate_series(1, 300) AS s;
      `);

      const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n[OK] Inyeccion masiva completada con exito en ${totalTimeSeconds} segundos!`);
      const rps = Math.round(6000000 / (totalTimeSeconds || 1));
      console.log(`Rendimiento: ${rps.toLocaleString('es-AR')} registros por segundo.`);
    }

    // -----------------------------------------------------------------
    // 3. METRICAS TECNICAS
    // -----------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('METRICAS TECNICAS');
    console.log('=================================================================');

    const [finalUsers] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.usuarios;`);
    const [finalRecords] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.historial_peso_corporal;`);
    const [tableSize] = await sequelize.query(`
      SELECT 
        pg_size_pretty(pg_relation_size('gymbro.historial_peso_corporal')) AS data_size,
        pg_size_pretty(pg_indexes_size('gymbro.historial_peso_corporal')) AS index_size,
        pg_size_pretty(pg_total_relation_size('gymbro.historial_peso_corporal')) AS total_size;
    `);
    const [dbSize] = await sequelize.query(`SELECT pg_size_pretty(pg_database_size('smartgymbro_tp')) AS total_db_size;`);

    console.log(`- Total usuarios maestros     : ${parseInt(finalUsers[0].total, 10).toLocaleString('es-AR')} usuarios`);
    console.log(`- Total registros movimiento  : ${parseInt(finalRecords[0].total, 10).toLocaleString('es-AR')} pesajes`);
    console.log(`- Promedio por usuario        : 300 pesajes (~1 cada 2 dias en 2 anos)`);
    console.log(`- Tamano de datos de tabla    : ${tableSize[0].data_size}`);
    console.log(`- Tamano de indices B-Tree    : ${tableSize[0].index_size}`);
    console.log(`- Tamano total de la tabla    : ${tableSize[0].total_size}`);
    console.log(`- Tamano total base de datos  : ${dbSize[0].total_db_size}`);
    console.log('=================================================================\n');

  } catch (error) {
    console.error('[ERROR] Error durante la generacion de datos:', error);
  } finally {
    await closeDatabase();
  }
}

generateBenchmarkData();