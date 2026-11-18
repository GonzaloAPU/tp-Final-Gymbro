/**
 * Genera cinco perfiles ficticios con rutinas, pesos y sesiones históricas. Usa una transacción y omite cuentas que ya existen para conservar sus datos.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';
import { sequelize } from '../src/db.js';
import { User, Exercise, Routine, RoutineDay, RoutineExercise, TrainingSession, PerformedExercise, PerformedSet, BodyWeightHistory, StrengthRecord } from '../src/models/index.js';

const profiles = [
  { name: 'Sofía', email: 'sofia@smartgymbro.app', goal: 'Empezar a entrenar con constancia', heightCm: 164, startKg: 64, endKg: 63.2, sessions: 6, weeks: 3, base: 15, gain: 5, sets: 2, reps: 12, routine: 'Primeros pasos', days: [['Cuerpo completo A', 'Sentadilla', 'Remo sentado', 'Press banca'], ['Cuerpo completo B', 'Hip thrust', 'Press militar', 'Curl de biceps']] },
  { name: 'Lucas', email: 'lucas@smartgymbro.app', goal: 'Aumentar fuerza', heightCm: 182, startKg: 82, endKg: 84, sessions: 24, weeks: 8, base: 60, gain: 25, sets: 4, reps: 5, routine: 'Fuerza progresiva', days: [['Sentadilla y empuje', 'Sentadilla', 'Press banca', 'Remo sentado'], ['Cadena posterior', 'Peso muerto rumano', 'Press militar', 'Hip thrust'], ['Fuerza completa', 'Sentadilla', 'Press banca', 'Peso muerto rumano']] },
  { name: 'Valentina', email: 'valentina@smartgymbro.app', goal: 'Mejorar composición corporal', heightCm: 168, startKg: 78, endKg: 72.5, sessions: 20, weeks: 10, base: 22.5, gain: 12.5, sets: 3, reps: 12, routine: 'Torso y piernas', days: [['Piernas y glúteos', 'Sentadilla', 'Hip thrust', 'Peso muerto rumano'], ['Torso', 'Press banca', 'Remo sentado', 'Press militar']] },
  { name: 'Mateo', email: 'mateo@smartgymbro.app', goal: 'Ganar masa muscular', heightCm: 176, startKg: 68, endKg: 71.5, sessions: 30, weeks: 10, base: 30, gain: 20, sets: 4, reps: 10, routine: 'Hipertrofia en tres días', days: [['Empuje', 'Press banca', 'Press militar', 'Sentadilla'], ['Tracción', 'Remo sentado', 'Curl de biceps', 'Peso muerto rumano'], ['Piernas', 'Sentadilla', 'Hip thrust', 'Peso muerto rumano']] },
  { name: 'Camila', email: 'camila@smartgymbro.app', goal: 'Retomar el entrenamiento y mantener el peso', heightCm: 170, startKg: 66, endKg: 66.2, sessions: 9, weeks: 6, base: 20, gain: 7.5, sets: 3, reps: 8, routine: 'Vuelta al gimnasio', days: [['Base A', 'Sentadilla', 'Press banca', 'Remo sentado'], ['Base B', 'Hip thrust', 'Press militar', 'Curl de biceps']] },
];

const catalog = [
  ['Sentadilla', 'Piernas', 'Barra'], ['Press banca', 'Pecho', 'Barra'],
  ['Peso muerto rumano', 'Isquiotibiales', 'Barra'], ['Remo sentado', 'Espalda', 'Polea'],
  ['Press militar', 'Hombros', 'Mancuernas'], ['Hip thrust', 'Glúteos', 'Barra'],
  ['Curl de biceps', 'Brazos', 'Mancuernas'],
];
const round = value => Math.round(value * 100) / 100;
const anchor = new Date();
// Mediodía en Argentina: los historiales terminan ayer, sin entrenamientos futuros.
anchor.setUTCHours(15, 0, 0, 0);
anchor.setUTCDate(anchor.getUTCDate() - 1);
const daysAgo = days => new Date(anchor.getTime() - days * 86400000);

try {
  await sequelize.authenticate();
  const passwordHash = await bcrypt.hash('Demo1234!', 12);
  await sequelize.transaction(async transaction => {
    const options = { transaction };
    const exercises = new Map();
    for (const [name, muscleGroup, equipment] of catalog) {
      const [exercise] = await Exercise.findOrCreate({ where: { name, createdByUserId:null }, defaults: { name, muscleGroup, equipment, trainingType: 'POWER' }, transaction });
      exercises.set(name, exercise);
    }
    for (const profile of profiles) {
      const [user, created] = await User.findOrCreate({ where: { email: profile.email }, defaults: {
        name: profile.name, passwordHash, goal: profile.goal, heightCm: profile.heightCm,
        gymName: 'Smart Gym Centro',
      }, transaction });
      if (!created) {
        console.log(`${profile.email}: ya existe; se conserva sin cambios.`);
        continue;
      }
      await user.update({ createdAt: daysAgo(profile.weeks * 7) }, options);
      const routine = await Routine.create({ userId: user.id, name: profile.routine, goal: profile.goal, createdAt: daysAgo(profile.weeks * 7) }, options);
      const days = [];
      for (const [index, [name, ...names]] of profile.days.entries()) {
        const day = await RoutineDay.create({ routineId: routine.id, name, dayNumber: index + 1 }, options);
        const items = names.map(name => exercises.get(name));
        await RoutineExercise.bulkCreate(items.map((exercise, order) => ({ routineDayId: day.id, exerciseId: exercise.id, order: order + 1, targetSets: profile.sets, minReps: profile.reps, maxReps: profile.reps + 2, restSeconds: profile.reps === 5 ? 150 : 90 })), options);
        days.push({ day, items });
      }
      await BodyWeightHistory.bulkCreate(Array.from({ length: profile.weeks + 1 }, (_, index) => ({ userId: user.id, weightKg: round(profile.startKg + (profile.endKg - profile.startKg) * index / profile.weeks), recordedAt: daysAgo((profile.weeks - index) * 7) })), options);
      const best = new Map();
      for (let index = 0; index < profile.sessions; index++) {
        const { day, items } = days[index % days.length];
        const startedAt = daysAgo(Math.round((profile.sessions - 1 - index) * profile.weeks * 7 / (profile.sessions - 1)));
        const durationSeconds = (35 + profile.sets * 5 + index % 6) * 60;
        const finishedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
        const session = await TrainingSession.create({ userId: user.id, routineDayId: day.id, startedAt, finishedAt, durationSeconds, status: 'COMPLETED', calories: round(durationSeconds / 60 * 6.5), totalVolumeKg: 0 }, options);
        let volume = 0;
        for (const [order, exercise] of items.entries()) {
          const performed = await PerformedExercise.create({ sessionId: session.id, exerciseId: exercise.id, order: order + 1 }, options);
          const factor = exercise.name === 'Curl de biceps' ? 0.35 : exercise.name === 'Press militar' ? 0.5 : 1;
          const weightKg = Math.round((profile.base + profile.gain * index / (profile.sessions - 1)) * factor / 2.5) * 2.5;
          const rows = Array.from({ length: profile.sets }, (_, set) => ({ performedExerciseId: performed.id, setNumber: set + 1, weightKg, repetitions: profile.reps, actualRestSeconds: profile.reps === 5 ? 150 : 90, completedAt: new Date(startedAt.getTime() + (order * profile.sets + set + 1) * durationSeconds * 1000 / (items.length * profile.sets + 1)) }));
          await PerformedSet.bulkCreate(rows, options);
          volume += weightKg * profile.reps * profile.sets;
          const record = { userId: user.id, exerciseId: exercise.id, maxWeightKg: weightKg, repetitions: profile.reps, estimatedOneRm: round(weightKg * (1 + profile.reps / 30)), achievedAt: finishedAt };
          if (!best.has(exercise.id) || best.get(exercise.id).estimatedOneRm < record.estimatedOneRm) best.set(exercise.id, record);
        }
        await session.update({ totalVolumeKg: round(volume) }, options);
      }
      await StrengthRecord.bulkCreate([...best.values()], options);
      assert.equal(await TrainingSession.count({ where: { userId: user.id }, transaction }), profile.sessions);
      assert.equal(await BodyWeightHistory.count({ where: { userId: user.id }, transaction }), profile.weeks + 1);
      console.log(`${profile.email}: ${profile.sessions} sesiones, ${days.length} días de rutina, ${profile.startKg} → ${profile.endKg} kg.`);
    }
  });
  console.log('Cuentas de prueba listas. Contraseña: Demo1234!');
} finally {
  await sequelize.close();
}
