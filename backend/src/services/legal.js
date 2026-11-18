import {createHash} from 'node:crypto';
import {z} from 'zod';
import documents from '../../../shared/legal-documents.json' with {type:'json'};
import {LegalAcceptance,User} from '../models/index.js';
import {sequelize} from '../db.js';
export const legalDocuments=Object.freeze({...documents,hash:createHash('sha256').update(JSON.stringify(documents)).digest('hex')});
export const legalInput=z.object({version:z.literal(documents.version),termsAccepted:z.literal(true),privacyAcknowledged:z.literal(true),adultConfirmed:z.literal(true),sportsDataConsent:z.boolean()}).strict();
export const legalAccess={
  async status(userId){
    const row=await LegalAcceptance.findOne({where:{userId},order:[['acceptedAt','DESC'],['id','DESC']]});
    return {needsAcceptance:!row||row.version!==documents.version||row.documentHash!==legalDocuments.hash,sportsDataConsent:Boolean(row?.sportsDataConsent),version:documents.version};
  },
};
/** Recibo append-only, generado en el servidor, sin IP, token ni contraseña. */
export async function recordLegalAcceptance(userId,input,transaction){
  const validated=legalInput.parse(input);
  const previous=await LegalAcceptance.findOne({where:{userId},order:[['acceptedAt','DESC']],transaction});
  const acceptedAt=new Date(Math.max(Date.now(),previous?new Date(previous.acceptedAt).getTime()+1:0));
  return LegalAcceptance.create({userId,version:validated.version,documentHash:legalDocuments.hash,documents:documents,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:validated.sportsDataConsent,acceptedAt},{transaction});
}
export async function acceptLegal(userId,input){
  legalInput.parse(input);
  return sequelize.transaction(async transaction=>{
    const user=await User.findByPk(userId,{transaction,lock:transaction.LOCK.UPDATE});
    if(!user)throw Object.assign(Error('Cuenta no disponible'),{status:401});
    if(!input.sportsDataConsent)await user.update({leaderboardOptIn:false},{transaction});
    return recordLegalAcceptance(userId,input,transaction);
  });
}
export async function requireLegal(req,res,next){
  try{
    const status=await legalAccess.status(req.auth.sub);
    if(status.needsAcceptance)return res.status(428).json({code:'LEGAL_ACCEPTANCE_REQUIRED',message:'Leé y aceptá los términos y la política vigentes.',version:documents.version});
    const sportsWrite=req.method!=='GET'&&(
      /^\/(sessions|routines|exercises)(\/|$)/.test(req.path)||/^\/welcome\/(preview|accept)$/.test(req.path)||req.path==='/progress/weight'||
      (req.path==='/auth/me'&&(req.body?.leaderboardOptIn===true||['heightCm','currentKg','goal','discipline','restDays'].some(key=>req.body?.[key]!=null))));
    if(sportsWrite&&!status.sportsDataConsent)return res.status(428).json({code:'SPORTS_CONSENT_REQUIRED',message:'Autorizá el tratamiento de datos deportivos desde Privacidad para usar esta función.'});
    next();
  }catch(error){next(error);}
}
export async function withdrawSportsConsent(userId){
  return sequelize.transaction(async transaction=>{
    const user=await User.findByPk(userId,{transaction,lock:transaction.LOCK.UPDATE});
    if(!user)throw Object.assign(Error('Cuenta no disponible'),{status:401});
    const previous=await LegalAcceptance.findOne({where:{userId},order:[['acceptedAt','DESC']],transaction});
    if(!previous)throw Object.assign(Error('No hay consentimiento anterior para retirar.'),{status:409});
    await user.update({leaderboardOptIn:false},{transaction});
    // Retirar no implica aceptar una versión nueva: se copia únicamente el recibo anterior.
    const {id:_id,...receipt}=previous.toJSON();
    return LegalAcceptance.create({...receipt,sportsDataConsent:false,acceptedAt:new Date(Math.max(Date.now(),new Date(previous.acceptedAt).getTime()+1))},{transaction});
  });
}
