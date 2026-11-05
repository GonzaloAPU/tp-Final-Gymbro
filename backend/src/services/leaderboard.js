/** Familias de ejercicios: una sola mejor serie por persona, aunque cambie la variante. */
import {reportTable} from './database-names.js';
export const leaderboardDefinitions = [{key:'bench',name:'Press de banca'}, {key:'squat',name:'Sentadilla'}, {key:'deadlift',name:'Peso muerto'}];
export function leaderboardSql({sets,performed,exercises,sessions,users}) {
  sets=reportTable(sets,['id','performed_exercise_id','weight_kg','repetitions','completed_at','deleted_at']);
  performed=reportTable(performed,['id','session_id','exercise_id','deleted_at']);
  exercises=reportTable(exercises,['id','name','created_by_user_id','deleted_at']);
  sessions=reportTable(sessions,['id','user_id','status','deleted_at']);
  users=reportTable(users,['id','name','leaderboard_opt_in','deleted_at']);
  // Solo se interpolan tablas del ORM. Repeticiones y fecha resuelven empates entre series.
  return `
    WITH candidates AS (
      SELECT u.id AS user_id, u.name, ps.weight_kg, ps.repetitions, ps.completed_at, ps.id, e.name AS exercise_name,
        CASE
          WHEN lower(trim(e.name)) LIKE 'sentadilla%' THEN 'squat'
          WHEN lower(trim(e.name)) LIKE 'peso muerto%' THEN 'deadlift'
          WHEN lower(trim(e.name)) LIKE 'press banca%' OR lower(trim(e.name)) LIKE 'press de banca%'
            OR lower(trim(e.name)) LIKE 'press inclinado%' OR lower(trim(e.name)) LIKE 'press declinado%'
            OR lower(trim(e.name)) LIKE 'press de pecho%' THEN 'bench'
        END AS category
      FROM ${sets} ps
      JOIN ${performed} pe ON pe.id = ps.performed_exercise_id
      JOIN ${exercises} e ON e.id = pe.exercise_id
      JOIN ${sessions} s ON s.id = pe.session_id
      JOIN ${users} u ON u.id = s.user_id
      WHERE e.created_by_user_id IS NULL AND s.status = 'COMPLETED' AND ps.weight_kg > 0 AND ps.repetitions > 0
        AND u.leaderboard_opt_in = true AND u.deleted_at IS NULL AND s.deleted_at IS NULL AND pe.deleted_at IS NULL AND ps.deleted_at IS NULL AND e.deleted_at IS NULL
    ), best AS (
      SELECT *, row_number() OVER (PARTITION BY category, user_id ORDER BY weight_kg DESC, repetitions DESC, completed_at ASC, id ASC) AS personal_best
      FROM candidates WHERE category IS NOT NULL
    )
    SELECT category, exercise_name AS "exerciseName", user_id AS "userId", name, weight_kg AS "weightKg", repetitions, completed_at AS "achievedAt",
      dense_rank() OVER (PARTITION BY category ORDER BY weight_kg DESC) AS rank
    FROM best WHERE personal_best = 1
    ORDER BY category, weight_kg DESC, repetitions DESC, name ASC, user_id ASC
  `;
}
