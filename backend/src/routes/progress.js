/**
 * Consulta el progreso personal y los rankings de fuerza. El resumen mezcla historiales recientes con totales de toda la cuenta; el ranking compara series de sesiones completadas.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Router } from "express";
import { z } from "zod";
import { sequelize } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { BodyWeightHistory, Exercise, TrainingSession, User, PerformedSet, PerformedExercise } from "../models/index.js";
import { QueryTypes } from 'sequelize';
import {leaderboardSql,leaderboardDefinitions} from '../services/leaderboard.js';
import {personalRecordsSql} from '../services/personal-records.js';

export const progressRouter = Router();
progressRouter.use(requireAuth);

// GET /leaderboard: SQL agrupa variantes conocidas de nombres, elige la mejor serie de cada usuario y calcula posiciones por peso.
progressRouter.get('/leaderboard', async (req, res) => {
  const quote = model => sequelize.getQueryInterface().queryGenerator.quoteTable(model.getTableName());
  // SQL: candidates selecciona series válidas; best elige una marca por usuario y categoría.
  // dense_rank asigna el mismo puesto si varias personas empatan en peso.
  const rows = await sequelize.query(leaderboardSql({sets:quote(PerformedSet),performed:quote(PerformedExercise),exercises:quote(Exercise),sessions:quote(TrainingSession),users:quote(User)}), {type:QueryTypes.SELECT});
  const definitions = leaderboardDefinitions;
  res.json({ exercises: definitions.map(exercise => ({ ...exercise, users: rows.filter(row => row.category === exercise.key).map(row => ({ userId:row.userId, name:row.name, exerciseName:row.exerciseName, weightKg:Number(row.weightKg), repetitions:row.repetitions, achievedAt:row.achievedAt, rank:Number(row.rank), isCurrentUser:row.userId === req.auth.sub })) })) });
});

// GET /summary: Ejecuta consultas independientes en paralelo; los totales no dependen del límite de sesiones recientes.
progressRouter.get("/summary", async (req, res) => {
  const quote=model=>sequelize.getQueryInterface().queryGenerator.quoteTable(model.getTableName());
  const [sessions, weights, records, totalCalories, completedSessions] = await Promise.all([
    TrainingSession.findAll({ where: { userId: req.auth.sub, status: "COMPLETED" }, order: [["startedAt", "DESC"]], limit: 12 }),
    BodyWeightHistory.findAll({ where: { userId: req.auth.sub }, order: [["recordedAt", "DESC"]], limit: 30 }),
    sequelize.query(personalRecordsSql({sets:quote(PerformedSet),performed:quote(PerformedExercise),sessions:quote(TrainingSession),exercises:quote(Exercise)}),{replacements:{userId:req.auth.sub},type:QueryTypes.SELECT}),
    TrainingSession.sum('calories', { where: { userId: req.auth.sub, status: 'COMPLETED' } }),
    TrainingSession.count({ where: { userId: req.auth.sub, status: 'COMPLETED' } }),
  ]);
  res.json({ sessions, weights: weights.reverse(), records, totalCalories: Number(totalCalories || 0), completedSessions });
});

// POST /weight: Agrega una medición; el peso actual se obtiene del historial, sin columna duplicada.
progressRouter.post("/weight", async (req, res) => {
  const { weightKg, recordedAt } = z.object({ weightKg: z.number().positive().max(500), recordedAt: z.string().datetime().refine(value => new Date(value).getTime() <= Date.now(), 'La fecha no puede ser futura').optional() }).parse(req.body);
  const entry = await sequelize.transaction(async (transaction) => {
    // Serializa pesajes por usuario. No sobrescribe ni borra mediciones anteriores.
    const user = await User.findByPk(req.auth.sub, { transaction, lock:transaction.LOCK.UPDATE });
    if (!user) throw Object.assign(new Error('Usuario no encontrado'),{status:404});
    const date = recordedAt ? new Date(recordedAt) : new Date();
    const measurement = await BodyWeightHistory.create({ userId:req.auth.sub, weightKg, recordedAt:date }, { transaction });
    return measurement;
  });
  res.status(201).json(entry);
});
