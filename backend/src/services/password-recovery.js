/**
 * Recuperación de contraseña: reglas que se ejecutan exclusivamente en el servidor.
 *
 * El endpoint y el formulario son fijos. Lo que cambia en cada correo es el JWT
 * firmado que autoriza temporalmente el cambio de contraseña de una cuenta.
 * No guardamos el enlace en la base: comprobamos firma, vencimiento y hash actual.
 */
import {createHmac,randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {where,fn,col} from 'sequelize';
import {User} from '../models/index.js';
import {sequelize} from '../db.js';
import {config} from '../config.js';

export const recoveryMessage='Si existe una cuenta con ese correo, recibirás un enlace para recuperar tu contraseña. Revisá también Spam.';

// Respuesta deliberadamente genérica: no confirma que una cuenta exista,
// ni permite distinguir un enlace vencido de uno falsificado o ya utilizado.
const invalid=()=>Object.assign(Error('El enlace venció o ya fue utilizado. Solicitá uno nuevo.'),{status:400});

// HMAC deriva una clave privada a partir de JWT_SECRET y del hash bcrypt actual.
// Ni esta clave, ni JWT_SECRET, ni el hash de contraseña se incluyen en el JWT.
// El prefijo separa este uso del empleado para los tokens normales de sesión.
const secret=hash=>createHmac('sha256',config.jwtSecret).update('gymbro-password-reset\0'+hash).digest('hex');

/**
 * Crea la parte variable del enlace. "15m" equivale a 900 segundos.
 * jsonwebtoken agrega iat (emisión) y exp (vencimiento) dentro del contenido firmado.
 * El plazo empieza AQUÍ: no cuando llega el correo ni cuando se abre el formulario.
 * expiresIn es un argumento interno para pruebas; la petición pública no lo elige.
 */
export function createResetToken(user,expiresIn='15m'){
  return jwt.sign(
    {purpose:'password-reset'},
    secret(user.passwordHash),
    {
      subject:user.id,                     // sub: cuenta a la que pertenece.
      jwtid:randomUUID(),                   // jti: distingue enlaces emitidos por separado.
      issuer:'gymbro',                      // iss: emisor esperado.
      audience:'gymbro-password-reset',     // aud: uso autorizado.
      algorithm:'HS256',                    // Algoritmo de firma.
      expiresIn,
    },
  );
}

/** Validación real: se hace en el backend antes de permitir una escritura. */
function verify(token,user){
  try{
    // jwt.verify comprueba firma, algoritmo, emisor, destinatario y exp
    // usando el reloj del SERVIDOR. No desactivamos la comprobación de vencimiento.
    // Editar exp sin poder generar una firma válida hace que el enlace sea rechazado.
    const claims=jwt.verify(token,secret(user.passwordHash),{
      algorithms:['HS256'],
      issuer:'gymbro',
      audience:'gymbro-password-reset',
    });
    if(claims.sub!==user.id||claims.purpose!=='password-reset')throw invalid();
  }catch{
    // No exponemos detalles criptográficos al cliente.
    throw invalid();
  }
}

// bcrypt solo considera hasta 72 bytes. El control de bytes también cubre
// caracteres como emojis, que ocupan más de un byte en UTF-8.
export const newPassword=z.string().min(8,'Usá al menos 8 caracteres.').max(72,'Usá como máximo 72 caracteres.').refine(value=>Buffer.byteLength(value,'utf8')<=72,'La contraseña es demasiado larga.');

/** Consume la autorización temporal y conserva únicamente el nuevo hash. */
export async function resetPassword(token,password){
  // decode SOLO lee datos, no verifica la firma. Aquí se usa para encontrar
  // la cuenta y obtener su hash; todavía NO autoriza cambiar nada.
  let subject;
  try{subject=jwt.decode(token)?.sub;}catch{throw invalid();}
  if(!z.string().uuid().safeParse(subject).success)throw invalid();

  // findByPk respeta el borrado lógico: una cuenta archivada no puede recuperarse.
  const user=await User.findByPk(subject);
  if(!user)throw invalid();
  verify(token,user);

  // Se calcula fuera del bloqueo para no mantener la fila bloqueada durante
  // el trabajo costoso de bcrypt. 12 es su factor de costo, no una duración.
  const passwordHash=await bcrypt.hash(password,12);
  await sequelize.transaction(async transaction=>{
    // FOR UPDATE: dos solicitudes para la misma cuenta esperan su turno.
    // Se vuelve a leer el hash porque pudo cambiar desde la comprobación inicial.
    const current=await User.findByPk(subject,{transaction,lock:transaction.LOCK.UPDATE});
    if(!current)throw invalid();
    verify(token,current);

    // Al cambiar el hash cambia la clave derivada por secret(...).
    // Así dejan de servir TODOS los enlaces emitidos con el hash anterior.
    // jti por sí solo no da uso único: lo da este cambio, protegido por la transacción.
    // passwordChangedAt se usa para revocar sesiones antiguas, NO para los 15 minutos.
    await current.update({passwordHash,passwordChangedAt:new Date()},{transaction});
  });
}

/**
 * EmailJS entrega el correo; no decide si el enlace autoriza un cambio.
 * Estas variables se leen desde el backend, nunca desde Angular ni desde la APK.
 * El transporte se sustituye en pruebas para no enviar correos reales.
 */
export const recoveryDelivery={
  configured:()=>['EMAILJS_SERVICE_ID','EMAILJS_TEMPLATE_ID','EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY'].every(key=>Boolean(process.env[key])),
  async send(to,link){
    // Encadena los envíos: un fallo anterior no bloquea permanentemente los próximos.
    const run=deliveryTail.catch(()=>{}).then(async()=>{
      // Respeta el límite del proveedor para los envíos de este proceso.
      const delay=Math.max(0,nextSendAt-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      nextSendAt=Date.now()+1100;
      const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
        method:'POST',headers:{'Content-Type':'application/json'},
        // accessToken es la clave privada de EmailJS; no es el JWT de recuperación.
        // expires_minutes solo informa a la plantilla. La autoridad es exp dentro del JWT.
        body:JSON.stringify({service_id:process.env.EMAILJS_SERVICE_ID,template_id:process.env.EMAILJS_TEMPLATE_ID,user_id:process.env.EMAILJS_PUBLIC_KEY,accessToken:process.env.EMAILJS_PRIVATE_KEY,
          template_params:{to_email:to,reset_url:link,reset_token:new URLSearchParams(new URL(link).hash.slice(1)).get('token'),expires_minutes:15,app_name:'Gymbro'}}),
        // 15000 son 15 SEGUNDOS de espera de red; no son la vigencia del enlace.
        signal:AbortSignal.timeout(15000),
      });
      if(!response.ok){
        // El proveedor puede incluir datos privados en su respuesta. Solo conservamos
        // una categoría conocida y el estado HTTP; nunca imprimimos el texto recibido.
        const detail=(await response.text()).toLowerCase();
        let reason='rechazo del proveedor';
        if(/non.browser|browser applications|api requests.*disabled/.test(detail))reason='habilitar solicitudes desde el servidor en EmailJS';
        else if(/private key|access.?token/.test(detail))reason='revisar clave privada de EmailJS';
        else if(/public key|user.?id/.test(detail))reason='revisar clave pública de EmailJS';
        else if(/template/.test(detail))reason='revisar plantilla de EmailJS';
        else if(/service/.test(detail))reason='revisar servicio de correo conectado en EmailJS';
        else if(/quota|limit|too many/.test(detail))reason='cuota o límite de EmailJS alcanzado';
        else if(/recipient|address/.test(detail))reason='revisar destinatario de la plantilla';
        throw Object.assign(Error('No se pudo entregar el correo de recuperación.'),{deliveryDiagnostic:`EmailJS HTTP ${response.status}: ${reason}`});
      }
    });
    deliveryTail=run;return run;
  },
};
let deliveryTail=Promise.resolve(),nextSendAt=0;

