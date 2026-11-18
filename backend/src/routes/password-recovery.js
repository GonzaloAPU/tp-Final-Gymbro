/**
 * Entradas HTTP de recuperación. app.js monta este router en /api/auth.
 * El endpoint se identifica por método + ruta: GET y POST pueden compartir URL.
 * Las funciones de este archivo reciben/validan datos; el servicio decide y escribe.
 */
import {Router} from 'express';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {requestRecovery,resetPassword,recoveryMessage,newPassword,resetAttemptLimiter} from '../services/password-recovery.js';
import {passwordResetPage} from '../views/password-reset.js';
export const passwordRecoveryRouter=Router();

// No conservar respuestas sensibles en caché ni enviar la URL como referrer.
passwordRecoveryRouter.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});next();});

// POST /api/auth/forgot-password
// Entrada: {"email":"persona@ejemplo.com"}.
// Es público porque la persona justamente no puede iniciar sesión.
passwordRecoveryRouter.post('/forgot-password',async(req,res)=>{
  // req.body es el JSON enviado por Angular. parse rechaza datos que no cumplen.
  const {email}=z.object({email:z.string().trim().email().max(254)}).parse(req.body);
  await requestRecovery(email);
  // 202 significa solicitud aceptada, no garantiza entrega del correo.
  // El mensaje es idéntico para cuentas existentes, ausentes o solicitudes limitadas.
  res.status(202).json({message:recoveryMessage});
});

// POST /api/auth/reset-password
// Entrada: {"token":"JWT_DEL_CORREO","password":"NUEVA_CONTRASEÑA"}.
// No exige sesión, pero resetPassword exige un token de recuperación válido.
passwordRecoveryRouter.post('/reset-password',async(req,res)=>{
  const {token,password}=z.object({token:z.string().min(1).max(4096),password:newPassword}).parse(req.body);
  if(!resetAttemptLimiter.allow(token))return res.status(429).json({message:'Hubo demasiados intentos. Esperá unos minutos o solicitá un enlace nuevo.'});
  await resetPassword(token,password);
  // No devolvemos un JWT de sesión: después del cambio se inicia sesión normalmente.
  res.json({message:'Contraseña actualizada. Abrí Gymbro e iniciá sesión con tu nueva contraseña.'});
});

// GET /api/auth/reset-password
// Solo entrega el HTML del formulario. Abrirlo no consume ni verifica el token:
// la validación que autoriza el cambio ocurre en el POST anterior.
// Esta página sigue existiendo cuando un enlace vence; lo que vence es su JWT.
passwordRecoveryRouter.get('/reset-password',(_req,res)=>{
  // Este nonce NO es el token del correo. Es un valor aleatorio para autorizar
  // únicamente el script de esta página mediante Content-Security-Policy (CSP).
  const nonce=randomBytes(18).toString('base64');
  res.set({'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,'X-Frame-Options':'DENY'});
  // El mismo nonce se coloca en la cabecera CSP y en la etiqueta <script>.
  res.type('html').send(passwordResetPage(nonce));
});
