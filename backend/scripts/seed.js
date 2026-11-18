/**
 * Carga catálogo y cuenta demo en PostgreSQL usando findOrCreate para reutilizar registros. Son datos de demostración; ejecutar este script puede actualizar ejercicios existentes.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { sequelize } from "../src/db.js";
import { Exercise, Routine, RoutineDay, RoutineExercise, User, BodyWeightHistory } from "../src/models/index.js";

import { exerciseData } from "../src/data/exercise-catalog.js";

try {
  await sequelize.authenticate();
  const catalog = [];
  for (const data of exerciseData) {
    const [exercise] = await Exercise.findOrCreate({ where: { name: data.name, createdByUserId:null }, defaults: data });
    await exercise.update({...data,description:exercise.description||data.description,videoUrl:exercise.videoUrl||data.videoUrl});
    catalog.push(exercise);
  }

  const [user] = await User.findOrCreate({
    where: { email: "demo@smartgymbro.app" },
    defaults: {
      passwordHash: await bcrypt.hash("Demo1234!", 12), name: "Alex",
      goal: "Ganar fuerza y masa muscular", heightCm: 178,
      gymName: "Smart Gym Centro",
    },
  });

  if (!await BodyWeightHistory.count({where:{userId:user.id}})) await BodyWeightHistory.create({userId:user.id,weightKg:78.4});
  const existingRoutine = await Routine.findOne({ where: { userId: user.id } });
  if (!existingRoutine) {
    const routine = await Routine.create({ userId: user.id, name: "Fuerza base", goal: "Progresion de cargas" });
    const day = await RoutineDay.create({ routineId: routine.id, name: "Torso + pierna", dayNumber: 1 });
    await RoutineExercise.bulkCreate(catalog.slice(0, 4).map((exercise, index) => ({
      routineDayId: day.id, exerciseId: exercise.id, order: index + 1,
      targetSets: index === 0 ? 4 : 3, minReps: index < 2 ? 5 : 8,
      maxReps: index < 2 ? 8 : 12, restSeconds: index < 2 ? 120 : 90,
    })));
  }
  console.log("Datos demo cargados con Sequelize.");
} finally {
  await sequelize.close();
}
