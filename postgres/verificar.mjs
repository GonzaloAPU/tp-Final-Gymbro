/** Solo lectura de la base local del TP. Se ejecuta desde el workspace backend. */
import assert from 'node:assert/strict';
import {sequelize,closeDatabase} from '../backend/src/db.js';
import {User,Exercise} from '../backend/src/models/index.js';
try{
 assert.equal(process.env.DB_CONNECTION_MODE,'LOCAL','Solo permite la base local del TP');
 const url=new URL(process.env.DATABASE_URL);
 assert.ok(['127.0.0.1','localhost','postgres-primary'].includes(url.hostname),'No conectar a bases externas');
 assert.equal(url.pathname,'/smartgymbro_tp','Se requiere la base separada del TP');
 await sequelize.authenticate();
 const [tables]=await sequelize.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='gymbro' AND table_type='BASE TABLE'");
 assert.equal(tables[0].total,16);assert.ok(await Exercise.count({where:{createdByUserId:null}})>=190);
 console.log(JSON.stringify({ok:true,tablas:16,ejerciciosOficiales:await Exercise.count({where:{createdByUserId:null}}),usuariosLocales:await User.count()}));
}finally{await closeDatabase();}
