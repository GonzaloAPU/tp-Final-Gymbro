// Inyección masiva de 6.000.000 de registros sintéticos en la base local
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../backend/.env', import.meta.url), quiet: true });

// Importación dinámica para que se ejecute DESPUÉS de cargar el .env:
const { sequelize, closeDatabase } = await import('../backend/src/db.js');

async function generateBenchmarkData() {
  console.log('=====================================================');
  console.log('SMARTGYMBRO - INYECCIÓN MASIVA DE 6.000.000 REGISTROS');
  console.log('=====================================================\n');

  try {
    await sequelize.authenticate();
    console.log('Conexión establecida con PostgreSQL 17 en Docker.');

    // Creación o recuperar usuario sintético para respetar la clave foránea (FK)
    console.log('Verificando usuario de prueba para integridad referencial...');
    const [userRows] = await sequelize.query(`
      INSERT INTO gymbro.usuarios (
        id, correo_electronico, hash_contrasena, nombre, objetivo, altura_cm, fecha_creacion, fecha_actualizacion
      )
      VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'benchmark_user@smartgymbro.com',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Usuario Benchmark 6M',
        'Estrés y Optimización SQL',
        178,
        NOW(),
        NOW()
      )
      ON CONFLICT (correo_electronico) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id;
    `);
    const userId = userRows[0].id;
    console.log(`Usuario de prueba listo con ID: ${userId}`);

    //Comprobacion de registros actuales en historial_peso_corporal
    const [countResult] = await sequelize.query(`
      SELECT count(*)::int AS total 
      FROM gymbro.historial_peso_corporal;
    `);
    const currentCount = parseInt(countResult[0].total, 10);
    console.log(`Registros actuales: ${currentCount.toLocaleString('es-AR')}`);

    const TARGET = 6000000;
    const remaining = TARGET - currentCount;

    if (remaining <= 0) {
      console.log('\n La tabla ya cuenta con 6.000.000 o más registros.');
    } else {
      console.log(`\n Generando ${remaining.toLocaleString('es-AR')} registros sintéticos mediante generate_series nativo...`);
      console.log('Por favor espera unos 30-45 segundos mientras PostgreSQL procesa en memoria...');

      const startTime = Date.now();

      // Inyección masiva en memoria del motor PostgreSQL (C nativo)
      await sequelize.query(`
        INSERT INTO gymbro.historial_peso_corporal (id, usuario_id, peso_kg, fecha_registro)
        SELECT 
          gen_random_uuid(),
          :userId,
          ROUND((60 + (random() * 40))::numeric, 2),
          NOW() - (s || ' minutes')::interval
        FROM generate_series(1, :count) AS s;
      `, {
        replacements: {
          userId,
          count: remaining,
        },
      });

      const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n¡Inyección completada exitosamente en ${totalTimeSeconds} segundos!`);
      const rps = Math.round(remaining / (totalTimeSeconds || 1));
      console.log(`Rendimiento: ${rps.toLocaleString('es-AR')} registros por segundo.`);
    }

    // Métricas 
    console.log('\n=====================================================');
    console.log('MÉTRICAS TÉCNICAS');
    console.log('=====================================================');

    const [finalCount] = await sequelize.query(`SELECT count(*)::int AS total FROM gymbro.historial_peso_corporal;`);
    const [tableSize] = await sequelize.query(`
      SELECT 
        pg_size_pretty(pg_relation_size('gymbro.historial_peso_corporal')) AS data_size,
        pg_size_pretty(pg_indexes_size('gymbro.historial_peso_corporal')) AS index_size,
        pg_size_pretty(pg_total_relation_size('gymbro.historial_peso_corporal')) AS total_size;
    `);
    const [dbSize] = await sequelize.query(`SELECT pg_size_pretty(pg_database_size('smartgymbro_tp')) AS total_db_size;`);

    console.log(`• Cantidad final de registros : ${parseInt(finalCount[0].total, 10).toLocaleString('es-AR')} filas`);
    console.log(`• Tamaño de datos de la tabla : ${tableSize[0].data_size}`);
    console.log(`• Tamaño de índices B-Tree    : ${tableSize[0].index_size}`);
    console.log(`• Tamaño total de la tabla    : ${tableSize[0].total_size}`);
    console.log(`• Tamaño total base de datos  : ${dbSize[0].total_db_size}`);
    console.log('=====================================================\n');

  } catch (error) {
    console.error('Error durante la generación de datos:', error);
  } finally {
    await closeDatabase();
  }
}

generateBenchmarkData();