/** Devuelve códigos 400/409 para validaciones o conflictos y usa el estado del error para los demás fallos. */
/**
 * Traduce errores de validación, restricciones SQL y errores de negocio a respuestas HTTP JSON. Los cuatro parámetros identifican a este middleware como manejador de errores de Express.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
export function errorHandler(error, _req, res, _next) {
  // No registrar el objeto: errores SQL incluyen consultas, parámetros y datos privados.
  const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<600?error.status:500;
  const types=['SequelizeUniqueConstraintError','SequelizeValidationError','ZodError'];
  console.error('API request failed',{status,type:types.includes(error?.name)?error.name:'RequestError'});
  if(error?.type==='entity.parse.failed')return res.status(400).json({message:'El JSON enviado no es válido.'});
  if(error?.type==='entity.too.large')return res.status(413).json({message:'La solicitud supera el tamaño permitido.'});
  if (error?.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ message: error.errors?.some(item => item.path === "email") ? "El email ya está registrado" : "Ese registro ya existe. Revisá los datos antes de volver a guardarlo." });
  }
  if (error?.name === "SequelizeValidationError") {
    return res.status(400).json({ message: "Datos invalidos", issues: (error.errors||[]).slice(0,20).map(item=>({path:item.path,message:'Revisá este campo.'})) });
  }
  if (error?.name === "ZodError") {
    return res.status(400).json({ message: "Datos invalidos", issues: error.issues.slice(0,20).map(({path,code,message})=>({path,code,message})) });
  }
  res.status(status).json({message:status>=500?'No pudimos completar la operación. Intentá más tarde.':error.message||'Solicitud inválida.'});
}
