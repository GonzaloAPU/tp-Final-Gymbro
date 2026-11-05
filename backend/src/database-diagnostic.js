/** Traduce únicamente causas conocidas: nunca devuelve mensajes, URI ni credenciales del driver. */
export function databaseDiagnostic(error){
  const cause=error?.original||error?.parent||error?.cause||error;
  const code=String(cause?.code||'');
  const message=String(cause?.message||'');
  if(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED'].includes(code)||/self.signed certificate|unable to verify.*certificate|certificate chain/i.test(message))
    return 'DB_TLS: no se pudo verificar el certificado. Cargá la CA de Supabase como Secret File y configurá DB_SSL_CA_FILE=/etc/secrets/supabase-ca.crt. No desactives TLS.';
  if(code==='28P01'||/password authentication failed/i.test(message))
    return 'DB_AUTH: Supabase rechazó la contraseña. Revisá la contraseña vigente de gymbro_backend y DATABASE_URL en Render.';
  if(/tenant or user not found/i.test(message))
    return 'DB_POOLER: proyecto, región o usuario incorrecto. Copiá el host de Connect > Session pooler y usá gymbro_backend.PROJECT_REF en puerto 5432.';
  if(code==='42501'||/permission denied/i.test(message))
    return 'DB_PERMISSIONS: faltan permisos SQL. Verificá que 02-backend-role.sql se haya ejecutado en el mismo proyecto.';
  if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'DB_DNS: no se pudo resolver el host. Copialo nuevamente desde Connect > Session pooler.';
  if(['ETIMEDOUT','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH'].includes(code)||/timeout/i.test(message))
    return 'DB_NETWORK: no se pudo alcanzar Supabase. Revisá que el proyecto esté activo y el Session pooler use puerto 5432.';
  return 'DB_CONNECTION: causa no reconocida. Revisá en Supabase los logs de conexión y que la URI sea de Session pooler; no compartas contraseñas.';
}
