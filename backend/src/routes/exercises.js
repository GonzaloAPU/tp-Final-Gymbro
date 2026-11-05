/**
 * Catálogo compartido de ejercicios: exige autenticación, valida nuevos ejercicios y permite filtrar el listado por tipo y grupo muscular.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Router } from "express";
import { z } from "zod";
import { Exercise } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeExerciseName, exerciseScope } from '../services/exercise-access.js';
import { sequelize } from '../db.js';
import {exerciseVideoPattern} from '../services/exercise-video-url.js';

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

// POST /: Crea un ejercicio tras validar su forma y comprobar duplicados sin distinguir mayúsculas.
exercisesRouter.post('/', async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(255),
    muscleGroup: z.string().trim().min(2).max(255),
    equipment: z.string().trim().min(2).max(255),
    movementPattern: z.string().trim().max(255).nullable().optional(),
    description: z.string().trim().min(10).max(1500).nullable().optional(),
    videoUrl: z.string().regex(exerciseVideoPattern,'Usá el enlace directo de un video de YouTube o TikTok.').nullable().optional(),
    trainingType: z.enum(['POWER', 'AEROBIC', 'ANAEROBIC']),
  }).parse(req.body);
  const normalizedName = normalizeExerciseName(input.name);
  const exercise = await sequelize.transaction(async transaction => {
    // Serializa nombres equivalentes; los índices SQL son la última barrera contra carreras.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:name, 0))',{replacements:{name:normalizedName},transaction});
    const existing = await Exercise.findOne({where:{normalizedName,...exerciseScope(req.auth.sub)},paranoid:false,transaction});
    if (existing) throw Object.assign(new Error(existing.deletedAt?'Ese ejercicio está archivado. Se debe restaurar, no duplicar.':'Ese ejercicio ya existe en el catálogo o entre tus ejercicios. Seleccionalo para usarlo.'),{status:409});
    return Exercise.create({...input,name:input.name.trim().replace(/\s+/g,' '),normalizedName,createdByUserId:req.auth.sub,movementPattern:input.movementPattern || null},{transaction});
  });
  res.status(201).json(exercise);
});

// GET /: Lista el catálogo aplicando filtros opcionales y un orden estable para la interfaz.
exercisesRouter.get("/", async (req, res) => {
  const filters = z.object({
    trainingType: z.enum(["POWER", "AEROBIC", "ANAEROBIC"]).optional(),
    muscleGroup: z.string().min(1).optional(),
  }).parse(req.query);
  const exercises = await Exercise.findAll({
    where: {...filters,...exerciseScope(req.auth.sub)},
    order: [["trainingType", "ASC"], ["muscleGroup", "ASC"], ["name", "ASC"]],
  });
  res.json(exercises);
});
