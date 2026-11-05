/** Semana calendario argentina: lunes 00:00 a lunes 00:00 (UTC-3). */
export const AI_WEEKLY_LIMIT=3;
export function aiQuota(user,now=new Date()) {
  const local=new Date(now.getTime()-3*3600000);
  const day=(local.getUTCDay()+6)%7;
  const start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-day,3);
  const sameWeek=user?.aiWeekStart && new Date(user.aiWeekStart).getTime()===start;
  const used=sameWeek?Number(user.aiWeeklyUsed||0):0;
  return {limit:AI_WEEKLY_LIMIT,used,remaining:Math.max(0,AI_WEEKLY_LIMIT-used),weekStart:new Date(start).toISOString(),resetsAt:new Date(start+7*86400000).toISOString()};
}
export async function consumeAiGeneration(user,transaction,generate,now=new Date()) {
  // El llamador bloquea la fila de usuario ANTES de comprobar el cupo.
  // Distintas instancias de Render comparten ese bloqueo; un fallo revierte el consumo.
  const quota=aiQuota(user,now);
  if(!quota.remaining)throw Object.assign(new Error('Usaste tus 3 generaciones con IA de esta semana. El cupo se renueva el lunes. Podés seguir usando el plan local.'),{status:429});
  const result=await generate();
  await user.update({aiWeekStart:new Date(quota.weekStart),aiWeeklyUsed:quota.used+1},{transaction});
  return result;
}
