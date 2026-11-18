import {Router} from 'express';
import {legalDocuments,legalAccess,acceptLegal,withdrawSportsConsent} from '../services/legal.js';
export const legalRouter=Router();
legalRouter.post('/withdraw-sports',async(req,res)=>{
  await withdrawSportsConsent(req.auth.sub);
  res.json(await legalAccess.status(req.auth.sub));
});
legalRouter.get('/documents',(_req,res)=>res.json(legalDocuments));
// URL pública legible para compartir la política sin instalar la APK ni iniciar sesión.
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [path,kind,title] of [['privacy','privacy','Política de privacidad'],['terms','terms','Términos de uso']]){
  legalRouter.get('/'+path,(_req,res)=>{
    res.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Gymbro</title><style>body{font:17px/1.8 system-ui;max-width:760px;margin:30px auto;padding:0 20px;color:#18212b}h2{font-size:22px}p{white-space:pre-line;overflow-wrap:anywhere}</style><main><h1>${title}</h1><p>${escape(legalDocuments.operator)} · ${escape(legalDocuments.email)}<br>Versión ${escape(legalDocuments.version)}</p>${legalDocuments[kind].map(s=>`<section><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p></section>`).join('')}</main></html>`);
  });
}
legalRouter.get('/status',async(req,res)=>res.json(await legalAccess.status(req.auth.sub)));
legalRouter.post('/accept',async(req,res)=>{await acceptLegal(req.auth.sub,req.body);res.json(await legalAccess.status(req.auth.sub));});
