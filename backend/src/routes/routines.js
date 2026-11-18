/**
 * Crea y consulta rutinas propias, guarda favoritos y reemplaza asignaciones del calendario. Los horarios se almacenan en routine_schedules, no en el campo JSON antiguo.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Router } from "express";
import { z } from "zod";
import { sequelize } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { Exercise, Routine, RoutineDay, RoutineExercise, RoutineSchedule, User, UserRestDay } from "../models/index.js";
import { assertExercisesAccessible } from '../services/exercise-access.js';
import { scheduleSchema, validateSchedule } from '../schedule.js';

export const routinesRouter = Router();
routinesRouter.use(requireAuth);

// PATCH /:routineId/days/:dayId/favorite: Verifica que el bloque pertenezca al usuario y persiste su estado favorito.
routinesRouter.patch('/:routineId/days/:dayId/favorite', async (req, res) => {
  const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
  const day = await RoutineDay.findOne({ where: { id: req.params.dayId, routineId: req.params.routineId }, include: [{ model: Routine, as: 'routine', required: true, where: { userId: req.auth.sub } }] });
  if (!day) throw Object.assign(new Error('Rutina no encontrada'), { status: 404 });
  await day.update({ favorite });
  res.json({ favorite });
});

// Carga anticipada: obtiene días, prescripciones, datos del catálogo y horarios en la consulta de rutinas.
const routineInclude = [{
  model: RoutineDay,
  as: "days",
  include: [{ model: RoutineExercise, as: "exercises", include: [{ model: Exercise, as: "exercise", paranoid:false }] }, { model: RoutineSchedule, as: 'schedules' }],
}];

/** Normaliza horas SQL a HH:mm y ordena los horarios empezando por lunes. */
function slotsFor(day) {
  return (day.schedules || []).map(slot => ({ weekday: slot.weekday, start: slot.start.slice(0, 5), end: slot.end.slice(0, 5) }))
    .sort((a,b) => ((a.weekday+6)%7)-((b.weekday+6)%7) || a.start.localeCompare(b.start));
}
/** Construye la respuesta de la API con schedule calculado desde la tabla de asignaciones. */
function serializeRoutine(routine) {
  const result = routine.toJSON();
  for (const day of result.days || []) { day.schedule = slotsFor(day); delete day.schedules; }
  return result;
}

// PUT /:routineId/days/:dayId/schedule: Reemplaza horarios dentro de una transacción: comprueba descansos, cruces y máximo diario antes de borrar y crear filas.
routinesRouter.put('/:routineId/days/:dayId/schedule', async (req, res) => {
  const { schedule } = scheduleSchema.parse(req.body);
  await sequelize.transaction(async transaction => {
    // Bloquea la fila del usuario: dos solicitudes simultáneas no pueden superar juntas el límite diario.
    const user = await User.findByPk(req.auth.sub, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
    const restDays = (await UserRestDay.findAll({where:{userId:user.id},transaction})).map(day=>day.weekday);
    if (schedule.some(slot => restDays.includes(slot.weekday))) throw Object.assign(new Error('No podés asignar rutinas a un día de descanso. Quitá primero ese día de descanso en el calendario.'), { status: 409 });
    const days = await RoutineDay.findAll({ include: [{ model: Routine, as: 'routine', required: true, where: { userId: req.auth.sub } }, { model: RoutineSchedule, as: 'schedules' }], transaction });
    const day = days.find(item => item.id === req.params.dayId && item.routineId === req.params.routineId);
    if (!day) throw Object.assign(new Error('Día de rutina no encontrado'), { status: 404 });
    validateSchedule(schedule, days.filter(item => item.id !== day.id).flatMap(slotsFor));
    await RoutineSchedule.destroy({ where: { routineDayId: day.id }, transaction });
    await RoutineSchedule.bulkCreate(schedule.map(slot => ({ ...slot, routineDayId: day.id })), { transaction });
  });
  res.json({ schedule });
});

// POST /: Crea rutina, bloques y ejercicios juntos; si falla cualquier paso se revierte la transacción.
routinesRouter.post("/", async (req, res) => {
  const input = z.object({
    name: z.string().min(2).max(100),
    goal: z.string().min(2).max(160),
    days: z.array(z.object({
      name: z.string().min(2).max(80),
      dayNumber: z.number().int().positive(),
      exercises: z.array(z.object({
        exerciseId: z.string().uuid(), order: z.number().int().positive(),
        targetSets: z.number().int().positive().default(1),
        minReps: z.number().int().positive().default(1),
        maxReps: z.number().int().positive().default(1),
        restSeconds: z.number().int().nonnegative().default(0),
        targetDurationMinutes: z.number().int().positive().nullable().optional(),
        targetDistanceKm: z.number().positive().nullable().optional(),
        intensity: z.enum(["BAJA", "MEDIA", "ALTA"]).nullable().optional(),
      })).min(1),
    })).min(1),
  }).parse(req.body);

  const routine = await sequelize.transaction(async (transaction) => {
    await assertExercisesAccessible(input.days.flatMap(day=>day.exercises.map(item=>item.exerciseId)), req.auth.sub, transaction);
    await Routine.update({ active: false }, { where: { userId: req.auth.sub }, transaction });
    const created = await Routine.create({ userId: req.auth.sub, name: input.name, goal: input.goal, active: true }, { transaction });
    for (const dayInput of input.days) {
      const day = await RoutineDay.create({ routineId: created.id, name: dayInput.name, dayNumber: dayInput.dayNumber }, { transaction });
      await RoutineExercise.bulkCreate(dayInput.exercises.map(item => ({ ...item, routineDayId: day.id })), { transaction });
    }
    return created;
  });
  const result = await Routine.findByPk(routine.id, { include: routineInclude });
  res.status(201).json(serializeRoutine(result));
});

// GET /: Consulta únicamente rutinas del usuario y carga sus relaciones mediante include.
routinesRouter.get("/", async (req, res) => {
  const routines = await Routine.findAll({
    where: { userId: req.auth.sub },
    include: routineInclude,
    order: [["createdAt", "DESC"], [{ model: RoutineDay, as: "days" }, "dayNumber", "ASC"], [{ model: RoutineDay, as: "days" }, { model: RoutineExercise, as: "exercises" }, "order", "ASC"]],
  });
  res.json(routines.map(serializeRoutine));
});
