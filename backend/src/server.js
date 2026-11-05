/**
 * Punto de entrada del backend: abre el puerto HTTP y libera la conexión a la base al recibir una señal de cierre. Importar app.js por sí solo no inicia un servidor.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { app } from "./app.js";
import { config } from "./config.js";
import { sequelize, closeDatabase } from "./db.js";
import {databaseDiagnostic} from './database-diagnostic.js';

// Un deploy no se anuncia como sano si todavía no pudo autenticar contra la base.
let server;
try {
  await sequelize.authenticate();
  server=app.listen(config.port,'0.0.0.0',()=>console.log(`Gymbro AI API lista en puerto ${config.port}`));
} catch(error) {
  console.error(databaseDiagnostic(error));
  await closeDatabase();process.exitCode=1;
}

/** Cierra el servidor HTTP y el pool de conexiones al terminar el proceso. */
async function shutdown() {
  if(server)await new Promise(resolve=>server.close(resolve));
  await closeDatabase();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
