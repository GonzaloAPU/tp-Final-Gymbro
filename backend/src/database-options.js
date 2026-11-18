/** PostgreSQL local o Supabase. El modo remoto verifica siempre el certificado TLS. */
import {readFileSync} from 'node:fs';
export function databaseOptions(env,{readCertificate=file=>readFileSync(file,'utf8')}={}) {
  const options={dialect:'postgres',logging:env.SQL_LOGGING==='true'?console.log:false,define:{underscored:true},pool:{max:3,min:0,idle:10000,acquire:60000}};
  if(env.DB_CONNECTION_MODE && !['LOCAL','SUPABASE'].includes(env.DB_CONNECTION_MODE))throw Error('DB_CONNECTION_MODE inválido: usar LOCAL o SUPABASE');
  if(!env.DATABASE_URL)throw Error('DATABASE_URL no esta configurada');
  if(env.DB_CONNECTION_MODE!=='SUPABASE'){
    if(env.DB_SCHEMA){
      if(!['public','gymbro'].includes(env.DB_SCHEMA))throw Error('DB_SCHEMA debe ser public o gymbro');
      options.define.schema=env.DB_SCHEMA;
    }
    return {url:env.DATABASE_URL,options};
  }
  let url;
  try {url=new URL(env.DATABASE_URL);}catch{throw Error('DATABASE_URL de Supabase inválida');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.pathname!=='/postgres')throw Error('Usá la URI PostgreSQL completa de Supabase, con usuario y contraseña');
  if(!/^(?:[a-z0-9-]+\.)*pooler\.supabase\.com$/.test(url.hostname)&&!/^db\.[a-z0-9-]+\.supabase\.co$/.test(url.hostname))throw Error('El host debe ser el indicado por Supabase en Connect');
  if(url.port && url.port!=='5432')throw Error('Usá Session pooler en puerto 5432, no Transaction pooler');
  // Evita que pg reinterprete sslmode=require y desactive la validación del certificado.
  for(const key of [...url.searchParams.keys()])if(key.toLowerCase().startsWith('ssl'))url.searchParams.delete(key);
  const ssl={require:true,rejectUnauthorized:true};
  if(env.DB_SSL_CA_FILE)ssl.ca=readCertificate(env.DB_SSL_CA_FILE);
  options.dialectOptions={ssl,connectionTimeoutMillis:30000};
  options.define.schema='gymbro';
  options.hooks={afterConnect:async client=>{await client.query('SET search_path TO gymbro, public');}};
  return {url:url.toString(),options};
}
