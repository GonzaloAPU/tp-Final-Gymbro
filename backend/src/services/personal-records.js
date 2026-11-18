/** Marcas personales derivadas del historial real, sin una tabla duplicada que pueda quedar vacía. */
import {reportTable} from './database-names.js';
export function personalRecordsSql({sets,performed,exercises,sessions}){
  sets=reportTable(sets,['id','performed_exercise_id','weight_kg','repetitions','completed_at','deleted_at']);
  performed=reportTable(performed,['id','session_id','exercise_id','deleted_at']);
  exercises=reportTable(exercises,['id','name','training_type']);
  sessions=reportTable(sessions,['id','user_id','status','deleted_at']);
  // Los nombres de tabla los proporciona el generador SQL del ORM, nunca el cliente.
  // Mayor carga; las repeticiones y la fecha resuelven los empates de forma estable.
  return `WITH ranked AS (
    SELECT ps.id, s.user_id, pe.exercise_id, e.name, ps.weight_kg, ps.repetitions, ps.completed_at,
      row_number() OVER (PARTITION BY pe.exercise_id ORDER BY ps.weight_kg DESC, ps.repetitions DESC, ps.completed_at ASC, ps.id ASC) AS position
    FROM ${sets} ps
    JOIN ${performed} pe ON pe.id=ps.performed_exercise_id
    JOIN ${sessions} s ON s.id=pe.session_id
    JOIN ${exercises} e ON e.id=pe.exercise_id
    WHERE s.user_id=:userId AND s.status='COMPLETED' AND e.training_type='POWER'
      AND ps.weight_kg>0 AND ps.repetitions>0
      AND s.deleted_at IS NULL AND pe.deleted_at IS NULL AND ps.deleted_at IS NULL
  ) SELECT id, user_id AS "userId", exercise_id AS "exerciseId",
    weight_kg AS "maxWeightKg", repetitions,
    CASE WHEN repetitions=1 THEN weight_kg ELSE round(weight_kg*(1+repetitions/30.0),2) END AS "estimatedOneRm",
    completed_at AS "achievedAt", json_build_object('id',exercise_id,'name',name) AS exercise
    FROM ranked WHERE position=1
    ORDER BY weight_kg DESC, repetitions DESC, completed_at DESC, exercise_id ASC LIMIT 8`;
}
