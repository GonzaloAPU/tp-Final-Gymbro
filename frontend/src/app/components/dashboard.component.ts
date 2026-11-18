/**
 * Inicio semanal: calendario, biblioteca de rutinas y acceso al entrenamiento. Las signals reflejan respuestas del servidor; los cambios de calendario se validan aquí y nuevamente en la API.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, Input, OnChanges, SimpleChanges, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Routine, RoutineDay, RoutineService, ScheduleSlot } from '../services/routine.service';

@Component({
  selector:'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    <section class="page home">
      <h1 class="screen-title">Inicio</h1>
      @if(!loadingRoutines() && !routines().length){<a class="button primary" routerLink="/bienvenida">Preparar mi primer plan →</a>}
      @if(error()) {<p class="error" role="alert">{{error()}}</p>}
<section class="panel"><span class="kicker">TU SEMANA</span><header class="calendar-header"><h2>Calendario semanal</h2><a class="create-week-ai" routerLink="/bienvenida" [state]="{planMode: 'GEMINI'}">Crear semana con IA</a></header><p>Tocá un día naranja para ver sus rutinas. Tocá un día libre para marcarlo como descanso.</p><div class="calendar-legend"><span><i class="training-dot"></i>Rutinas</span><span><i class="rest-dot"></i>Descanso</span></div><div class="week">@for (day of weekdays; track day.value) {<button type="button" (click)="selectCalendarDay(day.value)" [class.selected]="isRestDay(day.value) && !hasTraining(day.value)" [class.training-day]="hasTraining(day.value)" [class.expanded-day]="selectedCalendarDay() === day.value" [attr.aria-pressed]="isRestDay(day.value) && !hasTraining(day.value)" [attr.aria-expanded]="hasTraining(day.value) ? selectedCalendarDay() === day.value : null" [attr.aria-label]="calendarDayLabel(day.value)" [disabled]="restSaving()">{{day.short}}@if (hasTraining(day.value)) {<small>{{scheduledFor(day.value).length}}</small>}</button>}</div>
@if (selectedCalendarDay() !== null && hasTraining(selectedCalendarDay()!)) {<div class="day-ribbon"><header><b>{{weekdayName(selectedCalendarDay()!)}}</b><button type="button" (click)="selectedCalendarDay.set(null)" aria-label="Cerrar rutinas del día">×</button></header>@for (entry of scheduledFor(selectedCalendarDay()!); track $index) {<div class="ribbon-workout"><div class="ribbon-item"><time>{{entry.start}} – {{entry.end}}</time><div><b>{{entry.dayName}}</b><small>{{entry.routineName}}</small></div></div><ul class="ribbon-exercises" aria-label="Ejercicios de la rutina">@for (item of entry.exercises; track item.id) {<li><div class="exercise-heading"><strong>{{item.exercise.name}}</strong>@if(item.exercise.description){<button type="button" class="description-button" (click)="toggleDescription(item.id)" [attr.aria-expanded]="descriptionOpen().has(item.id)" [attr.aria-label]="'Descripción de ' + item.exercise.name">Descripción</button>}@if(youtubeUrl(item.exercise.videoUrl);as video){<a class="youtube-link" [href]="video" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Ver ' + item.exercise.name + ' en YouTube'" title="Ver tutorial en YouTube"><svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><rect width="28" height="20" rx="6" fill="#ff0033"/><path d="M11 5.5 19 10l-8 4.5Z" fill="white"/></svg></a>}</div>@if(descriptionOpen().has(item.id) && item.exercise.description){<p class="exercise-description">{{item.exercise.description}}</p>}<small>@if (item.exercise.trainingType === 'POWER') {{{item.targetSets}} × {{item.minReps}}–{{item.maxReps}} reps} @else {{{item.targetSets}} bloques@if (item.targetDurationMinutes) { · {{item.targetDurationMinutes}} min}@if (item.targetDistanceKm) { · {{item.targetDistanceKm}} km}}</small></li>} @empty {<li class="no-exercises">Esta rutina todavía no tiene ejercicios.</li>}</ul></div>}@if (isRestDay(selectedCalendarDay()!)) {<p>Este día tenía descanso y una rutina asignada previamente.</p><button type="button" class="assign-day" (click)="toggleRestDay(selectedCalendarDay()!)" [disabled]="restSaving()">Quitar descanso de este día</button>} @else {<p>Para convertirlo en descanso, quitá antes las asignaciones de este día.</p>}</div>}
<p aria-live="polite">{{restSaving() ? 'Guardando…' : restLabel}}</p></section>
<section class="panel library-panel" aria-labelledby="library-title"><header><div><h2 id="library-title">Rutinas</h2></div><a class="create-routine-cta" routerLink="/rutinas/nueva"><span class="create-plus" aria-hidden="true">＋</span><span>Crear rutina</span><span aria-hidden="true">↗</span></a></header>
          @if (loadingRoutines()) {<p>Cargando tus rutinas…</p>}
          <div id="library-items">@for (entry of visibleLibrary(); track entry.day.id) {@let routine = entry.routine; @let day = entry.day; <article class="routine"><div class="routine-days"><div class="scheduled-day"><button type="button" class="favorite-star" [class.is-favorite]="day.favorite" (click)="toggleFavorite(routine.id, day)" [disabled]="favoriteSaving().has(day.id)" [attr.aria-pressed]="!!day.favorite" [attr.aria-label]="(day.favorite ? 'Quitar de favoritos: ' : 'Agregar a favoritos: ') + day.name">{{day.favorite ? '★' : '☆'}}</button><div class="day-description"><button type="button" class="routine-toggle" (click)="toggleRoutine(day.id)" [attr.aria-expanded]="expandedRoutines().has(day.id)" [attr.aria-controls]="'routine-details-' + day.id" [attr.aria-label]="(expandedRoutines().has(day.id) ? 'Ocultar ejercicios de ' : 'Ver ejercicios de ') + day.name"><span><span class="routine-name"><b>{{day.name}}</b>@if (isNewRoutine(routine)) {<span class="new-badge">NEW</span>}</span><small>{{day.exercises.length}} ejercicios</small></span><span class="expand-icon" aria-hidden="true">{{expandedRoutines().has(day.id) ? '⌃' : '⌄'}}</span></button></div><div class="assignment-buttons"><button type="button" class="assign-day" (click)="openSchedule(day)" [disabled]="scheduleSaving()" [attr.aria-expanded]="editingDay() === day.id">{{(day.schedule || []).length ? 'Asignar otro día' : 'Asignar día'}}</button>@if ((day.schedule || []).length) {<button type="button" class="unassign-day" (click)="clearAssignment(routine.id, day.id)" [disabled]="scheduleSaving()" [attr.aria-label]="'Eliminar asignación de ' + day.name">Eliminar asignación</button>}</div>
@if (expandedRoutines().has(day.id)) {<div class="routine-content" [id]="'routine-details-' + day.id"><ul class="routine-exercises" [attr.aria-label]="'Ejercicios de ' + day.name">@for (item of day.exercises; track item.id) {<li><div class="exercise-heading"><strong>{{item.exercise.name}}</strong>@if(item.exercise.description){<button type="button" class="description-button" (click)="toggleDescription(item.id)" [attr.aria-expanded]="descriptionOpen().has(item.id)" [attr.aria-label]="'Descripción de ' + item.exercise.name">Descripción</button>}@if(youtubeUrl(item.exercise.videoUrl);as video){<a class="youtube-link" [href]="video" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Ver ' + item.exercise.name + ' en YouTube'" title="Ver tutorial en YouTube"><svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><rect width="28" height="20" rx="6" fill="#ff0033"/><path d="M11 5.5 19 10l-8 4.5Z" fill="white"/></svg></a>}</div>@if(descriptionOpen().has(item.id) && item.exercise.description){<p class="exercise-description">{{item.exercise.description}}</p>}<small>@if (item.exercise.trainingType === 'POWER') {{{item.targetSets}} series · {{item.minReps}}–{{item.maxReps}} repeticiones · {{item.restSeconds}} s de descanso} @else {@if(item.targetDurationMinutes) {{{item.targetDurationMinutes}} minutos}@if(item.targetDistanceKm) { · {{item.targetDistanceKm}} km}}</small></li>} @empty {<li>Esta rutina todavía no tiene ejercicios.</li>}</ul></div>}
@if (editingDay() === day.id) {<div class="schedule-editor"><p>Hasta 3 bloques por día entre todas tus rutinas, seguidos o separados.</p><div class="slot-list">@for (slot of draftSchedule(); track $index; let slotIndex = $index) {<div><span>{{weekdayName(slot.weekday)}} · {{slot.start}} – {{slot.end}}</span><button type="button" (click)="removeSlot(slotIndex)" [disabled]="scheduleSaving()" [attr.aria-label]="'Quitar horario ' + (slotIndex + 1)">×</button></div>} @empty {<p>Sin horarios asignados.</p>}</div><div class="schedule-inputs"><label>Día<select #weekday [disabled]="scheduleSaving()" (change)="rangeDirty = true">@for (option of weekdays; track option.value) {<option [value]="option.value" [disabled]="isRestDay(option.value)">{{option.name}}{{isRestDay(option.value) ? ' · Descanso' : ''}}</option>}</select></label><label>Desde<input #start type="time" (input)="suggestScheduleEnd(start.value, end)" value="08:00" [disabled]="scheduleSaving()"></label><label>Hasta<input #end type="time" (input)="rangeDirty = true" value="08:30" [disabled]="scheduleSaving()"></label></div><button type="button" class="add-slot" (click)="addSlot(weekday.value, start.value, end.value)" [disabled]="scheduleSaving()">+ Agregar horario</button>@if (scheduleError()) {<p class="error" role="alert">{{scheduleError()}}</p>}<div class="schedule-actions"><button type="button" (click)="cancelSchedule()" [disabled]="scheduleSaving()">Cancelar</button><button type="button" class="button primary" (click)="saveSchedule(routine.id, day.id, weekday.value, start.value, end.value)" [disabled]="scheduleSaving()">{{scheduleSaving() ? 'Guardando…' : 'Guardar días y horarios'}}</button></div></div>}
</div></div></article>}</div>
          @if (libraryCount() > 2) {<button type="button" class="more-routines" (click)="showAllRoutines.set(!showAllRoutines())" [disabled]="scheduleSaving()" [attr.aria-expanded]="showAllRoutines()" aria-controls="library-items">{{showAllRoutines() ? 'Ver menos rutinas ↑' : 'Ver más rutinas (' + (libraryCount() - 2) + ') ↓'}}</button>}
          @if (!loadingRoutines() && !routines().length) {<p>Todavía no tenés rutinas. Creá tu primera rutina para empezar.</p>}
        </section>
<section class="training-entry" aria-labelledby="training-entry-title"><div><span class="kicker">TU PRÓXIMO PASO</span><h2 id="training-entry-title">¿Entrenamos?</h2><p>Entrá a tu sesión de hoy y registrá cada serie.</p></div><a class="train-now" routerLink="/entrenamiento"><span aria-hidden="true">▶</span> Voy a entrenar <span aria-hidden="true">→</span></a><a class="build-entry" routerLink="/rutinas/nueva">＋ Crear una rutina</a></section>
      <details class="personal-details"><summary>Ver plan completo</summary>
<section class="panel plan-panel" aria-labelledby="plan-title"><header><div><span class="kicker">TU SEMANA ORGANIZADA</span><h2 id="plan-title">Plan</h2></div><span class="badge">{{plannedEntries().length}} asignaciones</span></header><p>Los días y horarios que elegiste para entrenar.</p>
@for (entry of plannedEntries(); track entry.key) {<article class="planned-entry"><div class="planned-time"><b>{{weekdayName(entry.weekday)}}</b><time>{{entry.start}} – {{entry.end}}</time></div><div class="planned-copy"><h3>{{entry.routineName}}</h3><b>{{entry.dayName}}</b><small>{{entry.exerciseCount}} ejercicios</small></div><button type="button" class="unassign-day" (click)="removePlanEntry(entry.routineId, entry.dayId, entry.weekday, entry.start, entry.end)" [disabled]="scheduleSaving()" [attr.aria-label]="'Eliminar asignación de ' + entry.dayName + ' del ' + weekdayName(entry.weekday) + ' a las ' + entry.start">Eliminar asignación</button></article>}
@empty {<div class="empty-plan">@if (loadingRoutines()) {<p>Cargando tu plan…</p>} @else {<b>Tu semana está por armarse</b><p>Usá «Asignar día» en Rutinas para agregar tus entrenamientos al plan.</p>}</div>}
</section>
      </details>
    </section>
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`.calendar-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.calendar-header h2{margin:8px 0}.create-week-ai{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;border-radius:10px;background:var(--lime);color:#101709!important;font-size:12px;font-weight:750;text-decoration:none;text-align:center}.create-week-ai:hover{filter:brightness(1.06)}.exercise-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.exercise-heading strong,.exercise-heading h2{margin:0!important}.description-button{min-height:40px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--lime);font:inherit;font-size:12px;cursor:pointer}.youtube-link{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:8px}.description-button:focus-visible,.youtube-link:focus-visible{outline:2px solid var(--lime);outline-offset:3px}.exercise-description{margin:8px 0;font-size:14px;line-height:1.6;color:var(--muted)}
    .more-routines{display:block;width:100%;margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--lime);font-size:14px;font-weight:700;cursor:pointer}.more-routines:hover{background:#a3e6350a}
    /* Inicio en una sola columna: calendario, biblioteca y acceso al entrenamiento. */
    .home{display:flex;flex-direction:column;gap:18px;width:min(640px,calc(100% - 28px))}.home .training-entry{margin:0}.screen-title{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.personal-details{border:1px solid var(--line);border-radius:18px;padding:18px}.personal-details>summary{cursor:pointer;font-size:14px;color:var(--muted);font-weight:600}.personal-details[open]>summary{margin-bottom:22px}.routine-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:44px;padding:0;background:transparent;border:0;color:var(--text);text-align:left;cursor:pointer}.routine-toggle>span:first-child{display:flex;flex-direction:column;gap:7px;font:inherit!important;color:inherit!important}.routine-toggle .routine-name{font:inherit!important;color:inherit!important}.routine-toggle .expand-icon{font:700 18px monospace!important;color:var(--muted)!important}.routine-content{grid-column:1/-1;padding:12px 0 0;border-top:1px solid var(--line)}.routine-exercises{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px}.routine-exercises li{padding:10px;border-radius:8px;background:#090d1860}.routine-exercises li strong{display:block;font-size:13px;margin-bottom:6px}.routine-exercises li small{display:block;font-size:12px;line-height:1.5}.library-panel .day-description{min-width:0}.library-panel .routine-name b{overflow-wrap:anywhere}.home .week button{min-height:44px}
    .training-entry{padding:26px;border:1px solid #a3e63565;border-radius:22px;background:linear-gradient(130deg,#24351b,var(--surface));margin-bottom:26px}.training-entry h2{font-size:30px;margin:8px 0}.training-entry p{font-size:15px;margin:0 0 20px}.train-now{display:flex;align-items:center;justify-content:center;gap:16px;width:100%;min-height:64px;background:var(--lime);color:#0b130d!important;border-radius:14px;font-size:20px;font-weight:800;box-shadow:0 6px 22px #a3e63522}.build-entry{display:block;text-align:center;padding:16px 8px 0;font-size:15px;color:var(--text);font-weight:600}
    .routine-days>.scheduled-day{grid-template-columns:minmax(95px,auto) 1fr auto;gap:12px;align-items:center}.day-description{display:flex;flex-direction:column;gap:5px}.assign-day,.add-slot,.schedule-actions>button,.slot-list button{border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--lime);padding:9px 10px;font-size:11px;cursor:pointer}.schedule-editor{grid-column:1/-1;border-top:1px solid var(--line);padding-top:12px}.schedule-inputs{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin:12px 0}.schedule-inputs label{font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:6px}.schedule-inputs select,.schedule-inputs input{min-width:0;width:100%;padding:10px 7px;border:1px solid var(--line);border-radius:8px;color:var(--text);background:var(--surface)}.slot-list>div{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0}.routine-days .slot-list span{color:var(--text);font:400 12px/1.5 sans-serif;grid-row:auto}.slot-list button{padding:4px 10px;color:#fca5a5}.schedule-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.schedule-actions>.primary{background:var(--lime);color:#0b130d}.schedule-inputs input:focus,.schedule-inputs select:focus{outline:1px solid var(--lime)}@media(max-width:550px){.routine-days>.scheduled-day{grid-template-columns:95px 1fr}.assign-day{grid-column:1/-1;justify-self:end}.schedule-inputs{grid-template-columns:1fr 1fr}.schedule-inputs label:first-child{grid-column:1/-1}.schedule-actions{flex-wrap:wrap}}.calendar-legend{display:flex;gap:18px;margin-top:16px}.calendar-legend>span{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)}.calendar-legend i{width:8px;height:8px;border-radius:50%}.training-dot{background:#fb923c}.rest-dot{background:var(--lime)}.week button{position:relative}.week button.training-day{background:#fb923c;color:#1c1005;border-color:#fb923c;font-weight:800}.week button.expanded-day{outline:2px solid #fed7aa;outline-offset:3px}.week button>small{position:absolute;bottom:2px;right:5px;font-size:8px;color:#431407}.day-ribbon{margin-top:16px;padding:14px;border:1px solid #fb923c55;background:#fb923c0a;border-radius:12px}.day-ribbon header>b{color:#fdba74;font-size:13px}.day-ribbon header button{border:0;background:none;color:var(--muted);font-size:21px;cursor:pointer}.ribbon-item{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}.ribbon-item time{color:#fdba74;white-space:nowrap;font:700 11px monospace}.ribbon-item>div{display:flex;flex-direction:column;gap:5px}.ribbon-item b{font-size:12px}.ribbon-item small{font-size:10px}.day-ribbon>p{font-size:10px;margin-bottom:0}@media(prefers-reduced-motion:no-preference){.day-ribbon{animation:ribbon-in .18s ease-out}@keyframes ribbon-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}}.assignment-buttons{display:flex;flex-direction:column;gap:7px}.unassign-day{border:1px solid #fca5a540;border-radius:8px;background:transparent;color:#fca5a5;padding:8px;font-size:10px;cursor:pointer}.assignment-buttons button:disabled{opacity:.5;cursor:default}@media(max-width:550px){.assignment-buttons{grid-column:1/-1;flex-direction:row;justify-content:flex-end}}.planned-entry{display:grid;grid-template-columns:115px minmax(0,1fr);align-items:center;gap:12px;padding:18px 0;border-top:1px solid var(--line)}.planned-entry>.unassign-day{grid-column:2;justify-self:start}.planned-time{display:flex;flex-direction:column;gap:7px}.planned-time>b{color:var(--lime);font-size:13px}.planned-time time{font:400 11px monospace;color:var(--muted);white-space:nowrap}.planned-copy{display:flex;flex-direction:column;gap:6px;min-width:0}.planned-copy h3{font-size:15px;overflow-wrap:anywhere}.planned-copy>b{font-size:12px;font-weight:500;color:var(--muted)}.empty-plan{padding:22px 16px;background:var(--surface-2);border-radius:12px;margin-top:16px}.empty-plan>b{font-size:14px}.empty-plan p{margin-bottom:0}@media(max-width:550px){.planned-entry{grid-template-columns:100px minmax(0,1fr)}}.library-panel .routine{padding:0;margin:0;border:0}.library-panel .routine-days{margin-top:10px}.library-panel .scheduled-day{grid-template-columns:30px minmax(0,1fr) auto}.favorite-star{padding:0;border:0;background:transparent;color:var(--muted);font-size:27px;cursor:pointer;line-height:1}.favorite-star.is-favorite{color:#fbbf24}.routine-name{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.new-badge{display:inline-block;background:#a3e63518;color:var(--lime);border:1px solid #a3e63535;border-radius:5px;padding:3px 5px;font:800 8px/1 monospace;letter-spacing:.06em}.library-panel .assignment-buttons{flex-direction:row;align-items:center}.library-panel .unassign-day{display:none}@media(max-width:550px){.library-panel .scheduled-day{grid-template-columns:26px minmax(0,1fr) auto;gap:8px}.library-panel .assignment-buttons{grid-column:auto}.library-panel .assign-day{font-size:10px;padding:9px 6px}}.ribbon-workout{border-bottom:1px solid var(--line);padding-bottom:12px}.ribbon-workout:last-of-type{border-bottom:0}.ribbon-workout .ribbon-item{border-bottom:0}.ribbon-exercises{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}.ribbon-exercises li{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 10px;border-radius:7px;background:var(--surface-2)}.ribbon-exercises li>span{font-size:11px;line-height:1.5}.ribbon-exercises small{font-size:10px;text-align:right;flex-shrink:0}.ribbon-exercises .no-exercises{font-size:11px;color:var(--muted)}@media(max-width:550px){.ribbon-exercises li{flex-wrap:wrap;gap:4px}}.library-panel header .create-routine-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--lime);color:#0b130d;border:1px solid #d9f99d;border-radius:12px;padding:13px 17px;font-size:13px;font-weight:800;box-shadow:0 5px 20px #a3e63522;white-space:nowrap;transition:transform .15s,box-shadow .15s}.library-panel header .create-routine-cta:hover{transform:translateY(-2px);box-shadow:0 8px 26px #a3e63540}.create-plus{font-size:22px;line-height:1}.create-routine-cta:focus-visible{outline:3px solid var(--text);outline-offset:4px}@media(max-width:550px){.library-panel header .create-routine-cta{padding:11px 12px;font-size:12px;gap:7px}}@media(prefers-reduced-motion:reduce){.library-panel header .create-routine-cta{transition:none}}.home{padding-block:42px 80px}.kicker{color:var(--lime);font-size:10px;font-weight:800;letter-spacing:.16em}header{display:flex;align-items:center;justify-content:space-between;gap:12px}a{color:var(--muted);font-size:12px}a:hover{color:var(--lime)}h1{font-size:clamp(32px,4vw,56px);letter-spacing:-.045em;margin:8px 0;overflow-wrap:anywhere}p{color:var(--muted);font-size:12px;line-height:1.7}.panel{border:1px solid var(--line);background:var(--surface);border-radius:22px;padding:26px;min-width:0}h2{margin:8px 0 18px;font-size:24px;letter-spacing:-.03em}header h2{margin-bottom:8px}h3{font-size:18px;margin:0}.routine{padding-top:22px;margin-top:18px;border-top:1px solid var(--line)}.badge{border-radius:6px;padding:5px 8px;font-size:10px;background:var(--surface-2);color:var(--muted)}.routine-days{display:flex;flex-direction:column;gap:9px;margin-top:18px}.routine-days>div{padding:14px;background:var(--surface-2);border-radius:10px;display:grid;grid-template-columns:48px 1fr;gap:5px 12px}.routine-days span{grid-row:span 2;align-self:center;color:var(--lime);font:700 10px monospace}.routine-days b{font-size:12px}small{color:var(--muted);font-size:11px}.week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:20px}.week button{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--muted);height:40px;font-size:12px;cursor:pointer}.week button.selected{color:#0b130d;background:var(--lime);border-color:var(--lime)}button:disabled{opacity:.5}.error{color:#fca5a5;border:1px solid #fca5a540;padding:12px;border-radius:10px}button:focus-visible,a:focus-visible{outline:2px solid var(--lime);outline-offset:3px}@media(max-width:550px){.home{padding-top:25px}.panel{padding:20px}.week{gap:4px}}
  `],
})
export class DashboardComponent implements OnInit, OnChanges {
  readonly descriptionOpen=signal(new Set<string>());
  toggleDescription(id:string):void {this.descriptionOpen.update(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  youtubeUrl(link?:string|null):string|null {return link&&/^https:\/\/(?:www\.youtube\.com\/(?:shorts\/[\w-]{11}|watch\?v=[\w-]{11})|youtu\.be\/[\w-]{11})$/.test(link)?link:null;}

  @Input() visible=true;
  ngOnChanges(changes:SimpleChanges):void {if(changes['visible']?.currentValue&&!changes['visible'].firstChange)this.ngOnInit();}

  readonly showAllRoutines = signal(false);
  /** Cada ficha visible corresponde a un bloque de ejercicios, aunque una rutina antigua contenga varios. */
  libraryCount(): number { return this.routines().reduce((total, routine) => total + routine.days.length, 0); }
  visibleLibrary() {
    const entries = this.routines().flatMap(routine => routine.days.map(day => ({ routine, day })));
    return this.showAllRoutines() ? entries : entries.slice(0, 2);
  }
  readonly expandedRoutines = signal(new Set<string>());
  /** Abre o cierra los ejercicios de una ficha sin modificar sus asignaciones ni favoritos. */
  toggleRoutine(dayId: string): void {
    this.expandedRoutines.update(current => {
      const expanded = new Set(current);
      if (expanded.has(dayId)) expanded.delete(dayId); else expanded.add(dayId);
      return expanded;
    });
  }
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  readonly auth = inject(AuthService);
  private readonly routineService = inject(RoutineService);
  readonly routines = signal<Routine[]>([]);
  readonly loadingRoutines = signal(true);
  readonly restSaving = signal(false); readonly error = signal('');
  readonly editingDay = signal<string | null>(null);
  // Borrador del editor: no altera los horarios persistidos hasta confirmar Guardar.
  readonly draftSchedule = signal<ScheduleSlot[]>([]);
  readonly scheduleSaving = signal(false);
  readonly scheduleError = signal('');
  readonly selectedCalendarDay = signal<number | null>(null);
  readonly favoriteSaving = signal(new Set<string>());
  /** Muestra NEW solo durante los primeros siete días desde la creación de la rutina. */
  isNewRoutine(routine: Routine): boolean {
    const age = Date.now() - new Date(routine.createdAt).getTime();
    return Number.isFinite(age) && age >= 0 && age < 7 * 86400000;
  }
  /** Guarda el favorito en la API y actualiza la copia local cuando el servidor confirma; bloquea solicitudes duplicadas para esa ficha. */
  toggleFavorite(routineId: string, day: RoutineDay): void {
    if (this.favoriteSaving().has(day.id)) return;
    this.favoriteSaving.update(ids => new Set([...ids, day.id])); this.error.set('');
    const done = () => this.favoriteSaving.update(ids => { const next = new Set(ids); next.delete(day.id); return next; });
    this.routineService.setFavorite(routineId, day.id, !day.favorite).subscribe({ next: result => {
      this.routines.update(routines => routines.map(routine => routine.id !== routineId ? routine : {...routine, days: routine.days.map(item => item.id !== day.id ? item : {...item, favorite: result.favorite})})); done();
    }, error: () => { done(); this.error.set('No pudimos actualizar el favorito.'); } });
  }
  rangeDirty = false;
  private clearedSchedule = false;
  readonly weekdays = [{value:1,short:'L',name:'Lunes'},{value:2,short:'M',name:'Martes'},{value:3,short:'X',name:'Miércoles'},{value:4,short:'J',name:'Jueves'},{value:5,short:'V',name:'Viernes'},{value:6,short:'S',name:'Sábado'},{value:0,short:'D',name:'Domingo'}];
  /** Convierte el número de día en su nombre visible usando la lista de días de la semana. */
  weekdayName(value: number): string { return this.weekdays.find(day => day.value === value)?.name || ''; }
  /** Reúne los horarios de ese día, agrega sus ejercicios y ordena las rutinas por hora de inicio. */
  scheduledFor(weekday: number) {
    return this.routines().flatMap(routine => routine.days.flatMap(day => (day.schedule || []).filter(slot => slot.weekday === weekday).map(slot => ({...slot, routineName: routine.name, dayName: day.name, exercises: [...(day.exercises || [])].sort((a,b) => a.order-b.order)})))).sort((a,b) => a.start.localeCompare(b.start));
  }
  /** Indica si hay al menos una asignación para colorear y controlar el día del calendario. */
  hasTraining(weekday: number): boolean { return this.scheduledFor(weekday).length > 0; }
  /** Aplana las asignaciones de todas las rutinas y las ordena de lunes a domingo y por horario. */
  plannedEntries() {
    return this.routines().flatMap(routine => routine.days.flatMap(day => (day.schedule || []).map(slot => ({...slot,
      key: `${day.id}:${slot.weekday}:${slot.start}:${slot.end}`, routineId: routine.id, dayId: day.id,
      routineName: routine.name, dayName: day.name, exerciseCount: day.exercises?.length || 0,
    })))).sort((a,b) => ((a.weekday+6)%7)-((b.weekday+6)%7) || a.start.localeCompare(b.start));
  }
  /** Quita un bloque horario concreto y conserva la rutina y sus otras asignaciones. */
  removePlanEntry(routineId: string, dayId: string, weekday: number, start: string, end: string): void {
    if (this.scheduleSaving()) return;
    const day = this.routines().find(routine => routine.id === routineId)?.days.find(day => day.id === dayId);
    if (!day) return;
    const schedule = (day.schedule || []).filter(slot => !(slot.weekday === weekday && slot.start === start && slot.end === end));
    this.scheduleSaving.set(true); this.error.set('');
    this.routineService.assignSchedule(routineId, dayId, schedule).subscribe({ next: result => {
      this.routines.update(routines => routines.map(routine => routine.id !== routineId ? routine : {...routine, days: routine.days.map(day => day.id !== dayId ? day : {...day, schedule: result.schedule})}));
      this.scheduleSaving.set(false);
      if (this.editingDay() === dayId) { this.editingDay.set(null); this.draftSchedule.set([]); }
      if (this.selectedCalendarDay() === weekday && !this.hasTraining(weekday)) this.selectedCalendarDay.set(null);
    }, error: error => { this.scheduleSaving.set(false); this.error.set(error.error?.message || 'No pudimos eliminar la asignación.'); } });
  }
  /** Genera una descripción accesible del día: entrenamientos asignados, descanso o día libre. */
  calendarDayLabel(weekday: number): string { return `${this.weekdayName(weekday)}: ${this.hasTraining(weekday) ? this.scheduledFor(weekday).length + ' rutinas asignadas' : this.isRestDay(weekday) ? 'día de descanso' : 'día libre, marcar descanso'}`; }
  /** Abre o cierra el detalle si hay entrenamientos; si no los hay, permite alternar el descanso. */
  selectCalendarDay(weekday: number): void {
    if (this.hasTraining(weekday)) { this.selectedCalendarDay.update(value => value === weekday ? null : weekday); return; }
    this.selectedCalendarDay.set(null); this.toggleRestDay(weekday);
  }
  /** Abre el editor con una copia de los horarios: los cambios del borrador todavía no se guardan. */
  openSchedule(day: RoutineDay): void {
    if (this.scheduleSaving()) return;
    this.editingDay.set(day.id); this.draftSchedule.set((day.schedule || []).map(slot => ({...slot}))); this.scheduleError.set('');
    this.rangeDirty = false; this.clearedSchedule = false;
  }
  /** Sugiere media hora al cambiar el inicio; Hasta sigue siendo editable. */
  suggestScheduleEnd(start: string, end: HTMLInputElement): void {
    if (this.scheduleSaving()) return;
    this.rangeDirty = true;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) { end.value = ''; return; }
    const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + 30;
    end.value = total >= 1440 ? '' : String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  /** Cierra el editor sin enviar el borrador; no permite cerrarlo mientras se está guardando. */
  cancelSchedule(): void { if (!this.scheduleSaving()) { this.editingDay.set(null); this.scheduleError.set(''); } }
  /** Envía una lista vacía de horarios para dejar la rutina libre sin borrarla de la biblioteca. */
  clearAssignment(routineId: string, dayId: string): void {
    if (this.scheduleSaving()) return;
    this.scheduleSaving.set(true); this.error.set('');
    this.routineService.assignSchedule(routineId, dayId, []).subscribe({
      next: () => {
        this.routines.update(routines => routines.map(routine => routine.id !== routineId ? routine : {...routine, days: routine.days.map(day => day.id !== dayId ? day : {...day, schedule: []})}));
        this.scheduleSaving.set(false);
        if (this.editingDay() === dayId) { this.editingDay.set(null); this.draftSchedule.set([]); this.scheduleError.set(''); }
        const selected = this.selectedCalendarDay();
        if (selected !== null && !this.hasTraining(selected)) this.selectedCalendarDay.set(null);
      },
      error: error => { this.scheduleSaving.set(false); this.error.set(error.error?.message || 'No pudimos eliminar la asignación.'); },
    });
  }
  /** Elimina un horario del borrador y registra que el usuario lo quitó de forma explícita. */
  removeSlot(index: number): void { if (!this.scheduleSaving()) { this.draftSchedule.update(slots => slots.filter((_, i) => i !== index)); this.clearedSchedule = true; this.scheduleError.set(''); } }
  /** Valida el rango, los descansos, el límite diario y los cruces antes de agregar un bloque al borrador. */
  addSlot(weekday: string, start: string, end: string): void {
    if (this.scheduleSaving()) return;
    const slot = { weekday: Number(weekday), start, end };
    if (this.isRestDay(slot.weekday)) { this.scheduleError.set('Ese día es de descanso. Quitá primero el descanso en el calendario.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) { this.scheduleError.set('Elegí un rango válido: la hora de fin debe ser posterior al inicio.'); return; }
    const otherSlots = this.routines().flatMap(routine => routine.days).filter(day => day.id !== this.editingDay()).flatMap(day => day.schedule || []);
    const sameDay = [...otherSlots, ...this.draftSchedule()].filter(item => item.weekday === slot.weekday);
    if (sameDay.length >= 3) { this.scheduleError.set('Este día ya tiene 3 bloques de rutina asignados.'); return; }
    if (sameDay.some(item => start < item.end && end > item.start)) { this.scheduleError.set('Ese horario se superpone con otro bloque. Elegí un horario seguido o separado.'); return; }
    this.draftSchedule.update(slots => [...slots, slot].sort((a,b) => ((a.weekday+6)%7)-((b.weekday+6)%7) || a.start.localeCompare(b.start)));
    this.rangeDirty = false;
    this.scheduleError.set('');
  }
  /** Incluye el rango visible pendiente, envía el calendario completo y actualiza la pantalla tras la confirmación. */
  saveSchedule(routineId: string, dayId: string, weekday?: string, start?: string, end?: string): void {
    if (this.scheduleSaving()) return;
    // Guarda el rango visible directamente; Agregar solo hace falta para incluir más rangos.
    if (weekday !== undefined && start !== undefined && end !== undefined && (this.rangeDirty || (!this.draftSchedule().length && !this.clearedSchedule))) {
      const count = this.draftSchedule().length;
      this.addSlot(weekday, start, end);
      if (this.draftSchedule().length === count) return;
    }
    this.scheduleSaving.set(true); this.scheduleError.set('');
    this.routineService.assignSchedule(routineId, dayId, this.draftSchedule()).subscribe({ next: result => {
      this.routines.update(routines => routines.map(routine => routine.id !== routineId ? routine : {...routine, days: routine.days.map(day => day.id !== dayId ? day : {...day, schedule: result.schedule})}));
      this.scheduleSaving.set(false); this.editingDay.set(null);
    }, error: error => { this.scheduleSaving.set(false); this.scheduleError.set(error.error?.message || 'No pudimos guardar los horarios.'); } });
  }
  /** Consulta los días de descanso guardados en el perfil del usuario actual. */
  isRestDay(day: number): boolean { return (this.auth.user()?.restDays || []).includes(day); }
  /** Genera el texto de los días de descanso, excluyendo días que tienen entrenamientos asignados. */
  get restLabel(): string { return this.weekdays.filter(day => this.isRestDay(day.value) && !this.hasTraining(day.value)).map(day => day.name).join(' · ') || 'Aún no elegiste días de descanso.'; }
  /** Carga el perfil para el calendario de descanso y las rutinas del plan. */
  ngOnInit(): void {
    this.auth.refreshProfile().subscribe({ error: () => this.error.set('No pudimos actualizar tu perfil.') });
    this.routineService.getAll().subscribe({ next: routines => { this.routines.set(routines); this.loadingRoutines.set(false); }, error: () => { this.loadingRoutines.set(false); this.error.set('No pudimos cargar tus rutinas.'); } });

  }
  /** Guarda o quita el descanso de un día; impide marcar descanso si hay rutinas asignadas. */
  toggleRestDay(day: number): void {
    if (this.restSaving()) return;
    if (this.hasTraining(day) && !this.isRestDay(day)) { this.selectedCalendarDay.set(day); this.error.set('Este día tiene rutinas asignadas. Quitá sus horarios antes de marcarlo como descanso.'); return; }
    const restDays = new Set(this.auth.user()?.restDays || []);
    if (restDays.has(day)) restDays.delete(day); else restDays.add(day);
    this.restSaving.set(true); this.error.set('');
    this.auth.updateProfile({ restDays: [...restDays] }).subscribe({ next: () => this.restSaving.set(false), error: error => { this.restSaving.set(false); this.error.set(error.error?.message || 'No pudimos guardar tus días de descanso.'); } });
  }
}
