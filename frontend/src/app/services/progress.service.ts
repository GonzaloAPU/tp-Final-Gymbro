/**
 * Tipos de datos y cliente HTTP de resumen, ranking e historial de peso. Los componentes presentan los resultados; el backend consulta y calcula los datos.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TrainingSession } from './session.service';

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface WeightEntry { id: string; weightKg: number; recordedAt: string; }
// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface StrengthRecord { id: string; maxWeightKg: number; repetitions: number; estimatedOneRm: number; achievedAt: string; exercise: { name: string }; }
// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface ProgressSummary { sessions: TrainingSession[]; weights: WeightEntry[]; records: StrengthRecord[]; totalCalories: number; completedSessions: number; }
// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface LeaderboardUser { exerciseName?: string; userId: string; name: string; weightKg: number; repetitions: number; achievedAt: string; rank: number; isCurrentUser: boolean; }
// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
export interface ExerciseLeaderboard { key: string; name: string; users: LeaderboardUser[]; }

@Injectable({ providedIn: 'root' })
export class ProgressService {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly http = inject(HttpClient);
  /** Solicita sesiones recientes, pesos, récords y totales personales al backend. */
  getSummary() { return this.http.get<ProgressSummary>('/api/progress/summary'); }
  /** Solicita los rankings públicos para usuarios autenticados, agrupados por ejercicio. */
  getLeaderboard() { return this.http.get<{exercises: ExerciseLeaderboard[]}>('/api/progress/leaderboard'); }
  /** Registra una medición de peso corporal; la API también actualiza el peso actual del perfil. */
  addWeight(weightKg: number, recordedAt?: string) { return this.http.post<WeightEntry>('/api/progress/weight', { weightKg, recordedAt }); }
}
