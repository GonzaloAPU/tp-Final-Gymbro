/**
 * Lee variables del entorno y define valores de desarrollo. process.env contiene la configuración del proceso; Number convierte el puerto de texto a número.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import "dotenv/config";
if(process.env.NODE_ENV==='production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32 || process.env.JWT_SECRET==='change-this-in-production')) {
  throw new Error('En producción JWT_SECRET debe ser un secreto aleatorio de al menos 32 caracteres');
}

export const config = {
  port: Number(process.env.PORT || 3100),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:4300",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret",
  publicApiUrl: process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3100',
};
