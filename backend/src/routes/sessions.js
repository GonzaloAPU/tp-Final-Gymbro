/** Entrenamientos con confirmación transaccional, reintentos idempotentes y cierre inmutable. */
import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireAuth} from '../middleware/auth.js';
import {PerformedExercise,PerformedSet,TrainingSession,RoutineDay,Routine} from '../models/index.js';
import {assertExercisesAccessible} from '../services/exercise-access.js';
import {mutateSession,ownedSession,assertSessionOpen} from '../services/session-mutations.js';
export const sessionsRouter=Router();
sessionsRouter.use(requireAuth);
const operationId=z.string().uuid().optional();

sessionsRouter.post('/',async(req,res)=>{
  const input=z.object({routineDayId:z.string().uuid().optional(),clientSessionId:z.string().uuid().optional(),startedAt:z.string().datetime().optional(),operationId}).parse(req.body);
  const sessionId=input.clientSessionId||input.operationId||randomUUID();
  const result=await mutateSession({sessionId,userId:req.auth.sub,operationId:input.operationId,kind:'START',payload:input,start:true},async(_,transaction)=>{
    const existing=await TrainingSession.findByPk(sessionId,{transaction,lock:transaction.LOCK.UPDATE,paranoid:false});
    if(existing) {
      if(existing.userId!==req.auth.sub) throw Object.assign(new Error('Sesión no encontrada'),{status:404});
      if(existing.deletedAt)throw Object.assign(new Error('La sesión está archivada y no se puede reiniciar con ese identificador'),{status:409});
      if((existing.routineDayId||null)!==(input.routineDayId||null)) throw Object.assign(new Error('Identificador de sesión ya utilizado'),{status:409});
      return {status:200,data:existing};
    }
    if(input.routineDayId&&!await RoutineDay.findOne({where:{id:input.routineDayId},include:[{model:Routine,as:'routine',required:true,where:{userId:req.auth.sub}}],transaction})) throw Object.assign(new Error('Rutina no encontrada'),{status:404});
    const startedAt=input.startedAt?new Date(input.startedAt):new Date();
    if(startedAt.getTime()>Date.now()+60000) throw Object.assign(new Error('La hora del dispositivo está adelantada. Revisá su configuración.'),{status:400});
    const session=await TrainingSession.create({id:sessionId,userId:req.auth.sub,routineDayId:input.routineDayId,startedAt:new Date(Math.min(startedAt.getTime(),Date.now()))},{transaction});
    return {status:201,data:session};
  });
  res.status(result.status).json(result.data);
});

sessionsRouter.post('/:sessionId/exercises',async(req,res)=>{
  const input=z.object({exerciseId:z.string().uuid(),order:z.number().int().positive(),clientExerciseId:z.string().uuid().optional(),operationId}).parse(req.body);
  const result=await mutateSession({sessionId:req.params.sessionId,userId:req.auth.sub,operationId:input.operationId,kind:'EXERCISE',payload:input},async(session,transaction)=>{
    assertSessionOpen(session);
    await assertExercisesAccessible([input.exerciseId],req.auth.sub,transaction,session.routineDayId);
    const existing=await PerformedExercise.findOne({where:{sessionId:session.id,order:input.order},transaction});
    if(existing) {
      if(existing.exerciseId!==input.exerciseId||(input.clientExerciseId&&existing.id!==input.clientExerciseId)) throw Object.assign(new Error('Ese orden ya pertenece a otro ejercicio'),{status:409});
      return {status:200,data:existing};
    }
    const performed=await PerformedExercise.create({id:input.clientExerciseId||randomUUID(),sessionId:session.id,exerciseId:input.exerciseId,order:input.order},{transaction});
    return {status:201,data:performed};
  });
  res.status(result.status).json(result.data);
});

const setSchema=z.object({setNumber:z.number().int().positive(),weightKg:z.number().nonnegative(),repetitions:z.number().int().positive(),durationSeconds:z.number().int().nonnegative().optional(),actualRestSeconds:z.number().int().nonnegative().optional(),completedAt:z.string().datetime().optional(),operationId});
sessionsRouter.post('/:sessionId/exercises/:performedExerciseId/sets',saveSet);
sessionsRouter.put('/:sessionId/exercises/:performedExerciseId/sets/:setNumber',saveSet);
async function saveSet(req,res) {
  const input=setSchema.parse(req.body);
  if(req.method==='PUT'&&String(input.setNumber)!==req.params.setNumber) throw Object.assign(new Error('Número de serie inválido'),{status:400});
  const result=await mutateSession({sessionId:req.params.sessionId,userId:req.auth.sub,operationId:input.operationId,kind:req.method==='PUT'?'REPLACE':'SET',payload:{performedExerciseId:req.params.performedExerciseId,...input}},async(session,transaction)=>{
    assertSessionOpen(session);
    const performed=await PerformedExercise.findOne({where:{id:req.params.performedExerciseId,sessionId:session.id},transaction});
    if(!performed) throw Object.assign(new Error('Ejercicio realizado no encontrado'),{status:404});
    const {operationId:_,completedAt,...values}=input;
    const data={...values,completedAt:completedAt?new Date(completedAt):new Date()};
    if(data.completedAt.getTime()>Date.now()+60000) throw Object.assign(new Error('Fecha de serie futura'),{status:400});
    const existing=await PerformedSet.findOne({where:{performedExerciseId:performed.id,setNumber:input.setNumber},transaction});
    if(req.method==='PUT') {
      if(!existing) throw Object.assign(new Error('Serie no encontrada'),{status:404});
      await existing.update(data,{transaction});
      return {status:200,data:existing};
    }
    if(existing) {
      if(!['weightKg','repetitions','durationSeconds','actualRestSeconds'].every(key=>Number(existing[key]??0)===Number(values[key]??0))) throw Object.assign(new Error('La serie ya existe con otros datos. Usá la opción de repetirla.'),{status:409});
      return {status:200,data:existing};
    }
    return {status:201,data:await PerformedSet.create({performedExerciseId:performed.id,...data},{transaction})};
  });
  res.status(result.status).json(result.data);
}

sessionsRouter.post('/:sessionId/finish',async(req,res)=>{
  const input=z.object({durationSeconds:z.number().int().nonnegative().optional(),operationId}).parse(req.body);
  const result=await mutateSession({sessionId:req.params.sessionId,userId:req.auth.sub,operationId:input.operationId,kind:'FINISH',payload:input},async(session,transaction)=>{
    // Un doble toque, reintento o segunda solicitud devuelve exactamente el cierre original.
    if(session.status==='COMPLETED') return {status:200,data:session};
    assertSessionOpen(session);
    const details=await ownedSession(session.id,req.auth.sub,transaction,[{model:PerformedExercise,as:'exercises',include:[{model:PerformedSet,as:'sets'}]}]);
    const finishedAt=new Date();
    const wallSeconds=Math.max(0,Math.round((finishedAt-session.startedAt)/1000));
    const durationSeconds=Math.min(input.durationSeconds??wallSeconds,wallSeconds);
    const totalVolumeKg=details.exercises.reduce((sum,exercise)=>sum+exercise.sets.reduce((value,set)=>value+Number(set.weightKg)*set.repetitions,0),0);
    const calories=Math.round(durationSeconds/60*6.5*10)/10;
    await session.update({finishedAt,durationSeconds,totalVolumeKg,calories,status:'COMPLETED'},{transaction});
    return {status:200,data:session};
  });
  res.status(result.status).json(result.data);
});
