/**
 * Marcador de ruta sin interfaz propia. AppComponent detecta su activación y muestra el entrenamiento persistente que vive fuera del router-outlet.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, ChangeDetectionStrategy } from '@angular/core';

// La vista vive en AppComponent para que el router no destruya sus relojes al navegar.
@Component({ selector: 'app-workout-route', standalone: true, changeDetection: ChangeDetectionStrategy.Eager,
 template: '' })
export class WorkoutRouteComponent {}
