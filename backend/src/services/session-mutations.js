/** Serializa escrituras por sesión y guarda la respuesta antes de confirmar al dispositivo. */
import {createHash} from 'node:crypto';
import {sequelize} from '../db.js';
import {TrainingSession,SessionMutation} from '../models/index.js';

export async function ownedSession(id,userId,transaction,include) {
  const session=await TrainingSession.findOne({where:{id,userId},transaction,include,
    // No se bloquean los JOIN externos; el bloqueo principal ya protege la sesión.
    ...(!include&&transaction?{lock:transaction.LOCK.UPDATE}:{})});
  if(!session) throw Object.assign(new Error('Sesión no encontrada'),{status:404});
  return session;
}

export async function mutateSession({sessionId,userId,operationId,kind,payload,start=false},execute) {
  return sequelize.transaction(async transaction=>{
    if(start) await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))',{replacements:{key:`session:${sessionId}`},transaction});
    const session=start?null:await ownedSession(sessionId,userId,transaction);
    const requestHash=createHash('sha256').update(JSON.stringify({sessionId,userId,kind,payload})).digest('hex');
    if(operationId) {
      const previous=await SessionMutation.findByPk(operationId,{transaction});
      if(previous) {
        if(previous.sessionId!==sessionId||previous.kind!==kind||previous.requestHash!==requestHash) throw Object.assign(new Error('La operación ya se utilizó con otros datos'),{status:409});
        if(start) await ownedSession(sessionId,userId,transaction);
        return {status:previous.statusCode,data:previous.response};
      }
    }
    const result=await execute(session,transaction);
    if(operationId) await SessionMutation.create({id:operationId,sessionId,kind,requestHash,
      statusCode:result.status,response:JSON.parse(JSON.stringify(result.data))},{transaction});
    return result;
  });
}

export function assertSessionOpen(session) {
  if(!['ACTIVE','PAUSED'].includes(session.status)) throw Object.assign(new Error('La sesión ya está finalizada'),{status:409});
}
