/** Contrato de bienvenida. No contiene claves ni llama directamente al proveedor de IA. */
import {inject,Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {timeout} from 'rxjs';
export interface AiQuota {limit:number;used:number;remaining:number;resetsAt:string;}
export interface WelcomeInput {
  age:number;heightCm:number;weightKg:number;goal:'GENERAL'|'STRENGTH'|'MUSCLE';experience:'BEGINNER'|'INTERMEDIATE';
  place:'GYM'|'HOME'|'PARK';equipment:string[];sessions:number;minutes:number;
  availability:Array<{weekday:number;start:string;end:string}>;hasRestrictions:boolean;mode:'LOCAL'|'GEMINI';aiConsent:boolean;
}
export interface WelcomeProposal {
  aiQuota?:AiQuota;id:string;name:string;source:'LOCAL'|'GEMINI';restDays:number[];
  sessions:Array<{name:string;slot:{weekday:number;start:string;end:string};estimatedMinutes:number;exercises:Array<{exerciseId:string;name:string;targetSets:number;minReps:number;maxReps:number;restSeconds:number}>}>;
}
@Injectable({providedIn:'root'})
export class WelcomeService {
  private readonly http=inject(HttpClient);
  status(){return this.http.get<{needed:boolean;aiAvailable:boolean;hasRoutines:boolean;aiQuota?:AiQuota}>('/api/welcome/status');}
  draft(){return this.http.get<{preferences:WelcomeInput|null;proposal:WelcomeProposal|null;profile?:{heightCm?:number|null;currentKg?:number|null;goal?:string|null}}|null>('/api/welcome/draft');}
  preview(input:WelcomeInput){return this.http.post<WelcomeProposal>('/api/welcome/preview',input).pipe(timeout(45000));}
  accept(proposalId:string){return this.http.post<{routineId:string}>('/api/welcome/accept',{proposalId}).pipe(timeout(25000));}
  skip(){return this.http.post('/api/welcome/skip',{}).pipe(timeout(15000));}
}
