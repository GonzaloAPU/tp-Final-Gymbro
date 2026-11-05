/**
 * Construye la API Express: permite solicitudes del frontend, interpreta JSON y conecta las rutas. El manejador de errores va al final para recibir fallos de las rutas anteriores.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { routinesRouter } from "./routes/routines.js";
import { sessionsRouter } from "./routes/sessions.js";
import { progressRouter } from "./routes/progress.js";
import { exercisesRouter } from "./routes/exercises.js";
import { errorHandler } from "./middleware/error-handler.js";
import {welcomeRouter} from './routes/welcome.js';
import {requireAuth} from './middleware/auth.js';
import {requireActiveAccount} from './middleware/active-account.js';
import {legalRouter} from './routes/legal.js';
import {requireLegal} from './services/legal.js';
import {passwordRecoveryRouter} from './routes/password-recovery.js';

export const app = express();
app.disable('x-powered-by');
app.use('/api',(_req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
  next();
});
// Capacitor sirve los archivos instalados desde https://localhost dentro de Android.
// Conservamos una lista explícita para no abrir la API a cualquier sitio.
app.use(cors({ origin: [config.frontendUrl, 'https://localhost'] }));
// Las fotos se comprimen en el navegador a un máximo de 650.000 caracteres Base64.
// El límite de 1 MB deja margen para el resto de los campos del perfil en el JSON.
app.use(express.json({ limit: '1mb' }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "smartgymbro-api" }));
app.use('/api',(req,res,next)=>{
  // Recuperar acceso debe funcionar sin una sesión iniciada. Esto no habilita
  // cambios libres: el POST de reset valida su propio JWT de recuperación.
  if(['/auth/register','/auth/login','/auth/forgot-password','/auth/reset-password','/legal/documents','/legal/privacy','/legal/terms'].includes(req.path))return next();
  requireAuth(req,res,()=>requireActiveAccount(req,res,next));
});
app.use('/api/legal',legalRouter);
app.use('/api',(req,res,next)=>{
  if(['/auth/register','/auth/login','/auth/forgot-password','/auth/reset-password','/auth/me'].includes(req.path)&&req.method!=='PATCH')return next();
  requireLegal(req,res,next);
});
// Prefijo fijo: se suma a las rutas del router (/forgot-password y /reset-password).
app.use('/api/auth',passwordRecoveryRouter);
app.use("/api/auth", authRouter);
app.use("/api/routines", routinesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/progress", progressRouter);
app.use("/api/exercises", exercisesRouter);
app.use('/api/welcome',welcomeRouter);
app.use(errorHandler);
