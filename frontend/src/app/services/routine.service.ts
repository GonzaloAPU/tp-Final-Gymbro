/**
 * Contratos TypeScript y llamadas HTTP de rutinas, favoritos y horarios. Las interfaces describen datos esperados; no crean tablas ni validan respuestas en ejecución.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { AlarmService } from './alarm.service';
import { HttpClient } from '@angular/common/http';

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface Exercise {
  createdByUserId?: string | null;
  movementPattern?: string | null;
  description?: string | null;
  videoUrl?: string | null;
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  trainingType: 'POWER' | 'AEROBIC' | 'ANAEROBIC';
}

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface RoutineExercise {
  id: string;
  order: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  targetDurationMinutes: number | null;
  targetDistanceKm: number | null;
  intensity: 'BAJA' | 'MEDIA' | 'ALTA' | null;
  exercise: Exercise;
}

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface ScheduleSlot { weekday: number; start: string; end: string; }
// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface RoutineDay {
  favorite: boolean;
  schedule: ScheduleSlot[];
  id: string;
  name: string;
  dayNumber: number;
  exercises: RoutineExercise[];
}

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface Routine {
  createdAt: string;
  id: string;
  name: string;
  goal: string;
  active: boolean;
  days: RoutineDay[];
}

@Injectable({ providedIn: 'root' })
export class RoutineService {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly http = inject(HttpClient);
  private readonly alarms = inject(AlarmService);
  /** Solicita todas las rutinas propias, incluyendo ejercicios y asignaciones semanales. */
  getAll() { return this.http.get<Routine[]>('/api/routines').pipe(tap(routines=>this.alarms.updatePlan(routines))); }
  /** Actualiza el favorito de un bloque de rutina en el servidor. */
  setFavorite(routineId: string, dayId: string, favorite: boolean) {
    return this.http.patch<{favorite: boolean}>(`/api/routines/${routineId}/days/${dayId}/favorite`, { favorite });
  }
  /** Reemplaza todos los horarios del bloque con la lista enviada; [] elimina sus asignaciones. */
  assignSchedule(routineId: string, dayId: string, schedule: ScheduleSlot[]) {
    return this.http.put<{schedule: ScheduleSlot[]}>(`/api/routines/${routineId}/days/${dayId}/schedule`, { schedule }).pipe(tap(result=>this.alarms.updateSchedule(dayId,result.schedule)));
  }
  /** Envía los datos de creación al endpoint correspondiente y devuelve su Observable HTTP. */
  create(data: {
    name: string;
    goal: string;
    days: Array<{
      name: string;
      dayNumber: number;
      exercises: Array<{
        exerciseId: string; order: number; targetSets: number; minReps: number; maxReps: number;
        restSeconds: number; targetDurationMinutes: number | null; targetDistanceKm: number | null;
        intensity: 'BAJA' | 'MEDIA' | 'ALTA' | null;
      }>;
    }>;
  }) { return this.http.post<Routine>('/api/routines', data); }
}
