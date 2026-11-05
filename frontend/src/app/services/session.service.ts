/**
 * Cliente de entrenamientos: confirma después de encolar localmente y sincroniza por HTTP con identificadores estables. El cronómetro visual se maneja en WorkoutComponent.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject, Injectable } from '@angular/core';
import { WorkoutStorageService } from './workout-storage.service';

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface TrainingSession {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  calories: number | null;
  totalVolumeKg: number | null;
}

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface PerformedExercise { id: string; sessionId: string; exerciseId: string; order: number; }

@Injectable({ providedIn: 'root' })
export class SessionService {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly storage = inject(WorkoutStorageService);
  /** Crea una sesión de entrenamiento vinculada opcionalmente a un bloque de rutina. */
  start(routineDayId?: string) {
    const id=crypto.randomUUID(),operationId=crypto.randomUUID(),startedAt=new Date().toISOString();
    return this.storage.enqueue<TrainingSession>({id:operationId,sessionId:id,kind:'START',body:{clientSessionId:id,routineDayId,startedAt}},
      {id,startedAt,finishedAt:null,durationSeconds:null,status:'ACTIVE',calories:null,totalVolumeKg:null});
  }
  /** Registra un ejercicio dentro de una sesión existente y devuelve su identificador para guardar las series. */
  addExercise(sessionId: string, exerciseId: string, order: number) {
    const id=crypto.randomUUID();
    return this.storage.enqueue<PerformedExercise>({id:crypto.randomUUID(),sessionId,kind:'EXERCISE',body:{clientExerciseId:id,exerciseId,order}}, {id,sessionId,exerciseId,order});
  }
  /** Crea una serie realizada con sus cargas, repeticiones y tiempos. */
  addSet(sessionId: string, performedExerciseId: string, data: { setNumber: number; weightKg: number; repetitions: number; durationSeconds?: number; actualRestSeconds?: number }) {
    return this.storage.enqueue({id:crypto.randomUUID(),sessionId,kind:'SET',performedId:performedExerciseId,recordKey:`${performedExerciseId}:${data.setNumber}`,body:{...data,completedAt:new Date().toISOString()}},data);
  }
  /** Encola el cierre detrás de las series pendientes; el servidor calcula totales una sola vez. */
  finish(sessionId: string, durationSeconds?: number) { return this.storage.enqueue({id:crypto.randomUUID(),sessionId,kind:'FINISH',body:{durationSeconds}},{}); }
  /** Actualiza una serie existente por su número cuando el usuario vuelve a realizarla. */
  replaceSet(sessionId: string, performedExerciseId: string, data: { setNumber: number; weightKg: number; repetitions: number; durationSeconds?: number; actualRestSeconds?: number }) {
    return this.storage.enqueue({id:crypto.randomUUID(),sessionId,kind:'REPLACE',performedId:performedExerciseId,recordKey:`${performedExerciseId}:${data.setNumber}`,body:{...data,completedAt:new Date().toISOString()}},data);
  }
}
