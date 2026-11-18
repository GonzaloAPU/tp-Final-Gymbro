/** Los JWT de una cuenta archivada dejan de habilitar acceso aunque no hayan vencido. */
import {User} from '../models/index.js';
import {credentialsMatch} from '../services/credentials.js';
export const accountAccess={isActive:async(id,claims)=>{
  if(typeof id!=='string')return false;
  const user=await User.findByPk(id,{attributes:['id','passwordHash','passwordChangedAt']});
  // Además de existir y no estar archivada, la cuenta debe conservar las
  // credenciales con las que se emitió esa sesión. Así se revocan JWT tras un reset.
  return Boolean(user&&credentialsMatch(user,claims));
}};
export async function requireActiveAccount(req,res,next){
  try{
    if(!await accountAccess.isActive(req.auth.sub,req.auth))return res.status(401).json({message:'La cuenta o la sesión ya no está disponible. Iniciá sesión nuevamente.'});
    next();
  }catch(error){next(error);}
}
