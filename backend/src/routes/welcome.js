/** Bienvenida: prepara una propuesta y la acepta atómicamente, con reintentos seguros. */
import {Router} from 'express';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {sequelize} from '../db.js';
import {requireAuth} from '../middleware/auth.js';
import {User,UserRestDay,BodyWeightHistory,Exercise,Routine,RoutineDay,RoutineExercise,RoutineSchedule,WelcomePlan} from '../models/index.js';
import {welcomeSchema,makeLocalPlan,goalLabels,planningError,estimateMinutes,validateAIPlan} from '../services/welcome-planner.js';
import {geminiAvailable,generateGeminiPlan} from '../services/gemini-plan.js';
import {validateSchedule} from '../schedule.js';
import {aiQuota,consumeAiGeneration} from '../services/ai-quota.js';
export const welcomeRouter=Router();welcomeRouter.use(requireAuth);
const active=new Set(),aiRequests=new Map();
function publicProposal(row,catalog){
  const result=structuredClone(row.proposal);result.sessions=result.sessions.map(session=>({...session,estimatedMinutes:estimateMinutes(session.exercises),exercises:session.exercises.map(e=>({...e,name:catalog.find(item=>item.id===e.exerciseId)?.name||'Ejercicio'}))}));
  return {id:row.id,...result};
}
welcomeRouter.get('/status',async(req,res)=>{
  const [row,count,user]=await Promise.all([WelcomePlan.findOne({where:{userId:req.auth.sub}}),Routine.count({where:{userId:req.auth.sub}}),User.findByPk(req.auth.sub)]);
  res.json({needed:count===0&&!row?.acceptedAt&&!row?.skippedAt,aiAvailable:geminiAvailable(),aiQuota:aiQuota(user),hasRoutines:count>0});
});
welcomeRouter.get('/draft',async(req,res)=>{
  const userId=req.auth.sub;
  const [row,user,latest]=await Promise.all([
    WelcomePlan.findOne({where:{userId}}),User.findByPk(userId),
    BodyWeightHistory.findOne({where:{userId},order:[['recordedAt','DESC']]}),
  ]);
  if(!user)throw planningError('Usuario no encontrado',404);
  const profile={heightCm:user.heightCm,goal:user.goal,currentKg:latest?Number(latest.weightKg):null};
  if(!row||!welcomeSchema.safeParse(row.preferences).success)return res.json({preferences:null,proposal:null,profile});
  // Conserva la ficha del último plan sin volver a ofrecer una propuesta ya usada.
  // No requiere otra tabla: estas preferencias ya pertenecen a la cuenta autenticada.
  if(row.acceptedAt||row.skippedAt)return res.json({preferences:{...row.preferences,aiConsent:false},proposal:null,profile});
  const catalog=await Exercise.findAll({where:{createdByUserId:null}});
  res.json({preferences:row.preferences,proposal:publicProposal(row,catalog),profile});
});
welcomeRouter.post('/preview',async(req,res)=>{
  const input=welcomeSchema.parse(req.body),userId=req.auth.sub;
  if(active.has(userId))throw planningError('Ya estamos preparando tu propuesta.',409);
  if(input.mode==='GEMINI'){
    if(!geminiAvailable())throw planningError('La IA todavía no está configurada. Elegí el plan local.',503);
    if(!input.aiConsent)throw planningError('Confirmá el envío de parámetros a Gemini.',400);
    const now=Date.now(),recent=(aiRequests.get(userId)||[]).filter(time=>now-time<600000);
    if(recent.length>=3)throw planningError('Esperá unos minutos antes de volver a generar con IA.',429);
    if(aiRequests.size>1000)for(const [key,times]of aiRequests)if(times.every(time=>now-time>=600000))aiRequests.delete(key);
    aiRequests.set(userId,[...recent,now]);
  }
  active.add(userId);
  try {
    // Una propuesta reemplaza la semana completa: no hereda horarios ni descansos
    // anteriores. Hasta aceptarla, el plan vigente permanece intacto.
    let catalog,remainingQuota;
    const row=await sequelize.transaction(async transaction=>{
      const user=await User.findByPk(userId,{transaction,lock:transaction.LOCK.UPDATE});
      if(!user)throw planningError('Usuario no encontrado',404);
      catalog=await Exercise.findAll({where:{createdByUserId:null},transaction});
      const local=makeLocalPlan(input,catalog);
      const proposal=input.mode==='GEMINI'
        ?await consumeAiGeneration(user,transaction,()=>generateGeminiPlan(input,catalog,local))
        :local;
      if(input.mode==='GEMINI')remainingQuota=aiQuota(user);
      const existing=await WelcomePlan.findOne({where:{userId},transaction});
      // Cada propuesta usa ID nuevo: una pestaña vieja no puede aceptar otra propuesta.
      const values={id:randomUUID(),userId,preferences:input,proposal,source:proposal.source,acceptedAt:null,skippedAt:null,routineId:null};
      if(existing){await existing.destroy({transaction});}
      return WelcomePlan.create(values,{transaction});
    });
    res.json({...publicProposal(row,catalog),...(remainingQuota?{aiQuota:remainingQuota}:{})});
  }finally{active.delete(userId);}
});
welcomeRouter.post('/accept',async(req,res)=>{
  const {proposalId}=z.object({proposalId:z.string().uuid()}).parse(req.body);
  const result=await sequelize.transaction(async transaction=>{
    const userId=req.auth.sub,user=await User.findByPk(userId,{transaction,lock:transaction.LOCK.UPDATE});
    if(!user)throw planningError('Usuario no encontrado',404);
    const row=await WelcomePlan.findOne({where:{id:proposalId,userId},transaction,lock:transaction.LOCK.UPDATE});
    if(!row)throw planningError('La propuesta cambió o no pertenece a tu cuenta. Generá una nueva.',409);
    if(row.acceptedAt)return {routineId:row.routineId};
    if(row.skippedAt)throw planningError('Esta propuesta fue descartada.',409);
    const input=welcomeSchema.parse(row.preferences),proposal=row.proposal;
    // Una transacción usa una sola conexión: las consultas se ejecutan en orden.
    const catalog=await Exercise.findAll({where:{createdByUserId:null},transaction});
    const slots=proposal.sessions.map(session=>session.slot);
    validateSchedule(slots,[]);
    // Revalida los IDs y límites aun si la propuesta persistida vino de un proveedor.
    validateAIPlan({sessions:proposal.sessions.map(({exercises})=>({exercises}))},input,catalog,proposal);
    await Routine.update({active:false},{where:{userId},transaction});
    // Borrado lógico del plan anterior. Conserva IDs y registros de entrenamientos;
    // las consultas de biblioteca/calendario excluyen estas rutinas archivadas.
    await Routine.destroy({where:{userId},transaction});
    const routine=await Routine.create({userId,name:proposal.name,goal:goalLabels[input.goal],active:true},{transaction});
    for(const [index,session]of proposal.sessions.entries()){
      const day=await RoutineDay.create({routineId:routine.id,name:session.name,dayNumber:index+1},{transaction});
      await RoutineExercise.bulkCreate(session.exercises.map((exercise,order)=>({...exercise,order:order+1,routineDayId:day.id})),{transaction});
      await RoutineSchedule.create({...session.slot,routineDayId:day.id},{transaction});
    }
    await user.update({heightCm:input.heightCm,goal:goalLabels[input.goal]},{transaction});
    const latest=await BodyWeightHistory.findOne({where:{userId},order:[['recordedAt','DESC']],transaction});
    // Una propuesta vieja no puede reemplazar el último pesaje registrado en Progreso.
    // Solo crea el peso inicial si la cuenta todavía no tiene historial.
    if(!latest)await BodyWeightHistory.create({userId,weightKg:input.weightKg},{transaction});
    const rests=[0,1,2,3,4,5,6].filter(day=>!slots.some(slot=>slot.weekday===day));
    await UserRestDay.destroy({where:{userId},transaction});
    await UserRestDay.bulkCreate(rests.map(weekday=>({userId,weekday})),{transaction});
    await row.update({acceptedAt:new Date(),routineId:routine.id},{transaction});
    return {routineId:routine.id};
  });
  res.json(result);
});
welcomeRouter.post('/skip',async(req,res)=>{
  await sequelize.transaction(async transaction=>{
    const userId=req.auth.sub,user=await User.findByPk(userId,{transaction,lock:transaction.LOCK.UPDATE});
    if(!user)throw planningError('Usuario no encontrado',404);
    const row=await WelcomePlan.findOne({where:{userId},transaction});
    if(row)await row.update({skippedAt:new Date()},{transaction});
    else await WelcomePlan.create({userId,preferences:{},proposal:{},source:'SKIPPED',skippedAt:new Date()},{transaction});
  });
  res.json({skipped:true});
});
