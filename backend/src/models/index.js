/**
 * Mapa de tablas Sequelize y sus relaciones. define declara columnas; hasMany/belongsTo unen entidades mediante claves foráneas. Los modelos son usados por rutas, migración y semillas.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import {applySpanishModelNames} from '../services/database-names.js';

// Cuenta y perfil: el email es único y passwordHash guarda el hash. Peso actual y descansos se consultan desde sus tablas. photoUrl contiene la imagen comprimida como texto Base64.
export const User = sequelize.define("User", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  aiWeekStart: {type:DataTypes.DATE,allowNull:true},
  aiWeeklyUsed: {type:DataTypes.INTEGER,allowNull:false,defaultValue:0,validate:{min:0,max:3}},
  passwordChangedAt: {type:DataTypes.DATE,allowNull:true},
  name: { type: DataTypes.STRING, allowNull: false },
  goal: DataTypes.STRING,
  heightCm: DataTypes.INTEGER,
  gymName: DataTypes.STRING,
  discipline: DataTypes.STRING,
  photoUrl: DataTypes.TEXT,
  leaderboardOptIn: {type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},
}, {paranoid:true});

// Recibo inmutable de cada aceptación o retiro de consentimiento; conserva el texto leído.
export const LegalAcceptance = sequelize.define('LegalAcceptance', {
  id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},
  version:{type:DataTypes.STRING(80),allowNull:false},
  documentHash:{type:DataTypes.STRING(64),allowNull:false},
  documents:{type:DataTypes.JSONB,allowNull:false},
  termsAccepted:{type:DataTypes.BOOLEAN,allowNull:false},
  privacyAcknowledged:{type:DataTypes.BOOLEAN,allowNull:false},
  adultConfirmed:{type:DataTypes.BOOLEAN,allowNull:false},
  sportsDataConsent:{type:DataTypes.BOOLEAN,allowNull:false},
  acceptedAt:{type:DataTypes.DATE,allowNull:false},
}, {timestamps:false,indexes:[{fields:['user_id','accepted_at']}]});
User.hasMany(LegalAcceptance,{foreignKey:{name:'userId',allowNull:false},as:'legalAcceptances',onDelete:'RESTRICT'});
LegalAcceptance.belongsTo(User,{foreignKey:'userId',as:'user'});

// Un descanso por fila; el índice compuesto impide repetir el mismo día por usuario.
export const UserRestDay = sequelize.define('UserRestDay', {
  id: {type:DataTypes.UUID, defaultValue:DataTypes.UUIDV4, primaryKey:true},
  weekday: {type:DataTypes.INTEGER, allowNull:false, validate:{min:0,max:6}},
}, {timestamps:false, indexes:[{unique:true,fields:['user_id','weekday']}]});

// Documento de propuesta: conserva la entrada y el resultado para aceptar una sola vez.
// Los ejercicios y horarios aceptados se guardan en las tablas normalizadas existentes.
export const WelcomePlan = sequelize.define('WelcomePlan', {
  id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},
  preferences:{type:DataTypes.JSONB,allowNull:false},
  proposal:{type:DataTypes.JSONB,allowNull:false},
  source:{type:DataTypes.STRING(16),allowNull:false},
  acceptedAt:DataTypes.DATE,
  skippedAt:DataTypes.DATE,
}, {indexes:[{unique:true,fields:['user_id']}]});

// Catálogo reutilizable. No incluye series realizadas: estas se registran por separado para cada sesión.
export const Exercise = sequelize.define("Exercise", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  normalizedName: { type: DataTypes.STRING, allowNull: false },
  muscleGroup: { type: DataTypes.STRING, allowNull: false },
  equipment: { type: DataTypes.STRING, allowNull: false },
  movementPattern: DataTypes.STRING,
  description: DataTypes.TEXT,
  videoUrl: DataTypes.TEXT,
  trainingType: { type: DataTypes.STRING, allowNull: false, defaultValue: "POWER" },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, hooks: {
  // La base también normaliza mediante trigger: protege escrituras fuera de Sequelize.
  beforeValidate(exercise) { if (exercise.name) exercise.normalizedName = exercise.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase(); },
} });

// Contenedor de rutinas de un usuario. active indica la última rutina creada; el plan semanal utiliza asignaciones, no esta bandera.
export const Routine = sequelize.define("Routine", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  goal: { type: DataTypes.STRING, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { updatedAt: false, paranoid:true });

// Bloque de ejercicios heredado del diseño por días. dayNumber es un orden interno, no un día de semana. Los horarios viven únicamente en RoutineSchedule.
export const RoutineDay = sequelize.define("RoutineDay", {
  favorite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  dayNumber: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ unique: true, fields: ["routine_id", "day_number"] }] });

// Prescripción: vincula un ejercicio del catálogo con un bloque y define orden, series, repeticiones, descanso y objetivos de cardio.
export const RoutineExercise = sequelize.define("RoutineExercise", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  order: { type: DataTypes.INTEGER, allowNull: false },
  targetSets: { type: DataTypes.INTEGER, allowNull: false },
  minReps: { type: DataTypes.INTEGER, allowNull: false },
  maxReps: { type: DataTypes.INTEGER, allowNull: false },
  restSeconds: { type: DataTypes.INTEGER, defaultValue: 90 },
  targetDurationMinutes: DataTypes.INTEGER,
  targetDistanceKm: DataTypes.DECIMAL(7, 2),
  intensity: DataTypes.STRING,
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ unique: true, fields: ["routine_day_id", "order"] }] });

// Una asignación semanal por fila: día y rango horario. Varias filas permiten repetir la misma rutina en distintos días.
export const RoutineSchedule = sequelize.define('RoutineSchedule', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  weekday: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0, max: 6 } },
  start: { type: DataTypes.TIME, field: 'start_time', allowNull: false },
  end: { type: DataTypes.TIME, field: 'end_time', allowNull: false },
}, { tableName: 'routine_schedules', indexes: [{ unique: true, fields: ['routine_day_id', 'weekday', 'start_time', 'end_time'] }] });

// Una ejecución real del entrenamiento, con estado, duración y totales. startedAt/finishedAt son fechas; durationSeconds puede excluir las pausas.
export const TrainingSession = sequelize.define("TrainingSession", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  finishedAt: DataTypes.DATE,
  durationSeconds: DataTypes.INTEGER,
  status: { type: DataTypes.ENUM("ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"), defaultValue: "ACTIVE" },
  calories: DataTypes.DECIMAL(7, 2),
  totalVolumeKg: DataTypes.DECIMAL(12, 2),
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ fields: ["user_id", "started_at"] }] });

// Ejercicio realizado dentro de una sesión; su ID agrupa todas las series de ese ejercicio en ese entrenamiento.
export const PerformedExercise = sequelize.define("PerformedExercise", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  order: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ unique: true, fields: ["session_id", "order"] }] });

// Una serie realizada: peso, repeticiones y tiempos. El índice único evita repetir el mismo número de serie dentro del mismo ejercicio realizado.
export const PerformedSet = sequelize.define("PerformedSet", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  setNumber: { type: DataTypes.INTEGER, allowNull: false },
  weightKg: { type: DataTypes.DECIMAL(7, 2), allowNull: false },
  repetitions: { type: DataTypes.INTEGER, allowNull: false },
  durationSeconds: DataTypes.INTEGER,
  actualRestSeconds: DataTypes.INTEGER,
  completedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ unique: true, fields: ["performed_exercise_id", "set_number"] }] });

// Mediciones de peso corporal fechadas. Permite consultar evolución sin perder los valores anteriores.
export const BodyWeightHistory = sequelize.define("BodyWeightHistory", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  weightKg: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  recordedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ fields: ["user_id", "recorded_at"] }] });

// Marcas de fuerza almacenadas, con peso, repeticiones y estimación de 1RM. El ranking consulta series completadas directamente, no esta tabla.
export const StrengthRecord = sequelize.define("StrengthRecord", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  maxWeightKg: { type: DataTypes.DECIMAL(7, 2), allowNull: false },
  repetitions: { type: DataTypes.INTEGER, allowNull: false },
  estimatedOneRm: { type: DataTypes.DECIMAL(7, 2), allowNull: false },
  achievedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { timestamps:true, createdAt:false, updatedAt:false, paranoid:true, indexes: [{ fields: ["user_id", "exercise_id", "estimated_one_rm"] }] });

User.hasMany(UserRestDay, {foreignKey:{name:'userId',allowNull:false},as:'restDayEntries',onDelete:'CASCADE'});
UserRestDay.belongsTo(User,{foreignKey:'userId',as:'user'});
// Sin propietario = oficial; con propietario = privado. RESTRICT evita publicar un privado al borrar su dueño.
User.hasMany(Exercise,{foreignKey:{name:'createdByUserId',allowNull:true},as:'customExercises',onDelete:'RESTRICT'});
Exercise.belongsTo(User,{foreignKey:'createdByUserId',as:'creator'});

// Recibos de sincronización: una operación del dispositivo se aplica una sola vez.
export const SessionMutation = sequelize.define('SessionMutation', {
  id:{type:DataTypes.UUID,primaryKey:true},
  kind:{type:DataTypes.STRING(20),allowNull:false},
  requestHash:{type:DataTypes.STRING(64),allowNull:false},
  response:{type:DataTypes.JSONB,allowNull:false},
  statusCode:{type:DataTypes.INTEGER,allowNull:false},
  createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
}, {timestamps:false,indexes:[{fields:['session_id']}]});
TrainingSession.hasMany(SessionMutation,{foreignKey:{name:'sessionId',allowNull:false},as:'syncReceipts',onDelete:'CASCADE'});
SessionMutation.belongsTo(TrainingSession,{foreignKey:'sessionId',as:'session'});

// Relaciones: hasMany significa uno a muchos; belongsTo indica a quién pertenece una fila.
// foreignKey define la columna de enlace; as determina el nombre utilizado en include.
// CASCADE se aplica solo a una purga física administrativa; el borrado lógico conserva los hijos.
User.hasMany(Routine, { foreignKey: { name: "userId", allowNull: false }, as: "routines", onDelete: "CASCADE" });
Routine.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasOne(WelcomePlan,{foreignKey:{name:'userId',allowNull:false},as:'welcomePlan',onDelete:'CASCADE'});
WelcomePlan.belongsTo(User,{foreignKey:'userId',as:'user'});
WelcomePlan.belongsTo(Routine,{foreignKey:{name:'routineId',allowNull:true},as:'routine',onDelete:'SET NULL'});
User.hasMany(TrainingSession, { foreignKey: { name: "userId", allowNull: false }, as: "sessions", onDelete: "CASCADE" });
TrainingSession.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(BodyWeightHistory, { foreignKey: { name: "userId", allowNull: false }, as: "weights", onDelete: "CASCADE" });
BodyWeightHistory.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(StrengthRecord, { foreignKey: { name: "userId", allowNull: false }, as: "records", onDelete: "CASCADE" });
StrengthRecord.belongsTo(User, { foreignKey: "userId", as: "user" });

Routine.hasMany(RoutineDay, { foreignKey: { name: "routineId", allowNull: false }, as: "days", onDelete: "CASCADE" });
RoutineDay.belongsTo(Routine, { foreignKey: "routineId", as: "routine" });
RoutineDay.hasMany(RoutineSchedule, { foreignKey: { name: 'routineDayId', allowNull: false }, as: 'schedules', onDelete: 'CASCADE' });
RoutineSchedule.belongsTo(RoutineDay, { foreignKey: 'routineDayId', as: 'routineDay' });
RoutineDay.hasMany(RoutineExercise, { foreignKey: { name: "routineDayId", allowNull: false }, as: "exercises", onDelete: "CASCADE" });
RoutineExercise.belongsTo(RoutineDay, { foreignKey: "routineDayId", as: "routineDay" });
Exercise.hasMany(RoutineExercise, { foreignKey: { name: "exerciseId", allowNull: false }, as: "routineItems" });
RoutineExercise.belongsTo(Exercise, { foreignKey: "exerciseId", as: "exercise" });

RoutineDay.hasMany(TrainingSession, { foreignKey: { name: "routineDayId", allowNull: true }, as: "sessions" });
TrainingSession.belongsTo(RoutineDay, { foreignKey: "routineDayId", as: "routineDay" });
TrainingSession.hasMany(PerformedExercise, { foreignKey: { name: "sessionId", allowNull: false }, as: "exercises", onDelete: "CASCADE" });
PerformedExercise.belongsTo(TrainingSession, { foreignKey: "sessionId", as: "session" });
Exercise.hasMany(PerformedExercise, { foreignKey: { name: "exerciseId", allowNull: false }, as: "performed" });
PerformedExercise.belongsTo(Exercise, { foreignKey: "exerciseId", as: "exercise" });
PerformedExercise.hasMany(PerformedSet, { foreignKey: { name: "performedExerciseId", allowNull: false }, as: "sets", onDelete: "CASCADE" });
PerformedSet.belongsTo(PerformedExercise, { foreignKey: "performedExerciseId", as: "performedExercise" });
Exercise.hasMany(StrengthRecord, { foreignKey: { name: "exerciseId", allowNull: false }, as: "records" });
StrengthRecord.belongsTo(Exercise, { foreignKey: "exerciseId", as: "exercise" });

// Agrupa los modelos para utilidades que necesitan recorrerlos o reutilizarlos juntos.
export const models = {
  LegalAcceptance,
  WelcomePlan, SessionMutation, User, UserRestDay, Exercise, Routine, RoutineDay, RoutineExercise, RoutineSchedule, TrainingSession,
  PerformedExercise, PerformedSet, BodyWeightHistory, StrengthRecord,
};
applySpanishModelNames(models);
