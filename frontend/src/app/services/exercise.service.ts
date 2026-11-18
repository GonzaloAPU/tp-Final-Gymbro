/**
 * Cliente HTTP del catálogo. Construye parámetros de filtro y envía los datos para agregar ejercicios. Los Observables HTTP se ejecutan cuando alguien se suscribe.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Exercise } from './routine.service';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly http = inject(HttpClient);
  /** Envía los datos de creación al endpoint correspondiente y devuelve su Observable HTTP. */
  create(data: { name: string; muscleGroup: string; equipment: string; movementPattern: string | null; trainingType: Exercise['trainingType'] }) {
    return this.http.post<Exercise>('/api/exercises', data);
  }
  /** Construye filtros opcionales de tipo y grupo muscular y solicita el catálogo a la API. */
  getCatalog(filters?: { trainingType?: string; muscleGroup?: string }) {
    let params = new HttpParams();
    if (filters?.trainingType) params = params.set('trainingType', filters.trainingType);
    if (filters?.muscleGroup) params = params.set('muscleGroup', filters.muscleGroup);
    return this.http.get<Exercise[]>('/api/exercises', { params });
  }
}
