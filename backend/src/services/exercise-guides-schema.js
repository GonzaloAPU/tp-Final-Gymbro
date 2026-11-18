/** SQL repetible: completa solo información faltante del catálogo oficial. */
import {exerciseGuides} from '../data/exercise-guides.js';
import {normalizeExerciseName} from './exercise-name.js';
const literal=value=>value==null?'NULL':"'"+value.replaceAll("'","''")+"'";
export function exerciseGuidesSql(schema){
  if(!['public','gymbro'].includes(schema))throw Error('Esquema no permitido');
  const rows=Object.entries(exerciseGuides).map(([name,guide])=>`(${literal(normalizeExerciseName(name))},${literal(guide.description)},${literal(guide.videoUrl)})`).join(',\n');
  return `ALTER TABLE "${schema}".exercises ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE "${schema}".exercises ADD COLUMN IF NOT EXISTS video_url text;
COMMENT ON COLUMN "${schema}".exercises.video_url IS 'Enlace directo a un video de YouTube o TikTok. No almacena el archivo.';
UPDATE "${schema}".exercises AS exercise
SET description=COALESCE(NULLIF(btrim(exercise.description),''),guide.description),
    video_url=COALESCE(NULLIF(btrim(exercise.video_url),''),guide.video_url)
FROM (VALUES ${rows}) AS guide(normalized_name,description,video_url)
WHERE exercise.normalized_name=guide.normalized_name AND exercise.created_by_user_id IS NULL;
INSERT INTO "${schema}".schema_migrations(version) VALUES ('20261025_exercise_guides') ON CONFLICT DO NOTHING;`;
}
