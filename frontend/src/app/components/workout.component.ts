/**
 * Entrenamiento y máquina de estados: idle=espera, work=serie, rest=descanso. Conserva datos al cambiar de pestaña interna porque AppComponent mantiene esta instancia. El respaldo local permite recuperarlo después de recargar o cerrar la app.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, Input, inject, OnChanges, OnDestroy, OnInit, SimpleChanges, signal, effect, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { Routine, RoutineDay, ScheduleSlot, RoutineService } from '../services/routine.service';
import { AlarmService } from '../services/alarm.service';
import { SessionService } from '../services/session.service';
import { WorkoutStorageService, WorkoutCommand } from '../services/workout-storage.service';

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
interface CompletedSeries {
  key: string;
  exerciseId: string;
  exerciseName: string;
  exerciseIndex: number;
  setNumber: number;
  weightKg: number;
  repetitions: number;
  durationSeconds: number;
}

interface WorkoutExercise {
  description?: string | null;
  videoUrl?: string | null;
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: string;
  rest: number;
  done: number;
  workSeconds: number;
  trainingType?: string;
}

@Component({
  selector: 'app-workout',
  standalone: true,
  imports: [RouterLink],
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    <section class="page workout">
      @if(storage.storageError()) {<p class="sync-notice error" role="alert">{{storage.storageError()}}</p>}
      @if(storage.actionRequired()) {<div class="sync-notice error" role="alert">{{storage.syncError()}}</div>}
      @if(exercises.length) {
        <div class="total-clock-row">
          <strong class="total-clock-value" role="timer" aria-label="Tiempo total de entrenamiento">{{formatMilliseconds(elapsedMilliseconds())}}</strong>
          <div class="total-clock-controls">
          <button type="button" class="total-clock-toggle" (click)="running() ? pause() : play()" [disabled]="saving()" [attr.aria-label]="running() ? 'Pausar cronómetro total' : sessionFinished() ? 'Iniciar nueva sesión' : 'Iniciar o reanudar cronómetro total'"><span aria-hidden="true">{{running() ? 'Ⅱ' : '▶'}}</span></button>
          <button type="button" class="total-clock-secondary" (click)="stopTimer()" [disabled]="!running() || saving() || sessionFinished()" aria-label="Detener cronómetros" title="Stop"><span aria-hidden="true">■</span></button>
          <button type="button" class="total-clock-secondary" (click)="restartTotalTimer()" [disabled]="saving() || sessionFinished()" aria-label="Reiniciar cronómetro total" title="Reiniciar tiempo total"><span aria-hidden="true">↺</span></button>
          </div>
        </div>
      }
      @if (exercises.length && !sessionFinished()) {
        <div class="next-action" aria-label="Siguiente paso del entrenamiento"><span class="kicker">{{phase() === 'rest' ? 'AHORA DESCANSÁ' : phase() === 'work' ? 'SERIE EN CURSO' : 'EMPEZÁ POR ACÁ'}}</span><div class="exercise-heading"><h2>{{phase() === 'rest' ? 'Recuperá para la próxima serie' : phase() === 'work' ? current().name : nextSetIndex() >= 0 ? current().name + ' · Serie ' + (nextSetIndex()+1) : 'Ejercicio completo'}}</h2>@if(current().description){<button type="button" class="description-button" (click)="descriptionFor.set(descriptionFor()===current().id?null:current().id)" [attr.aria-expanded]="descriptionFor()===current().id" [attr.aria-label]="'Descripción de ' + current().name">Descripción</button>}@if(tutorialUrl();as video){@if(!video.includes('tiktok.com')){<a class="youtube-link" [href]="video" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Ver ' + current().name + ' en YouTube'" title="Ver tutorial en YouTube"><svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><rect width="28" height="20" rx="6" fill="#ff0033"/><path d="M11 5.5 19 10l-8 4.5Z" fill="white"/></svg></a>}}</div>@if(descriptionFor()===current().id && current().description){<p class="exercise-description">{{current().description}}</p>}
          @if(exercises.length > 1) {<label class="exercise-picker">Ejercicio<select [value]="active()" (change)="chooseExercise(+$any($event.target).value)" [disabled]="phase() !== 'idle' || saving() || chainRoundActive()">@for(exercise of exercises; track exercise.id; let i=$index) {<option [value]="i" [selected]="active()===i">{{exercise.name}} · {{exercise.done}}/{{exercise.sets}} series</option>}</select></label>}
          @if(linkedExercises().length >= 2) {<p class="linked-label">{{linkedLabel()}}<br>Sin descanso entre ejercicios · {{linkedRestSeconds()}} s al terminar la ronda.</p>}
          @if (phase() === 'idle' && nextSetIndex() >= 0) {<button type="button" class="start-next" (click)="startSeries(nextSetIndex())" [disabled]="saving()">▶ Iniciar serie {{nextSetIndex()+1}}</button>}
          @else if (phase() === 'work') {
            <p>Serie {{seriesIndex()! + 1}} de {{current().sets}} · {{chainRoundActive() && hasLinkedNext() ? 'Al terminar continuás con el siguiente ejercicio de la ronda.' : 'Al terminar empieza el descanso.'}}</p>
            <div class="series-clock-row"><strong class="active-series-clock" role="timer" aria-label="Tiempo de la serie">{{formatMilliseconds(current().workSeconds * 1000 - phaseMilliseconds())}}</strong><div class="active-series-controls series-icon-controls"><button type="button" class="total-clock-toggle" (click)="seriesPaused() || !running() ? resumeSeries() : toggleSeriesPause(seriesIndex()!)" [disabled]="saving()" [attr.aria-label]="seriesPaused() || !running() ? 'Reanudar serie' : 'Pausar serie'" [title]="seriesPaused() || !running() ? 'Reanudar serie' : 'Pausar serie'"><span aria-hidden="true">{{seriesPaused() || !running() ? '▶' : 'Ⅱ'}}</span></button><button type="button" class="total-clock-secondary" (click)="restartSeries(seriesIndex()!)" [disabled]="saving()" aria-label="Reiniciar serie" title="Reiniciar serie"><span aria-hidden="true">↺</span></button></div></div>
            @if(error()) {<p class="error" role="alert">{{error()}}</p>}
            <button type="button" class="start-next" (click)="completeSet(seriesIndex()!, setDraft(seriesIndex()!).weight, setDraft(seriesIndex()!).reps)" [disabled]="saving() || !running()">{{saving() ? 'Guardando serie…' : '■ Terminar serie'}}</button>
          }
          @else if (phase() === 'rest') {
            <div class="series-clock-row"><strong class="rest-remaining" role="timer" aria-label="Tiempo de descanso">{{formatMilliseconds(restSeconds() * 1000 - phaseMilliseconds())}}</strong><div class="active-series-controls series-icon-controls"><button type="button" class="total-clock-toggle" (click)="running() ? pause() : play()" [disabled]="saving()" [attr.aria-label]="running() ? 'Pausar descanso' : 'Reanudar descanso'" [title]="running() ? 'Pausar descanso' : 'Reanudar descanso'"><span aria-hidden="true">{{running() ? 'Ⅱ' : '▶'}}</span></button><button type="button" class="total-clock-secondary" (click)="restartRest()" [disabled]="saving()" aria-label="Reiniciar descanso" title="Reiniciar descanso"><span aria-hidden="true">↺</span></button></div></div>
            <p>{{running() ? 'La próxima serie empieza cuando vos toques Iniciar.' : 'Descanso en pausa. Reanudalo cuando estés listo.'}}</p>
            <button type="button" class="start-next" (click)="endRest()" [disabled]="saving()">Terminar descanso</button>
          }
          @else {<p>Completaste este ejercicio. Continuá cuando estés listo.</p><button type="button" class="start-next" (click)="nextExercise()" [disabled]="saving()">{{nextActionLabel()}}</button>}
          <details class="timer-settings"><summary>Editar serie</summary><div class="active-series-fields"><label>Cantidad de series<input type="number" [min]="minimumSets()" max="1000" step="1" [value]="current().sets" [disabled]="saving()" (change)="configureSets($any($event.target))"></label></div><p>Para este entrenamiento; tu rutina base se conserva.</p>@if((!current().trainingType || current().trainingType === 'POWER') && (phase() === 'work' || nextSetIndex() >= 0)) {@let editIndex = phase() === 'work' ? seriesIndex()! : nextSetIndex();<div class="active-series-fields"><label>Peso (kg)<input type="number" min="0" step="0.5" [value]="setDraft(editIndex).weight" (input)="updateSetDraft(editIndex, 'weight', $any($event.target).value)" [disabled]="saving()"></label><label>Repeticiones<input type="number" min="1" step="1" [value]="setDraft(editIndex).reps" (input)="updateSetDraft(editIndex, 'reps', $any($event.target).value)" [disabled]="saving()"></label></div>}<p>Pausá el reloj en curso para cambiar su duración. El tiempo transcurrido se conserva.</p><div class="active-series-fields"><label>Serie (segundos)<input type="number" min="1" max="3600" step="1" [value]="current().workSeconds" [disabled]="saving() || (phase() === 'work' && running() && !seriesPaused())" (change)="configureTimer('work', $any($event.target).value)"></label><label>Descanso (segundos)<input type="number" min="0" max="3600" step="1" [value]="restSeconds()" [disabled]="saving() || (phase() === 'rest' && running())" (change)="configureTimer('rest', $any($event.target).value)"></label></div></details>

            @if(error() && phase() !== 'work') {<p class="error" role="alert">{{error()}}</p>}
          <details class="linked-settings"><summary>Encadenar de 2 a 4 ejercicios</summary><p>Elegí el orden: una serie de A, después B (y C o D si los agregás). Descansás al cerrar la ronda. Cada serie empieza al tocar Iniciar.</p>@for(exercise of exercises; track exercise.id; let i=$index) {<label><input type="checkbox" [checked]="linkedExercises().includes(i)" [attr.aria-label]="exercise.name" (change)="toggleLinkedExercise(i)" [disabled]="phase() !== 'idle' || saving() || chainRoundActive() || (!linkedExercises().includes(i) && linkedExercises().length >= 4)">{{exercise.name}} @if(linkedExercises().includes(i)) {<b>{{linkedExercises().indexOf(i)+1}}</b>}</label>}<p>@if(linkedExercises().length === 1) {Elegí otro ejercicio para activar el grupo.} @else if(linkedExercises().length >= 2) {Se omiten los ejercicios que ya completaron todas sus series.}</p><label>Descanso entre rondas (segundos)<input type="number" min="0" max="3600" step="1" [value]="linkedRestSeconds()" (change)="configureLinkedRest($any($event.target).value)" [disabled]="phase() !== 'idle' || saving() || chainRoundActive()"></label><button type="button" class="repeat-record" (click)="clearLinkedExercises()" [disabled]="phase() !== 'idle' || saving() || chainRoundActive()">Quitar grupo</button></details>
        </div>
      }
      @if (sessionFinished()) {<p role="status" class="saved-message">Sesión guardada. Podés revisar tus series o iniciar una nueva sesión.</p>}
      @if (error()) {<div class="error" role="alert">{{error()}}</div>}
      @if (planNotice()) {<p class="plan-notice" role="status">{{planNotice()}}</p>}
      @if (todayPlan().length) {<div class="today-plan"><label>Tu plan de hoy<select [value]="selectedPlanKey" (change)="selectPlannedWorkout($any($event.target).value)" [disabled]="saving() || (!!sessionId() && !sessionFinished())">@for (entry of todayPlan(); track entry.key) {<option [value]="entry.key" [selected]="selectedPlanKey===entry.key">{{entry.slot.start}} – {{entry.slot.end}} · {{entry.day.name}} · {{entry.routine.name}}</option>}</select></label></div>}
      @if (exercises.length) {
        <div class="session-log">

          <article class="current">
            <h2 class="series-table-title">Series registradas · {{completedSeries().length}}</h2>
            <ol class="completed-log" aria-label="Series guardadas">@for (record of completedSeries(); track record.key) {<li><span class="completed-tick" aria-label="Serie guardada">✓</span><div><h3>{{record.exerciseName}} · Serie {{record.setNumber}}</h3><div class="completed-values">@if(!exercises[record.exerciseIndex].trainingType || exercises[record.exerciseIndex].trainingType === 'POWER') {<span>{{record.weightKg}} kg</span><span>{{record.repetitions}} repeticiones</span>} @else {<span>Bloque completado</span>}<time>Tiempo: {{format(record.durationSeconds)}}</time></div><button class="repeat-record" type="button" (click)="repeatRecordedSeries(record)" [disabled]="saving() || sessionFinished() || phase() === 'work' || chainRoundActive()">↶ Volver a esta serie</button></div></li>} @empty {<li class="log-empty">Las series aparecerán acá cuando las termines.</li>}</ol>
          </article>
        </div>
      } @else { <div class="empty">@if(loadingPlan()) {<p>Consultando tu plan…</p>} @else if(error()) {<p>No pudimos consultar tus rutinas. Revisá la conexión.</p><button type="button" class="button primary" (click)="refreshPlan()">Reintentar</button>} @else {<h2>Elegí qué vas a entrenar hoy</h2><p>No hay una rutina asignada para hoy. Podés asignar una desde tu biblioteca.</p><a class="button primary" routerLink="/" fragment="library-title">Elegir una rutina</a><a class="button ghost" routerLink="/rutinas/nueva">Crear una rutina</a>}</div> }
      @if(exercises.length) {<button type="button" class="save-session finish-session-bottom" (click)="finishSession(true)" [disabled]="!sessionId() || saving() || sessionFinished() || phase() === 'work'">Guardar y finalizar sesión</button>}
    </section>
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`.exercise-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.exercise-heading strong,.exercise-heading h2{margin:0!important}.description-button{min-height:40px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--lime);font:inherit;font-size:12px;cursor:pointer}.youtube-link{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:8px}.description-button:focus-visible,.youtube-link:focus-visible{outline:2px solid var(--lime);outline-offset:3px}.exercise-description{margin:8px 0;font-size:14px;line-height:1.6;color:var(--muted)}.routine-video-icon{display:inline-flex;vertical-align:middle;margin-left:6px}
    .sync-notice{margin:0 0 20px;padding:14px;border:1px solid var(--line);border-radius:12px;color:var(--muted);font-size:13px;line-height:1.6}.sync-notice button{display:block;margin-top:8px;border:0;background:transparent;color:var(--lime);padding:8px 0;cursor:pointer}.linked-settings{margin-top:18px;border-top:1px solid var(--line);padding-top:16px}.linked-settings summary{font-size:14px;cursor:pointer}.linked-settings p,.linked-label{font-size:13px;line-height:1.6;color:var(--muted)}.linked-settings label{display:flex;align-items:center;gap:10px;margin:14px 0;font-size:14px}.linked-settings input[type=checkbox]{width:22px;min-height:22px;height:22px;accent-color:var(--lime)}.linked-settings input[type=number]{width:90px;min-width:0;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text)}.linked-settings b{color:var(--lime)}
    .completed-log .log-empty{display:block;background:transparent;border-color:var(--line)}
    .exercise-picker{display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--muted);margin-bottom:18px}.exercise-picker select{width:100%;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text)}
    .completed-log{list-style:none;padding:0;margin:20px 0 0;display:flex;flex-direction:column;gap:12px}.completed-log li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:16px;border:1px solid #a3e63530;border-radius:14px;background:#a3e63508}.completed-tick{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--lime);color:#0b130d;font-weight:800}.completed-log h3{margin:0 0 9px;font-size:15px}.completed-values{display:flex;gap:8px 16px;flex-wrap:wrap;color:var(--text);font-size:13px}.completed-values time{font-variant-numeric:tabular-nums}.repeat-record{margin-top:12px;background:transparent;border:1px solid var(--line);border-radius:8px;padding:9px 12px;color:var(--muted);font-size:12px;cursor:pointer}.repeat-record:disabled{opacity:.4}.log-empty{color:var(--muted);font-size:14px;line-height:1.7}
    .timer-settings{margin-top:18px;border-top:1px solid #a3e63530;padding-top:16px}.timer-settings summary{cursor:pointer;color:var(--text);font-size:14px;font-weight:600;min-height:32px}.timer-settings p{font-size:12px}.series-table-title{font-size:20px!important;margin-top:0!important}
    .series-clock-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0}.series-clock-row .active-series-clock,.series-clock-row .rest-remaining{margin:0;font-size:clamp(22px,5.6vw,40px)}.series-clock-row .series-icon-controls{margin:0;flex-shrink:0}
    .active-series-controls.series-icon-controls{display:flex;justify-content:flex-end;align-items:center;gap:6px}.active-series-controls.series-icon-controls .total-clock-toggle{width:48px;height:48px;min-height:48px;padding:0;border:0;border-radius:50%;background:var(--lime);color:#0b130d;font-size:24px}.active-series-controls.series-icon-controls .total-clock-secondary{width:40px;height:44px;min-height:44px;padding:0;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--text);font-size:24px}.rest-remaining{margin-top:16px}
    .active-series-clock{display:block;font:700 clamp(26px,6vw,40px)/1.3 monospace;color:var(--lime);margin:18px 0;font-variant-numeric:tabular-nums}.active-series-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}.active-series-fields label{display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text)}.active-series-fields input{width:100%;min-width:0;border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--surface-2);color:var(--text);font-size:18px}.active-series-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.active-series-controls button{min-height:48px;border:1px solid #a3e63555;border-radius:10px;background:var(--surface-2);color:var(--text);font-weight:600;font-size:13px;cursor:pointer}@media(max-width:750px){.workout aside{display:flex;flex-direction:row;overflow-x:auto;padding-bottom:6px}.workout aside button{min-width:160px;justify-content:flex-start}.workout aside button div{display:flex;text-align:left}.workout aside button b{font-size:13px}}
    .total-clock-controls{display:flex;gap:6px;flex-shrink:0}.total-clock-secondary{width:40px;height:44px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--text);font-size:24px;cursor:pointer}.total-clock-secondary:disabled{opacity:.35;cursor:default}.total-clock-secondary:focus-visible{outline:2px solid var(--lime);outline-offset:3px}.total-clock-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 24px}.total-clock-value{font:700 clamp(22px,6vw,36px)/1.2 monospace;font-variant-numeric:tabular-nums;color:var(--text);white-space:nowrap}.total-clock-toggle{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;border:0;border-radius:50%;background:var(--lime);color:#0b130d;font-size:24px;cursor:pointer}.total-clock-toggle:disabled{opacity:.4;cursor:default}.total-clock-toggle:focus-visible{outline:2px solid var(--lime);outline-offset:4px}.finish-session-bottom{margin-top:32px;min-height:48px}
    .next-action{padding:24px;border:1px solid #a3e63570;border-radius:20px;background:#a3e6350c;margin-bottom:24px}.next-action h2{font-size:26px;margin:10px 0}.next-action p{font-size:15px;color:var(--muted);line-height:1.6}.start-next{display:block;width:100%;border:0;border-radius:14px;background:var(--lime);color:#0b130d;padding:20px;font-size:19px;font-weight:800;cursor:pointer}.start-next:disabled{opacity:.5}.rest-remaining{font:700 34px monospace;color:#7dd3fc}.workout .save-session{background:transparent;color:var(--muted);border-color:var(--line)}
    .today-plan{margin-bottom:24px}.today-plan label{display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:12px}.today-plan select{width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text)}.plan-notice{padding:14px;border:1px solid #fb923c55;border-radius:12px;color:#fdba74;font-size:12px}.workout{padding-top:48px;padding-bottom:70px}.kicker{color:var(--lime);font-size:11px;letter-spacing:.18em;font-weight:800}.timer{font:700 42px/1 monospace;color:var(--lime);text-align:right}.timer small{display:block;color:var(--muted);font:700 9px/1 sans-serif;letter-spacing:.14em;margin-top:9px}aside{display:flex;flex-direction:column;gap:8px}aside button{display:flex;gap:14px;align-items:center;text-align:left;border:1px solid transparent;background:transparent;color:var(--muted);padding:16px;border-radius:14px}aside button.active{background:var(--surface);border-color:var(--line);color:var(--text)}aside button>span{font-family:monospace;color:#52617a}aside div{display:flex;flex-direction:column;gap:4px}aside small{font-size:11px;color:var(--muted)}.current{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:clamp(24px,4vw,46px)}.muscle{color:var(--lime);font-size:12px;text-transform:uppercase;letter-spacing:.14em}.current h2{font-size:42px;margin:10px 0}.current>p{color:var(--muted)}.error{margin-top:16px;color:#fca5a5;font-size:12px}.empty{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:40px;color:var(--muted)}@media(max-width:750px){aside{display:grid;grid-template-columns:repeat(4,1fr)}aside button{padding:10px;justify-content:center}aside button div{display:none}.timer{font-size:28px}.current h2{font-size:32px}.current{padding:20px}}@media(max-width:600px){.current{padding:16px}}
    .milliseconds{font-size:.5em;letter-spacing:0;color:#d9f99d;vertical-align:baseline}.save-session{display:block;width:100%;margin-top:16px;padding:12px;border:1px solid #638833;border-radius:10px;background:var(--lime);color:#0b130d;font-size:12px;font-weight:700;cursor:pointer}.save-session:disabled{opacity:.4;cursor:default}.saved-message{padding:14px 18px;border:1px solid #638833;border-radius:12px;color:var(--lime);background:#a3e6350a;margin-bottom:24px}.timer{background:#080f0c;border:2px solid #35463a;border-radius:12px;padding:18px 8px 13px;text-align:center;font:700 35px/1.2 'Courier New',monospace;font-variant-numeric:tabular-nums;letter-spacing:.03em;text-shadow:0 0 14px #a3e63540;box-shadow:inset 0 3px 9px #0008}.workout>.error{margin:-15px 0 24px}@media(max-width:750px){.timer{font-size:clamp(25px,7vw,35px)}}
  `],
})
export class WorkoutComponent implements OnInit, OnChanges, OnDestroy {
  readonly descriptionFor=signal<string|null>(null);
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  @Input() visible = true;
  readonly todayPlan = signal<Array<{key:string; routine:Routine; day:RoutineDay; slot:ScheduleSlot}>>([]);
  readonly loadingPlan = signal(false);
  readonly planNotice = signal('');
  selectedPlanKey = '';
  private planRequest = 0;
  readonly Math = Math;
  private readonly routines = inject(RoutineService);
  private readonly sessions = inject(SessionService);
  private readonly router = inject(Router);
  readonly storage = inject(WorkoutStorageService);
  readonly alarms = inject(AlarmService);
  private readonly phaseAlarmId = signal('');
  private readonly storageScope = this.storage.scope();
  private initialized = false;
  private recovered = false;
  exercises: WorkoutExercise[] = [];
  readonly routineName = signal('Cargando rutina…'); readonly sessionId = signal<string | null>(null);
  readonly active = signal(0); readonly elapsed = signal(0); readonly completed = signal(new Set<number>());
  readonly saving = signal(false); readonly error = signal('');
  readonly completedSeries = signal<CompletedSeries[]>([]);
  readonly linkedExercises = signal<number[]>([]);
  readonly linkedRestSeconds = signal(90);
  private linkedRound = false;
  private remainingLinked: number[] = [];
  chainRoundActive(): boolean { return this.linkedRound; }
  hasLinkedNext(): boolean { return this.remainingLinked.length > 0; }
  linkedLabel(): string { return this.linkedExercises().map(index => this.exercises[index]?.name).join(' → '); }
  /** Cambia el orden sin perder series. Elegir fuera del grupo vuelve al modo individual. */
  chooseExercise(index: number): void {
    if (this.phase() !== 'idle' || this.saving() || this.linkedRound || !Number.isInteger(index) || !this.exercises[index]) return;
    if (!this.linkedExercises().includes(index)) this.linkedExercises.set([]);
    this.selectExercise(index);
  }
  /** La selección conserva el orden elegido y se bloquea mientras se completa una ronda. */
  toggleLinkedExercise(index: number): void {
    if (this.phase() !== 'idle' || this.saving() || this.linkedRound || !this.exercises[index]) return;
    const selected = [...this.linkedExercises()];
    if (selected.includes(index)) selected.splice(selected.indexOf(index), 1);
    else { if (selected.length >= 4) return; selected.push(index); }
    this.linkedExercises.set(selected);
    if (selected.length >= 2) this.selectExercise(selected[0]);
  }
  clearLinkedExercises(): void { if (this.phase() === 'idle' && !this.saving() && !this.linkedRound) this.linkedExercises.set([]); }
  configureLinkedRest(raw: string): void {
    if (this.phase() !== 'idle' || this.saving() || this.linkedRound) return;
    const seconds = Number(raw);
    if (!raw.trim() || !Number.isInteger(seconds) || seconds < 0 || seconds > 3600) { this.error.set('El descanso entre rondas debe ser de 0 a 3600 segundos.'); return; }
    this.linkedRestSeconds.set(seconds); this.error.set('');
  }
  restSeconds(): number { return this.linkedExercises().length >= 2 && this.linkedExercises().includes(this.active()) ? this.linkedRestSeconds() : this.current()?.rest || 0; }
  private exercisePending(index: number): boolean { return (this.completedByExercise.get(this.exercises[index].id)?.size || 0) < this.exercises[index].sets; }
  nextActionLabel(): string {
    return this.exercises.some((_,index) => this.exercisePending(index)) ? 'Siguiente ejercicio →' : 'Guardar y finalizar sesión';
  }

  /** Tras confirmar A, prepara B sin descanso ni inicio automático. Solo el último abre el descanso. */
  private afterSavedSeries(): void {
    this.phaseAlarmId.set(crypto.randomUUID());
    this.seriesPaused.set(false); this.phaseMs = 0; this.phaseElapsed.set(0); this.phaseMilliseconds.set(0); this.phaseSince = Date.now(); this.seriesFrozen = false;
    if (this.linkedRound) {
      const next = this.remainingLinked.shift();
      if (next !== undefined) { this.phase.set('idle'); this.seriesIndex.set(null); this.selectExercise(next); return; }
    }
    this.phase.set('rest');
    if (this.restSeconds() === 0) this.endRest();
  }
  /** La lista refleja únicamente series confirmadas por la API. Repetir una actualiza su fila. */
  private recordSeries(exercise: WorkoutExercise, data: {setNumber:number; weightKg:number; repetitions:number; durationSeconds:number}): void {
    const key = `${exercise.id}:${data.setNumber}`;
    const record: CompletedSeries = { key, exerciseId:exercise.id, exerciseName:exercise.name, exerciseIndex:this.active(), ...data };
    const rows = [...this.completedSeries()];
    const index = rows.findIndex(row => row.key === key);
    if (index < 0) rows.push(record); else rows[index] = record;
    this.completedSeries.set(rows);
  }
  /** Permite volver a una serie guardada, incluso si pertenece a otro ejercicio de la sesión. */
  repeatRecordedSeries(record: CompletedSeries): void {
    if (this.saving() || this.sessionFinished() || this.phase() === 'work' || this.linkedRound) return;
    if (this.phase() === 'rest') this.endRest();
    if (!this.linkedExercises().includes(record.exerciseIndex)) this.linkedExercises.set([]);
    this.selectExercise(record.exerciseIndex);
    this.returnToSeries(record.setNumber - 1);
  }
  readonly running = signal(false);
  readonly sessionFinished = signal(false);
  // Fase de la serie; running es independiente y controla si avanzan los relojes.
  readonly phase = signal<'idle' | 'work' | 'rest'>('idle');
  readonly seriesIndex = signal<number | null>(null);
  readonly phaseElapsed = signal(0);
  readonly elapsedMilliseconds = signal(0);
  readonly phaseMilliseconds = signal(0);
  readonly seriesPaused = signal(false);
  // Marca del último inicio y tiempo acumulado de la fase: permite pausar y reanudar sin perder tiempo.
  private phaseSince = 0;
  private phaseMs = 0;
  private seriesFrozen = false;
  private pendingSeries: number | null = null;
  private lastRestSeconds = 0;
  // Claves ejercicio:índice ya guardadas: al repetir una serie se usa PUT, no otro POST.
  private readonly savedSeries = new Set<string>();
  private readonly repeatByExercise = new Map<string, number>();
  private routineDayId?: string;
  // Reloj total: tiempo consolidado en pausas más diferencia desde runningSince.
  private accumulatedMs = 0;
  private runningSince = 0;
  // Map mantiene el ID devuelto por la API y las series completadas de cada ejercicio durante esta sesión.
  private readonly performedIds = new Map<string, string>();
  private readonly completedByExercise = new Map<string, Set<number>>();
  private readonly setCountOverrides = new Map<string,number>();
  private readonly setDrafts = signal(new Map<string, {weight:string; reps:string}>());
  /** La tarjeta y la tabla comparten los mismos valores, sin perderlos al pausar o volver de otra pestaña. */
  setDraft(index: number): {weight:string; reps:string} {
    return this.setDrafts().get(`${this.current()?.id}:${index}`) || (this.current()?.trainingType && this.current().trainingType !== 'POWER' ? {weight:'0',reps:'1'} : {weight:'60',reps:'8'});
  }
  updateSetDraft(index: number, field:'weight'|'reps', value:string): void {
    const drafts = new Map(this.setDrafts());
    drafts.set(`${this.current()?.id}:${index}`, {...this.setDraft(index), [field]:value});
    this.setDrafts.set(drafts);
  }
  private interval?: number;

  /** La fecha de disparo se deriva de las mismas marcas que usa el cronómetro. */
  private refreshAlarm():void {
    const phase=this.phase();
    if(!this.exercises.length||!this.running()||this.sessionFinished()||phase==='idle'||this.seriesPaused()||this.seriesFrozen) {this.alarms.trackTimer(null);return;}
    const duration=phase==='rest'?this.restSeconds():this.current().workSeconds;
    this.alarms.trackTimer({key:this.phaseAlarmId(),kind:phase,name:this.current().name,deadline:this.phaseSince+duration*1000-this.phaseMs});
  }
  /** Snapshot serializable: conserva bases y marcas de tiempo, no intervalos ni credenciales. */
  private snapshot() {
    return {
      version:1,phaseAlarmId:this.phaseAlarmId(),routineName:this.routineName(),routineDayId:this.routineDayId,selectedPlanKey:this.selectedPlanKey,
      exercises:this.exercises.map(exercise=>({...exercise})),active:this.active(),
      running:this.running(),finished:this.sessionFinished(),sessionId:this.sessionId(),
      accumulatedMs:this.accumulatedMs,runningSince:this.runningSince,
      phase:this.phase(),seriesIndex:this.seriesIndex(),phaseMs:this.seriesFrozen?this.phaseMilliseconds():this.phaseMs,phaseSince:this.phaseSince,
      frozen:this.seriesFrozen,paused:this.seriesPaused(),pendingSeries:this.pendingSeries,lastRestSeconds:this.lastRestSeconds,
      linked:this.linkedExercises(),linkedRest:this.linkedRestSeconds(),linkedRound:this.linkedRound,remainingLinked:[...this.remainingLinked],
      completed:[...this.completedByExercise].map(([id,sets])=>[id,[...sets]]),records:this.completedSeries(),setCounts:[...this.setCountOverrides],
      performed:[...this.performedIds],saved:[...this.savedSeries],repeats:[...this.repeatByExercise],drafts:[...this.setDrafts()],
    };
  }
  private persist(state=this.snapshot()):void {
    this.refreshAlarm();
    if(!this.initialized||!this.storageScope||!this.exercises.length)return;
    try {this.storage.saveState(this.storageScope,state);} catch { /* La alerta visible viene del almacenamiento. */ }
  }
  @HostListener('window:pagehide')
  @HostListener('document:visibilitychange')
  checkpoint():void {this.persist();}

  /** Valida antes de tocar la sesión: un archivo incompleto no se reemplaza por datos vacíos. */
  private restoreSnapshot(value:unknown):void {
    const data=value as any;
    const validNumber=(number:unknown)=>typeof number==='number'&&Number.isFinite(number)&&number>=0;
    if(!data||data.version!==1||!Array.isArray(data.exercises)||!data.exercises.length||data.exercises.length>300||
      !data.exercises.every((item:any)=>item&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.muscle==='string'&&typeof item.reps==='string'&&Number.isInteger(item.sets)&&item.sets>0&&item.sets<=1000&&validNumber(item.rest)&&item.rest<=3600&&validNumber(item.workSeconds)&&item.workSeconds>=1&&item.workSeconds<=3600&&Number.isInteger(item.done)&&item.done>=0&&item.done<=item.sets)||
      (data.setCounts!==undefined&&(!Array.isArray(data.setCounts)||!data.setCounts.every((entry:any)=>Array.isArray(entry)&&entry.length===2&&typeof entry[0]==='string'&&Number.isInteger(entry[1])&&entry[1]>=1&&entry[1]<=1000)))||
      !Number.isInteger(data.active)||!data.exercises[data.active]||!['idle','work','rest'].includes(data.phase)||
      !['running','finished','frozen','paused','linkedRound'].every(key=>typeof data[key]==='boolean')||
      !['accumulatedMs','runningSince','phaseMs','phaseSince','lastRestSeconds','linkedRest'].every(key=>validNumber(data[key]))||
      !['completed','records','performed','saved','repeats','drafts','linked','remainingLinked'].every(key=>Array.isArray(data[key]))||
      ![data.seriesIndex,data.pendingSeries].every(index=>index===null||(Number.isInteger(index)&&index>=0&&index<data.exercises[data.active].sets))||
      ![...data.linked,...data.remainingLinked].every(index=>Number.isInteger(index)&&data.exercises[index])||
      !data.completed.every((entry:any)=>Array.isArray(entry)&&typeof entry[0]==='string'&&Array.isArray(entry[1])&&entry[1].every((index:any)=>Number.isInteger(index)&&index>=0))||
      ![data.performed,data.repeats,data.drafts].every(entries=>entries.every((entry:any)=>Array.isArray(entry)&&entry.length===2&&typeof entry[0]==='string'))||
      (data.phase==='work'&&data.seriesIndex===null)||data.linked.length>4||new Set(data.linked).size!==data.linked.length||
      !data.performed.every((entry:any)=>typeof entry[1]==='string')||
      !data.repeats.every((entry:any)=>Number.isInteger(entry[1])&&entry[1]>=0&&data.exercises.some((item:any)=>item.id===entry[0]&&entry[1]<item.sets))||
      !data.drafts.every((entry:any)=>entry[1]&&typeof entry[1].weight==='string'&&typeof entry[1].reps==='string')||
      !data.saved.every((key:any)=>typeof key==='string')||
      !data.records.every((record:any)=>record&&typeof record.key==='string'&&typeof record.exerciseName==='string'&&data.exercises[record.exerciseIndex]?.id===record.exerciseId&&Number.isInteger(record.setNumber)&&record.setNumber>0&&record.setNumber<=data.exercises[record.exerciseIndex].sets&&validNumber(record.weightKg)&&Number.isInteger(record.repetitions)&&record.repetitions>0&&validNumber(record.durationSeconds))||
      typeof data.routineName!=='string'||typeof data.selectedPlanKey!=='string'||(data.sessionId!==null&&typeof data.sessionId!=='string'))throw Error('Respaldo inválido');
    this.phaseAlarmId.set(data.phaseAlarmId||crypto.randomUUID());
    this.setCountOverrides.clear();for(const [id,count] of data.setCounts||[])this.setCountOverrides.set(id,count);
    this.exercises=data.exercises;this.active.set(data.active);this.routineName.set(data.routineName);
    this.routineDayId=data.routineDayId;this.selectedPlanKey=data.selectedPlanKey;this.sessionId.set(data.sessionId);
    this.sessionFinished.set(data.finished);this.running.set(data.running);
    this.accumulatedMs=data.accumulatedMs;this.runningSince=data.runningSince;
    this.phase.set(data.phase);this.seriesIndex.set(data.seriesIndex);this.pendingSeries=data.pendingSeries;
    this.phaseMs=data.phaseMs;this.phaseSince=data.phaseSince;this.seriesFrozen=false;
    this.seriesPaused.set(data.paused||(data.frozen&&data.phase==='work'));this.lastRestSeconds=data.lastRestSeconds;
    this.linkedExercises.set(data.linked);this.linkedRestSeconds.set(data.linkedRest);this.linkedRound=data.linkedRound;this.remainingLinked=data.remainingLinked;
    this.completedByExercise.clear();for(const [id,sets] of data.completed)this.completedByExercise.set(id,new Set(sets));
    this.completed.set(new Set(this.completedByExercise.get(this.current().id)||[]));
    this.performedIds.clear();for(const [id,performed] of data.performed)this.performedIds.set(id,performed);
    this.savedSeries.clear();for(const key of data.saved)this.savedSeries.add(key);
    this.repeatByExercise.clear();for(const [id,index] of data.repeats)this.repeatByExercise.set(id,index);
    this.setDrafts.set(new Map(data.drafts));this.completedSeries.set(data.records);
    this.elapsedMilliseconds.set(Math.floor(data.accumulatedMs+(data.running?Math.max(0,Date.now()-data.runningSince):0)));
    this.elapsed.set(Math.floor(this.elapsedMilliseconds()/1000));
    this.phaseMilliseconds.set(data.phaseMs);this.phaseElapsed.set(Math.floor(data.phaseMs/1000));
  }
  /** Reproduce solo acciones durables que no alcanzaron a reflejarse en el último snapshot. */
  private recoverCommand(command:WorkoutCommand):void {
    if(command.kind==='START') {
      this.sessionId.set(command.sessionId);this.sessionFinished.set(false);this.running.set(true);
      this.accumulatedMs=0;this.runningSince=new Date(command.body['startedAt'] as string).getTime();
      if(this.pendingSeries!==null){this.beginSeries(this.pendingSeries);this.pendingSeries=null;this.phaseSince=this.runningSince;}
    } else if(command.kind==='EXERCISE') {
      this.performedIds.set(command.body['exerciseId'] as string,command.body['clientExerciseId'] as string);
    } else if(command.kind==='SET'||command.kind==='REPLACE') {
      const exerciseIndex=this.exercises.findIndex(item=>this.performedIds.get(item.id)===command.performedId);
      if(exerciseIndex<0)throw Error('El respaldo no contiene el ejercicio de la serie');
      this.active.set(exerciseIndex);const exercise=this.current(),index=Number(command.body['setNumber'])-1;
      const done=new Set(this.completedByExercise.get(exercise.id)||[]);done.add(index);
      this.completedByExercise.set(exercise.id,done);this.completed.set(done);exercise.done=done.size;
      this.savedSeries.add(`${exercise.id}:${index}`);this.repeatByExercise.delete(exercise.id);
      this.recordSeries(exercise,command.body as any);this.afterSavedSeries();
      this.phaseSince=new Date(command.body['completedAt'] as string).getTime();
    } else {
      this.sessionFinished.set(true);this.running.set(false);this.phase.set('idle');this.seriesIndex.set(null);
      this.accumulatedMs=Number(command.body['durationSeconds']||0)*1000;
      this.elapsedMilliseconds.set(this.accumulatedMs);this.elapsed.set(Math.floor(this.accumulatedMs/1000));
    }
  }
  recordPending(record:CompletedSeries):boolean {
    return this.storage.isPending(`${this.performedIds.get(record.exerciseId)}:${record.setNumber}`);
  }

  /** Carga el plan al crear el componente, sin iniciar ningún reloj. */
  ngOnInit(): void {
    this.initialized=true;
    if(this.storageScope) {
      try {
        const saved=this.storage.loadState(this.storageScope);
        if(saved) {this.restoreSnapshot(saved);this.recovered=true;}
        const recovery=this.storage.recoveryCommands(this.storageScope);
        for(const command of recovery)this.recoverCommand(command);
        this.storage.acknowledgeRecovery(this.storageScope,recovery.map(command=>command.id));
        if(this.running()) {this.tick();this.scheduleTicks();}
        this.persist();
      } catch {this.storage.rejectState(this.storageScope);}
    }
    this.refreshPlan();
  }
  /** Al volver a mostrar Entrenar, vuelve a consultar el plan para reflejar asignaciones recientes sin desmontar la sesión. */
  ngOnChanges(changes: SimpleChanges): void {
    if(changes['visible']&&this.running()){this.tick();this.scheduleTicks();}
    if (changes['visible']?.currentValue && !changes['visible'].firstChange) this.refreshPlan();
  }
  /** Consulta el plan de hoy e ignora respuestas antiguas. Si ya hay una sesión en curso, preserva su estado aunque cambie la asignación. */
  refreshPlan(): void {
    // Un contador identifica la solicitud más reciente para evitar que una respuesta lenta reemplace el plan nuevo.
    const request = ++this.planRequest;
    this.error.set('');
    this.loadingPlan.set(true);
    this.routines.getAll().subscribe({
      next: (routines) => {
        if (request !== this.planRequest) return;
        const weekday = new Date().getDay();
        const entries = routines.flatMap(routine => routine.days.flatMap(day => (day.schedule || []).filter(slot => slot.weekday === weekday).map(slot => ({key:`${day.id}:${slot.start}:${slot.end}`,routine,day,slot})))).sort((a,b) => a.slot.start.localeCompare(b.slot.start));
        this.todayPlan.set(entries); this.loadingPlan.set(false); this.planNotice.set('');
        if (this.sessionId() && (!this.sessionFinished() || this.recovered)) {
          if (!entries.some(entry => entry.key === this.selectedPlanKey)) this.planNotice.set('Tu sesión iniciada sigue disponible aunque su asignación ya no esté en el plan de hoy. Sus relojes y series se conservan.');
          return;
        }
        if (!entries.length) { this.exercises = []; this.routineDayId = undefined; this.selectedPlanKey = ''; this.routineName.set('Sin entrenamiento asignado hoy'); return; }
        const now = new Date(); const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const selected = entries.find(entry => entry.key === this.selectedPlanKey) || entries.find(entry => entry.slot.start <= time && time < entry.slot.end) || entries.find(entry => entry.slot.start >= time) || entries[0];
        this.selectPlannedWorkout(selected.key);
      },
      error: () => { if (request !== this.planRequest) return; this.loadingPlan.set(false); if (!this.exercises.length) this.routineName.set('Revisá tu conexión'); this.error.set('No pudimos actualizar el plan de hoy.'); },
    });
  }
  /** Carga los ejercicios de una asignación y limpia el estado de la sesión anterior; no permite cambiar una sesión en curso. */
  selectPlannedWorkout(key: string): void {
    if (this.saving() || (this.sessionId() && !this.sessionFinished())) return;
    const entry = this.todayPlan().find(entry => entry.key === key); if (!entry) return;
    if(this.selectedPlanKey!==key)this.setCountOverrides.clear();
    this.recovered=false; this.selectedPlanKey = key; this.routineDayId = entry.day.id;
    this.routineName.set(entry.day.name);
    this.exercises = entry.day.exercises.map(item => ({id:item.exercise.id,name:item.exercise.name,description:item.exercise.description,videoUrl:item.exercise.videoUrl,muscle:item.exercise.muscleGroup,sets:item.targetSets,reps:`${item.minReps}-${item.maxReps}`,rest:item.restSeconds,done:0,trainingType:item.exercise.trainingType,workSeconds:item.exercise.trainingType !== 'POWER' && item.targetDurationMinutes ? Math.min(3600, Math.max(1, Math.round(item.targetDurationMinutes*60))) : 45}));
    for(const exercise of this.exercises)exercise.sets=this.setCountOverrides.get(exercise.id)??exercise.sets;
    this.active.set(0); this.completed.set(new Set()); this.sessionFinished.set(false); this.sessionId.set(null);
    this.elapsed.set(0); this.elapsedMilliseconds.set(0); this.accumulatedMs = 0;
    this.phase.set('idle'); this.seriesIndex.set(null); this.phaseElapsed.set(0); this.phaseMilliseconds.set(0);
    this.performedIds.clear(); this.completedByExercise.clear(); this.savedSeries.clear(); this.completedSeries.set([]); this.repeatByExercise.clear(); this.linkedExercises.set([]); this.linkedRound = false; this.remainingLinked = [];
    this.persist();
  }

  /** Devuelve el ejercicio seleccionado por el índice activo. */
  current(): WorkoutExercise { return this.exercises[this.active()]; }
  tutorialUrl():string|null {
    const link=this.current()?.videoUrl;
    return link&&/^https:\/\/(?:www\.tiktok\.com\/@[\w.-]+\/video\/\d+|www\.youtube\.com\/(?:shorts\/[\w-]{11}|watch\?v=[\w-]{11})|youtu\.be\/[\w-]{11})$/.test(link)?link:null;
  }
  /** Convierte segundos a horas:minutos:segundos con dos dígitos por parte. */
  format(seconds:number): string { return [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60].map(value => String(value).padStart(2,'0')).join(':'); }
  /** Extrae la parte de milisegundos y la completa a tres dígitos. */
  millisecondDigits(milliseconds: number): string { return String(Math.max(0, Math.floor(milliseconds)) % 1000).padStart(3, '0'); }
  /** Combina el tiempo completo y la fracción de milisegundos para el cronómetro digital. */
  formatMilliseconds(milliseconds: number): string {
    const value = Math.max(0, Math.floor(milliseconds));
    return `${this.format(Math.floor(value / 1000))}.${this.millisecondDigits(value)}`;
  }

  /** Inicia o reanuda el reloj total; si hace falta, crea primero la sesión en el servidor. No se llama automáticamente al entrar. */
  play(): void {
    if (this.running() || this.saving() || !this.exercises.length) return;
    if (this.sessionFinished()) {
      this.sessionFinished.set(false); this.sessionId.set(null); this.elapsed.set(0); this.elapsedMilliseconds.set(0);
      this.accumulatedMs = 0; this.phase.set('idle'); this.seriesIndex.set(null);
      this.phaseElapsed.set(0); this.phaseMilliseconds.set(0); this.phaseMs = 0; this.seriesPaused.set(false);
      this.seriesFrozen = false; this.pendingSeries = null; this.lastRestSeconds = 0;
      this.performedIds.clear(); this.completedByExercise.clear(); this.savedSeries.clear();
      this.completedSeries.set([]); this.linkedRound = false; this.remainingLinked = [];
      this.repeatByExercise.clear(); this.completed.set(new Set());
      for (const exercise of this.exercises) exercise.done = 0;
      if (this.linkedExercises().length >= 2) this.active.set(this.linkedExercises()[0]);
    }
    this.error.set('');
    if (this.sessionId()) { this.startClock(); return; }
    this.persist();
    this.saving.set(true);
    this.sessions.start(this.routineDayId).subscribe({
      next: session => { this.sessionId.set(session.id); this.saving.set(false); this.startClock(); this.persist(); },
      error: () => { this.pendingSeries = null; this.error.set('No pudimos iniciar la sesión. Intentá nuevamente.'); this.saving.set(false); },
    });
  }

  /** Usa marcas de tiempo reales para contar también el tiempo con la pantalla bloqueada; el intervalo solo refresca la vista. */
  private startClock(): void {
    this.runningSince = Date.now();
    this.running.set(true);
    this.phaseSince = Date.now();
    if (this.pendingSeries !== null) { this.beginSeries(this.pendingSeries); this.pendingSeries = null; }
    this.scheduleTicks();
    this.persist();
  }

  /** Fuera de Entrenar evita redibujar toda la app 60 veces por segundo; el tiempo real sigue corriendo. */
  private scheduleTicks():void {
    window.clearInterval(this.interval);
    this.interval=window.setInterval(()=>this.tick(),this.visible?16:250);
  }
  /** Recalcula tiempos a partir de marcas temporales, sin sumar intervalos fijos. Cierra el descanso cuando alcanza su duración. */
  private tick(): void {
    const now = Date.now();
    this.elapsedMilliseconds.set(Math.floor(this.accumulatedMs + now - this.runningSince));
    this.elapsed.set(Math.floor(this.elapsedMilliseconds() / 1000));
    if (this.phase() !== 'idle' && !this.seriesFrozen && !this.seriesPaused()) {
      this.phaseMilliseconds.set(Math.floor(this.phaseMs + now - this.phaseSince));
      this.phaseElapsed.set(Math.floor(this.phaseMilliseconds() / 1000));
      const duration=this.phase()==='rest'?this.restSeconds():this.current().workSeconds;
      if(this.phaseElapsed()>=duration)this.alarms.timerExpired(this.phaseAlarmId());
      if (this.phase() === 'rest' && this.phaseElapsed() >= this.restSeconds()) this.endRest();
    }
  }

  /** No elimina series registradas, reabiertas o en curso al reducir el objetivo. */
  minimumSets(): number {
    const id=this.current()?.id;
    return Math.max(1,...[...this.completed()].map(index=>index+1),
      ...this.completedSeries().filter(record=>record.exerciseId===id).map(record=>record.setNumber),
      this.seriesIndex()===null?0:this.seriesIndex()!+1,
      this.pendingSeries===null?0:this.pendingSeries+1,
      (this.repeatByExercise.get(id)||0)+1);
  }
  /** Cambia solo el objetivo de esta sesión y lo incluye en el respaldo local. */
  configureSets(input: HTMLInputElement): void {
    const exercise=this.current();
    if(!exercise)return;
    const count=Number(input.value);
    if(this.saving()||this.sessionFinished()) {input.value=String(exercise.sets);return;}
    const minimum=this.minimumSets();
    if(!input.value.trim()||!Number.isInteger(count)||count<minimum||count>1000){
      this.error.set(`Usá una cantidad entera entre ${minimum} y 1000. No se pueden quitar series registradas o en curso.`);
      input.value=String(exercise.sets);return;
    }
    exercise.sets=count;
    this.setCountOverrides.set(exercise.id,count);
    this.error.set('');this.persist();
  }

  /** Edita el tiempo de una fase futura o pausada, conservando lo transcurrido. Cumplir el tiempo de serie no la guarda automáticamente. */
  configureTimer(kind: 'work' | 'rest', raw: string): void {
    if (this.saving()) return;
    if ((kind === 'work' && this.phase() === 'work' && this.running() && !this.seriesPaused()) ||
        (kind === 'rest' && this.phase() === 'rest' && this.running())) return;
    const seconds = Number(raw);
    if (!raw.trim() || !Number.isInteger(seconds) || seconds < (kind === 'work' ? 1 : 0) || seconds > 3600) { this.error.set('Usá segundos enteros: serie de 1 a 3600 y descanso de 0 a 3600.'); return; }
    if(kind===this.phase())this.phaseAlarmId.set(crypto.randomUUID());
    if (kind === 'work') this.current().workSeconds = seconds; else if (this.linkedExercises().length >= 2 && this.linkedExercises().includes(this.active())) this.linkedRestSeconds.set(seconds); else this.current().rest = seconds;
    this.error.set(''); this.persist();
  }

  /** Prioriza la serie reabierta; de lo contrario devuelve la primera pendiente, o -1 si no quedan. */
  nextSetIndex(): number {
    return this.repeatByExercise.get(this.current()?.id) ?? Array.from({ length: this.current()?.sets || 0 }, (_, i) => i).find(i => !this.completed().has(i)) ?? -1;
  }

  /** Reabre una serie completada para repetirla. Conserva su identidad guardada para actualizarla en lugar de duplicarla. */
  returnToSeries(index: number): void {
    if (this.sessionFinished()) return;
    if (this.saving() || this.phase() === 'work' || !this.completed().has(index)) return;
    if (this.phase() === 'rest') this.endRest();
    const exercise = this.current();
    // Solo se puede reabrir una serie a la vez por ejercicio.
    const previous = this.repeatByExercise.get(exercise.id);
    const next = new Set(this.completed());
    if (previous !== undefined) next.add(previous);
    next.delete(index);
    this.repeatByExercise.set(exercise.id, index);
    this.completed.set(next); this.completedByExercise.set(exercise.id, next); exercise.done = next.size;
    this.phase.set('idle'); this.seriesIndex.set(null); this.phaseElapsed.set(0); this.phaseMilliseconds.set(0);
    this.phaseMs = 0; this.seriesFrozen = false; this.seriesPaused.set(false); this.error.set('');
  }

  /** Comprueba que sea la siguiente serie disponible y solicita iniciar el reloj total si todavía está detenido. */
  startSeries(index: number): void {
    this.alarms.unlockAudio();
    if (index < 0 || index >= this.current().sets) return;
    if (this.sessionFinished()) return;
    if (this.phase() === 'work' && this.seriesIndex() === index && this.seriesPaused() && !this.saving()) { this.toggleSeriesPause(index); return; }
    if (this.saving() || this.phase() !== 'idle' || index !== this.nextSetIndex()) return;
    if (!this.running()) { this.pendingSeries = index; this.play(); return; }
    this.beginSeries(index);
  }

  /** El acceso principal reanuda la serie y el reloj total respetando ambas pausas. */
  resumeSeries(): void {
    const index = this.seriesIndex();
    if (index === null || this.saving()) return;
    if (this.seriesPaused()) this.toggleSeriesPause(index);
    else this.play();
  }

  /** Entra en fase de trabajo y reinicia únicamente el reloj de esa serie. */
  private beginSeries(index: number): void {
    this.phaseAlarmId.set(crypto.randomUUID());
    if (!this.linkedRound && this.linkedExercises().length >= 2 && this.linkedExercises().includes(this.active())) {
      this.linkedRound = true;
      const selected = this.linkedExercises(); const position = selected.indexOf(this.active());
      this.remainingLinked = [...selected.slice(position+1), ...selected.slice(0,position)].filter(item => this.exercisePending(item));
    }
    this.seriesPaused.set(false);
    this.seriesIndex.set(index); this.phase.set('work'); this.phaseElapsed.set(0); this.phaseMilliseconds.set(0);
    this.phaseMs = 0; this.phaseSince = Date.now(); this.seriesFrozen = false;
  }

  /** Pausa o reanuda solo la serie conservando su tiempo acumulado; al reanudar también activa el reloj total si hace falta. */
  toggleSeriesPause(index: number): void {
    if (this.saving() || this.phase() !== 'work' || this.seriesIndex() !== index) return;
    if (this.seriesPaused()) {
      if (!this.running()) this.play();
      this.phaseSince = Date.now();
      this.seriesPaused.set(false);
    } else {
      if (this.running() && !this.seriesFrozen) {
        this.tick();
        this.phaseMs += Date.now() - this.phaseSince;
      }
      this.seriesPaused.set(true);
    }
  }

  /** Vuelve a cero el tiempo de la serie actual y la deja pausada para que el usuario decida cuándo arrancar. */
  restartSeries(index: number): void {
    if (this.saving() || this.phase() !== 'work' || this.seriesIndex() !== index) return;
    this.phaseAlarmId.set(crypto.randomUUID());
    this.phaseMs = 0; this.phaseElapsed.set(0); this.phaseMilliseconds.set(0); this.phaseSince = Date.now();
    this.seriesFrozen = false; this.seriesPaused.set(true); this.error.set('');
  }

  /** Reinicia el descanso completo y lo deja pausado sin borrar series ni reiniciar el total. */
  restartRest(): void {
    if (this.saving() || this.phase() !== 'rest') return;
    this.pause();
    this.phaseAlarmId.set(crypto.randomUUID());
    this.phase.set('rest'); this.phaseMs = 0; this.phaseElapsed.set(0); this.phaseMilliseconds.set(0);
    this.phaseSince = Date.now(); this.seriesFrozen = false; this.seriesPaused.set(false);
  }

  /** Registra los segundos de descanso, sale de esa fase y deja disponible la siguiente serie. */
  endRest(): void {
    if (this.phase() !== 'rest') return;
    const seconds = this.running() ? Math.floor((this.phaseMs + Date.now() - this.phaseSince) / 1000) : this.phaseElapsed();
    this.lastRestSeconds = Math.min(this.restSeconds(), seconds);
    this.phase.set('idle'); this.seriesIndex.set(null); this.phaseElapsed.set(0); this.phaseMilliseconds.set(0); this.phaseMs = 0;
    if (this.linkedRound) {
      const restTaken = this.lastRestSeconds;
      this.linkedRound = false; this.remainingLinked = [];
      const next = this.linkedExercises().find(index => this.exercisePending(index));
      if (next !== undefined) { this.selectExercise(next); this.lastRestSeconds = restTaken; }
    }
  }

  /** Reinicia solo el total y deja los relojes pausados, conservando series y tiempo de la fase actual. */
  restartTotalTimer(): void {
    if (this.saving() || this.sessionFinished()) return;
    this.pause();
    this.accumulatedMs = 0; this.runningSince = Date.now();
    this.elapsed.set(0); this.elapsedMilliseconds.set(0);
  }

  /** Detiene los relojes mediante pause; no finaliza la sesión, no guarda una serie y no cambia de página. */
  stopTimer(): void {
    if (this.saving() || this.sessionFinished()) return;
    this.pause();
  }

  /** Consolida los milisegundos acumulados, detiene la actualización periódica y conserva todos los datos para reanudar. */
  pause(): void {
    if (!this.running()) return;
    this.tick();
    if (this.phase() !== 'idle' && !this.seriesFrozen && !this.seriesPaused()) this.phaseMs += Date.now() - this.phaseSince;
    this.accumulatedMs += Date.now() - this.runningSince;
    this.elapsedMilliseconds.set(Math.floor(this.accumulatedMs));
    this.elapsed.set(Math.floor(this.accumulatedMs / 1000));
    this.running.set(false);
    window.clearInterval(this.interval);
    this.interval = undefined;
  }

  /** Guarda cada serie por separado; después prepara el siguiente ejercicio del grupo o inicia el descanso. */
  completeSet(index:number, weightValue:string, repsValue:string): void {
    if (!weightValue.trim() || !repsValue.trim()) { this.error.set('Completá el peso y las repeticiones.'); return; }
    if (!this.running() || this.saving() || this.completed().has(index) || this.phase() !== 'work' || this.seriesIndex() !== index) return;
    const sessionId = this.sessionId(); const exercise = this.current();
    const weightKg = Number(weightValue); const repetitions = Number(repsValue);
    if (!sessionId || !exercise || !Number.isFinite(weightKg) || weightKg < 0 || !Number.isInteger(repetitions) || repetitions < 1) { this.error.set('Revisá el peso y las repeticiones'); return; }
    this.updateSetDraft(index, 'weight', weightValue); this.updateSetDraft(index, 'reps', repsValue);
    this.tick(); this.seriesFrozen = true;
    this.saving.set(true); this.error.set('');
    const existing = this.performedIds.get(exercise.id);
    // El sufijo $ identifica un Observable. of reutiliza el ID existente; map extrae y recuerda el ID recién creado.
    const performedId$ = existing ? of(existing) : this.sessions.addExercise(sessionId, exercise.id, this.active()+1).pipe(map(performed => { this.performedIds.set(exercise.id, performed.id); return performed.id; }));
    const seriesKey = `${exercise.id}:${index}`;
    const data = { setNumber:index+1, weightKg, repetitions, durationSeconds:this.phaseElapsed(), actualRestSeconds:this.lastRestSeconds };
    // switchMap encadena el guardado de la serie después de obtener el ejercicio realizado. subscribe recibe éxito o error.
    performedId$.pipe(switchMap(performedId => this.savedSeries.has(seriesKey)
      ? this.sessions.replaceSet(sessionId, performedId, data)
      : this.sessions.addSet(sessionId, performedId, data))).subscribe({
      next: () => { this.savedSeries.add(seriesKey); this.recordSeries(exercise, data); this.repeatByExercise.delete(exercise.id); const next = new Set(this.completed()); next.add(index); this.completed.set(next); this.completedByExercise.set(exercise.id, next); exercise.done=next.size; this.saving.set(false); this.afterSavedSeries(); this.persist(); },
      error: () => { this.error.set('No pudimos guardar la serie'); this.saving.set(false); },
    });
  }

  /** Cambia el ejercicio solo entre fases y recupera cuáles de sus series están completadas. */
  selectExercise(index:number): void { if (this.phase() !== 'idle' || this.saving() || !Number.isInteger(index) || !this.exercises[index]) return; this.active.set(index); this.lastRestSeconds = 0; this.completed.set(new Set(this.completedByExercise.get(this.current().id) || [])); }
  /** Recorre los pendientes en círculo para poder dejar el primer ejercicio para el final. */
  nextExercise(): void {
    if (this.phase() !== 'idle' || this.saving()) return;
    if (this.linkedExercises().length >= 2) {
      const linkedNext = this.linkedExercises().find(index => this.exercisePending(index));
      if (linkedNext !== undefined) { this.selectExercise(linkedNext); return; }
      const next = this.exercises.findIndex((_,index) => this.exercisePending(index));
      if (next >= 0) { this.linkedExercises.set([]); this.selectExercise(next); return; }
      this.finishSession(true); return;
    }
    const next = Array.from({length:this.exercises.length}, (_,offset) => (this.active()+offset+1) % this.exercises.length).find(index => this.exercisePending(index));
    if (next !== undefined) { this.selectExercise(next); return; }
    this.finishSession(true);
  }
  /** Finaliza explícitamente la sesión en la API con su duración activa. No permite finalizar con una serie de trabajo abierta. */
  finishSession(stayOnPage = false): void {
    if (this.saving() || this.sessionFinished()) return;
    if (this.phase() === 'work') { this.error.set('Pulsá Stop en la serie para guardarla antes de finalizar la sesión.'); return; }
    const sessionId = this.sessionId(); if (!sessionId) return;
    this.pause();
    this.saving.set(true); this.error.set('');
    this.sessions.finish(sessionId, this.elapsed()).subscribe({
      next: () => {
        if (this.phase() === 'rest') this.endRest();
        this.sessionFinished.set(true); this.saving.set(false); this.persist();
        if (!stayOnPage) this.router.navigateByUrl('/progreso');
      },
      error: () => { this.error.set('No pudimos finalizar la sesión. Podés reintentar o reanudar.'); this.saving.set(false); },
    });
  }
  /** Libera el intervalo al destruir el componente para evitar actualizaciones de una instancia que ya no existe. */
  ngOnDestroy(): void { this.persist(); window.clearInterval(this.interval); }
  constructor() {
    effect(() => { this.phaseElapsed(); this.refreshAlarm(); });
    effect(() => {
      // Persiste segundos y cambios de estado, sin escribir en cada fotograma.
      this.elapsed(); this.phaseElapsed();
      const state = this.snapshot();
      if (this.initialized) this.persist(state);
    });
  }
}
