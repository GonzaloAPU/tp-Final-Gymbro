/**
 * Middleware de autenticación del servidor. Verifica la firma y vencimiento del JWT recibido por Authorization y expone sus datos en req.auth; sub identifica al usuario.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import jwt from "jsonwebtoken";
import { config } from "../config.js";

/** Extrae y verifica el token; next continúa hacia la ruta solo si la autenticación es válida. */
export function requireAuth(req, res, next) {
  const header=req.headers.authorization;
  const token=typeof header==='string'?/^Bearer\s+(\S+)$/i.exec(header)?.[1]:undefined;
  if (!token) return res.status(401).json({ message: "Autenticacion requerida" });

  try {
    const claims=jwt.verify(token,config.jwtSecret,{algorithms:['HS256']});
    if(typeof claims!=='object'||typeof claims.sub!=='string'||!claims.sub.trim())throw Error('Invalid subject');
    req.auth=claims;
    next();
  } catch {
    res.status(401).json({ message: "Token invalido o vencido" });
  }
}