/**
 * Evita envíos repetidos: un minuto entre solicitudes de un correo,
 * tres por correo en 15 minutos y 30 globales por minuto.
 * Estos contadores en memoria no generan ni invalidan tokens; se reinician al reiniciar.
 * La vigencia firmada del enlace sigue funcionando aunque se reinicie el servidor.
 */
export class RecoveryLimiter {
  entries=new Map();total=[];
  constructor(now=()=>Date.now()){this.now=now;}
  allow(email){
    // Descarta muestras antiguas para no acumular memoria indefinidamente.
    const now=this.now(),window=15*60000;
    for(const [key,times]of this.entries){const recent=times.filter(t=>t>now-window);if(recent.length)this.entries.set(key,recent);else this.entries.delete(key);}
    this.total=this.total.filter(t=>t>now-60000);if(this.total.length>=30||this.entries.size>=1000)return false;
    // El mapa conserva un identificador HMAC, no el correo en texto.
    const key=createHmac('sha256',config.jwtSecret).update(email.toLowerCase()).digest('hex'),times=this.entries.get(key)||[];
    if(times.length>=3||(times.length&&now-times.at(-1)<60000))return false;
    this.entries.set(key,[...times,now]);this.total.push(now);return true;
  }
}
export const recoveryLimiter=new RecoveryLimiter();
/**
 * Limita intentos de consumo: diez por enlace en 15 minutos y 60 globales por minuto.
 * Este otro plazo de 15 minutos es una cuota de intentos, distinta del exp del JWT.
 */
