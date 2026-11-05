/** Aísla las pruebas de las credenciales y de la base local del integrante. */
const {spawnSync}=require('node:child_process');
const env={...process.env,DB_CONNECTION_MODE:'LOCAL',DB_SCHEMA:'',DB_NAMES_LANGUAGE:'en',DATABASE_URL:'postgresql://unused:unused@localhost/unused'};
const result=spawnSync(process.execPath,['--test',...process.argv.slice(2)],{env,stdio:'inherit'});
process.exit(result.status??1);
