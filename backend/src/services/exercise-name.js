/** Normalización pura, compartida por catálogo y selección de planes. */
export function normalizeExerciseName(name){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();}
