/** Versión de credenciales: cambiar el hash invalida las sesiones anteriores. */
import {createHmac,timingSafeEqual} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {config} from '../config.js';
/**
 * cv es una huella autenticada del hash actual, no la contraseña ni su hash bcrypt.
 * Se incluye en los JWT de sesión nuevos para detectar cambios de credenciales.
 */
export function credentialVersion(hash){
  return createHmac('sha256',config.jwtSecret).update('gymbro-session\0'+hash).digest('hex');
}

/** Se llama después de verificar la firma y vigencia del JWT de sesión. */
export function credentialsMatch(user,claims){
  // Permite utilizar el helper solo como comprobación de cuenta en código interno.
  // No evita requireAuth: las rutas protegidas exigen autenticación previamente.
  if(!claims)return true;
  // Compatibilidad con JWT emitidos antes de agregar cv: dejan de funcionar
  // en cuanto un restablecimiento marca passwordChangedAt.
  if(!claims.cv)return !user.passwordChangedAt;
  // La longitud fija evita errores de comparación y entradas inesperadas.
  if(typeof claims.cv!=='string'||!/^[a-f0-9]{64}$/.test(claims.cv))return false;
  // Se compara con el hash ACTUAL en base de datos, en tiempo constante.
  // Un JWT viejo puede conservar una firma válida pero ya no coincidir aquí.
  return timingSafeEqual(Buffer.from(claims.cv,'hex'),Buffer.from(credentialVersion(user.passwordHash),'hex'));
}

/** Token de inicio de sesión: dura siete días, distinto del enlace de 15 minutos. */
export function sessionToken(user){
  const hash=user.passwordHash??user.toJSON().passwordHash;
  return jwt.sign({sub:user.id,email:user.email,cv:credentialVersion(hash)},config.jwtSecret,{expiresIn:'7d',algorithm:'HS256'});
}
