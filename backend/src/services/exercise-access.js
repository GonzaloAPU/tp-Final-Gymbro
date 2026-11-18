/** Normaliza nombres y centraliza el acceso: catálogo oficial más ejercicios propios. */
import { Op } from 'sequelize';
import { Exercise,RoutineExercise,RoutineDay,Routine } from '../models/index.js';
export {normalizeExerciseName} from './exercise-name.js';
export function exerciseScope(userId) { return {[Op.or]:[{createdByUserId:null},{createdByUserId:userId}]}; }
export async function assertExercisesAccessible(ids, userId, transaction, existingSessionDayId) {
  const unique = [...new Set(ids)];
  const found = await Exercise.count({where:{id:unique,...exerciseScope(userId)},transaction});
  if(found===unique.length)return;
  // Un ejercicio archivado conserva sus prescripciones existentes. Solo una sesión
  // ya autorizada puede usar esta excepción, nunca la creación de otra rutina.
  if(existingSessionDayId){
    const count=await RoutineExercise.count({where:{routineDayId:existingSessionDayId,exerciseId:unique},distinct:true,col:'exercise_id',paranoid:false,include:[
      {model:Exercise,as:'exercise',required:true,paranoid:false,where:{id:unique,...exerciseScope(userId)}},
      {model:RoutineDay,as:'routineDay',required:true,paranoid:false,include:[{model:Routine,as:'routine',required:true,paranoid:false,where:{userId}}]},
    ],transaction});
    if(count===unique.length)return;
  }
  throw Object.assign(new Error('Uno de los ejercicios no existe o es privado de otra cuenta.'),{status:404});
}
