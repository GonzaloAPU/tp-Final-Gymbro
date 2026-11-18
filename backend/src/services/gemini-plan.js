/** Adaptador Gemini: clave solo en backend, salida estructurada y validación posterior. */
import {allowedCatalog,planningError,validateAIPlan,sessionGroups} from './welcome-planner.js';
export const geminiAvailable=()=>process.env.GEMINI_ENABLED==='true'&&Boolean(process.env.GEMINI_API_KEY);
const schema={type:'object',required:['sessions'],properties:{sessions:{type:'array',items:{type:'object',required:['exercises'],properties:{exercises:{type:'array',minItems:4,maxItems:4,items:{type:'object',required:['exerciseId','targetSets','minReps','maxReps','restSeconds'],properties:{exerciseId:{type:'string'},targetSets:{type:'integer',minimum:3,maximum:3},minReps:{type:'integer'},maxReps:{type:'integer'},restSeconds:{type:'integer'}}}}}}}}};
export async function generateGeminiPlan(input,catalog,base,fetchImpl=fetch){
  if(!geminiAvailable())throw planningError('La IA todavía no está configurada. Podés generar tu plan local.',503);
  if(!input.aiConsent)throw planningError('Confirmá el envío de los parámetros deportivos para usar la IA.',400);
  // Lista explícita de parámetros generales: nunca copiar el formulario completo.
  // Edad, medidas corporales y restricciones permanecen dentro de Gymbro.
  const profile={goal:input.goal,experience:input.experience,place:input.place,equipment:input.equipment,sessions:input.sessions,minutes:input.minutes};
  const prompt=`Proponé un plan inicial de entrenamiento general, sin recomendaciones clínicas ni rehabilitación.
Elegí exclusivamente exerciseId del catálogo provisto. No inventes ejercicios, cargas en kg ni consejos médicos.
Cada sesión debe contener 4 ejercicios únicos como mínimo (en esta versión, exactamente 4).
Cada ejercicio debe tener al menos 3 series (en esta versión, exactamente 3), 6 a 15 repeticiones y descanso de 60 a 180 segundos.
No reduzcas las series ni la cantidad de ejercicios para ajustar el tiempo. Elegí descansos compatibles con la duración disponible.
Mantener intensidad inicial moderada. Gymbro aplica los límites individuales sin compartir datos corporales.
Respetá estos grupos por sesión, en orden: ${JSON.stringify(sessionGroups(base.sessions.map(session=>session.slot)))}.
UPPER: solo tren superior; LOWER: solo tren inferior; CORE: solo zona media; null: incluir superior e inferior.
El calendario ya está calculado por el backend: no lo cambies. La duración estimada será
8 minutos + suma(series*(45+descanso)/60 + 1 minuto por ejercicio), y no puede superar minutes.
Devolvé solamente sessions con exercises y los campos del esquema.
Parámetros: ${JSON.stringify(profile)}
Catálogo: ${JSON.stringify(allowedCatalog(input,catalog))}`;
  let response;
  try {
    response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL||'gemini-2.5-flash')}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:6000,temperature:0.3}}),
      signal:AbortSignal.timeout(30000),
    });
  }catch{throw planningError('La IA no respondió a tiempo. Reintentá o usá el plan local.',503);}
  if(!response.ok)throw planningError(response.status===429?'Se alcanzó la cuota de IA. Podés continuar con un plan local.':'No pudimos consultar la IA. Podés continuar con un plan local.',503);
  try {
    const data=await response.json(),candidate=data.candidates?.[0];
    if(candidate?.finishReason!=='STOP')throw Error('Respuesta incompleta');
    const text=candidate.content.parts.filter(part=>typeof part.text==='string'&&!part.thought).map(part=>part.text).join('');
    return validateAIPlan(JSON.parse(text),input,catalog,base);
  }catch(error){if(error.status)throw error;throw planningError('La respuesta de IA no pudo validarse. Usá el plan local o reintentá.',502);}
}
