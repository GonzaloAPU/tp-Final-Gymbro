/**
 * Crea la conexión compartida de Sequelize con PostgreSQL. DATABASE_URL indica servidor, puerto y credenciales; underscored traduce nombres como userId a columnas user_id.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import "dotenv/config";
import { Sequelize } from "sequelize";
import {databaseOptions} from './database-options.js';

const settings=databaseOptions(process.env);
export const sequelize=new Sequelize(settings.url,settings.options);
export async function closeDatabase(){await sequelize.close();}