export class ResetAttemptLimiter {
  entries=new Map();total=[];
  constructor(now=()=>Date.now()){this.now=now;}
  allow(token){
    const now=this.now();
    for(const [key,times]of this.entries){const recent=times.filter(t=>t>now-15*60000);if(recent.length)this.entries.set(key,recent);else this.entries.delete(key);}
    this.total=this.total.filter(t=>t>now-60000);if(this.total.length>=60||this.entries.size>=1000)return false;
    const key=createHmac('sha256',config.jwtSecret).update(token).digest('hex'),times=this.entries.get(key)||[];
    if(times.length>=10)return false;this.entries.set(key,[...times,now]);this.total.push(now);return true;
  }
}
export const resetAttemptLimiter=new ResetAttemptLimiter();

/** Recorrido que comienza cuando el usuario toca "Enviar enlace de recuperación". */
export async function requestRecovery(email){
  // Si falta configuración, no afirmamos que se puede enviar un correo.
  if(!recoveryDelivery.configured())throw Object.assign(Error('La recuperación por correo todavía no está disponible. Intentá más tarde.'),{status:503});
  // El dominio sale de configuración del servidor, no de un dato proporcionado
  // por el navegador. En producción debe usar HTTPS.
  const base=new URL(config.publicApiUrl);
  if((process.env.NODE_ENV==='production'&&base.protocol!=='https:')||base.username||base.password)throw Object.assign(Error('La recuperación por correo no está configurada correctamente.'),{status:503});
  if(!recoveryLimiter.allow(email))return;
  // Consulta parametrizada de Sequelize, sin distinguir mayúsculas del correo.
  // col() recibe el nombre físico: Sequelize no traduce atributos dentro de fn().
  const user=await User.findOne({where:where(fn('lower',col(User.getAttributes().email.field)),email.toLowerCase())});
  // La ruta devuelve la misma respuesta 202 aunque no se encuentre la cuenta.
  if(!user)return;

  // Parte fija: https://TU-API/api/auth/reset-password
  // Parte variable: #token=JWT_FIRMADO_PARA_ESTA_CUENTA
  // El fragmento #... lo lee el navegador; no viaja automáticamente en el GET.
  base.pathname='/api/auth/reset-password';
  base.search='';
  base.hash='token='+encodeURIComponent(createResetToken(user));

  // No espera la entrega para responder y no revela si existe la cuenta.
  // Los fallos se registran sin imprimir correo, token ni claves.
  void recoveryDelivery.send(user.email,base.toString()).catch(error=>{
    // No imprimir error.message ni el objeto completo: una falla de red también
    // puede contener datos internos. Los diagnósticos de EmailJS son textos propios.
    const diagnostic=error.deliveryDiagnostic||(error.name==='TimeoutError'?'tiempo de espera agotado':'fallo de conexión con EmailJS');
    console.error('Falló la entrega de un correo de recuperación.',diagnostic);
  });
}
