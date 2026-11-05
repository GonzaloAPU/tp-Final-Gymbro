/** Cálculos puros: la base usa domingo=0 y los plugins nativos domingo=1. */
import type {Routine,ScheduleSlot} from './routine.service';
export interface PlannedReminder {key:string;name:string;weekday:number;hour:number;minute:number;start:string;}
export function reminderTime(slot:ScheduleSlot) {
  const [hour,minute]=slot.start.split(':').map(Number);
  const total=(slot.weekday*1440+hour*60+minute-15+10080)%10080;
  return {weekday:Math.floor(total/1440),hour:Math.floor(total%1440/60),minute:total%60};
}
export function planReminders(routines:Routine[]):PlannedReminder[] {
  return routines.flatMap(routine=>routine.days.flatMap(day=>(day.schedule||[]).map(slot=>({
    key:`${day.id}:${slot.weekday}:${slot.start}:${slot.end}`,name:day.name,start:slot.start,...reminderTime(slot),
  }))));
}
export function nextReminder(reminder:Pick<PlannedReminder,'weekday'|'hour'|'minute'>,now=new Date()):Date {
  const next=new Date(now);
  next.setDate(next.getDate()+(reminder.weekday-now.getDay()+7)%7);
  next.setHours(reminder.hour,reminder.minute,0,0);
  if(next.getTime()<=now.getTime())next.setDate(next.getDate()+7);
  return next;
}
/** IDs positivos de 32 bits, reservados para Gymbro y estables entre reinicios. */
export function alarmId(key:string):number {
  let hash=2166136261;
  for(const character of key)hash=Math.imul(hash^character.charCodeAt(0),16777619);
  return 10000+((hash>>>0)%1900000000);
}
