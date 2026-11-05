/** Crea secretos solo para esta copia local; nunca imprime sus valores. */
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const paths=['backend/.env','postgres/.env'];
const present=paths.filter(p=>fs.existsSync(new URL(p,root)));
if(present.length===2){console.log('Configuración local existente; no se sobrescribió.');process.exit(0);}
if(present.length){console.error('Hay una configuración parcial. Revisar backend/.env y postgres/.env antes de regenerar.');process.exit(1);}
const values={__POSTGRES_PASSWORD__:randomBytes(24).toString('hex'),__JWT_SECRET__:randomBytes(32).toString('hex'),__PGADMIN_PASSWORD__:randomBytes(18).toString('hex')};
for(const p of paths){let text=fs.readFileSync(new URL(p+'.example',root),'utf8');for(const [key,value]of Object.entries(values))text=text.replaceAll(key,value);fs.writeFileSync(fileURLToPath(new URL(p,root)),text,{flag:'wx'});}
console.log('Configuración local creada. Secretos guardados en archivos .env excluidos de Git.');
