/**
 * Pantalla de progreso y rankings. Consume el resumen y el ranking por ejercicio; el volumen mostrado se calcula sobre las sesiones recientes recibidas.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, Input, OnChanges, SimpleChanges, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ExerciseLeaderboard, ProgressService, WeightEntry, StrengthRecord } from '../services/progress.service';
import { AuthService } from '../services/auth.service';
import {RouterLink} from '@angular/router';

@Component({
  selector:'app-progress',
  standalone: true,
  imports: [DatePipe, DecimalPipe,RouterLink],
  // Todas las métricas y mediciones se obtienen de la API; no se muestran gráficas de ejemplo.
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    <section class="page progress"><span class="kicker">TU EVOLUCIÓN</span><h1>Progreso que se ve.</h1><p class="lead">Tus calorías, entrenamientos y mejores marcas, en un solo lugar.</p>
      @if(summaryLoading()) {<p role="status">Cargando tu progreso…</p>} @if(summaryError()) {<p class="summary-error" role="alert">{{summaryError()}}</p><button class="button ghost" type="button" (click)="loadSummary()">Reintentar</button>}
      <div class="metrics"><article><span>CALORÍAS QUEMADAS</span><strong>{{calories() | number:'1.0-0'}}<small> kcal</small></strong><em>Estimadas · todas tus sesiones completadas</em></article><article><span>PESO CORPORAL</span><strong>{{showWeight() ? weight() : '•••'}}<small> kg</small></strong><button class="weight-toggle" type="button" (click)="toggleWeight()" [attr.aria-pressed]="showWeight()">{{showWeight() ? 'Ocultar peso' : 'Mostrar peso'}}</button></article><article><span>VOLUMEN TOTAL</span><strong>{{ volume() }}<small>t</small></strong><em>sesiones recientes</em></article><article><span>ENTRENAMIENTOS</span><strong>{{ sessions() }}</strong><em>completados</em></article></div>
      <div class="content"><article class="chart"><span class="kicker">TUS MEDICIONES</span><h2>Historial de peso</h2><form class="weight-form" (submit)="registerWeight($event, measurement.value, measurementDate.value)"><label>Peso de hoy (kg)<input #measurement type="number" min="0.01" max="500" step="0.01" required placeholder="Ej. 72,5" [value]="weightDraft()" (input)="weightDraft.set($any($event.target).value)" [disabled]="weightSaving()"></label><label>Fecha y hora<input #measurementDate type="datetime-local" required [value]="measurementDateDraft()" (input)="measurementDateDraft.set($any($event.target).value)" [disabled]="weightSaving()"></label><button type="submit" class="button primary" [disabled]="weightSaving()">{{weightSaving() ? 'Guardando…' : 'Registrar peso'}}</button></form>@if(weightError()) {<p class="summary-error" role="alert">{{weightError()}}</p>}@if(weightSaved()) {<p class="weight-success" role="status">Medición guardada.</p>}<p class="history-help">Últimas 30 mediciones, con fecha y hora.</p><p class="history-help">Se muestra cuando elegís hacer visible tu peso.</p>@for(entry of weights(); track entry.id) {<div class="weight-entry"><time>{{entry.recordedAt | date:'dd/MM/yyyy HH:mm'}}</time><strong>@if(showWeight()) {{{entry.weightKg | number:'1.1-1'}}} @else {•••}<small> kg</small></strong></div>} @empty {<p class="empty">Todavía no tenés mediciones de peso registradas.</p>}</article>
      <article class="records"><span class="kicker">RÉCORDS RECIENTES</span><h2>Mejores marcas</h2><p class="history-help">Mayor carga por ejercicio en tus sesiones completadas. Las series sin carga no generan marcas de fuerza.</p>@for(record of records();track record.name){<div><span>{{record.name}}<small>{{record.date}}</small></span><strong>{{record.value}} <i>kg</i></strong></div>} @empty {<p class="empty">Todavía no hay récords registrados.</p>}</article></div>
      <section class="leaderboard" aria-labelledby="ranking-title"><div class="ranking-head"><div><span class="kicker">LA COMUNIDAD LEVANTA</span><h2 id="ranking-title">Ranking de fuerza</h2></div><button type="button" (click)="loadLeaderboard()" [disabled]="rankingLoading()">↻ Actualizar</button></div>
        <p>Mayor carga de cada usuario en una serie registrada de una sesión completada. Los empates en peso comparten posición.</p>
        @if(auth.user()?.leaderboardOptIn===false){<p class="ranking-note">Tu participación en el ranking público está desactivada. Tus marcas personales se muestran arriba. <a routerLink="/privacidad/ajustes">Gestionar participación</a></p>}<div class="ranking-tabs" role="tablist" aria-label="Ejercicio del ranking">@for (exercise of leaderboards(); track exercise.key) {<button type="button" role="tab" [attr.aria-selected]="selectedExercise() === exercise.key" [class.active]="selectedExercise() === exercise.key" (click)="selectedExercise.set(exercise.key)">{{exercise.name}}</button>}</div>
        @if (rankingLoading()) {<p role="status">Cargando marcas de la comunidad…</p>} @else if (rankingError()) {<p class="ranking-error" role="alert">{{rankingError()}}</p>} @else {
          <div class="ranking-scroll"><table><caption>{{selectedBoard()?.name}} · mejores marcas</caption><thead><tr><th>POSICIÓN</th><th>USUARIO</th><th>EJERCICIO</th><th>PESO</th><th>REPS</th><th>FECHA</th></tr></thead><tbody>@for (user of selectedBoard()?.users || []; track user.userId) {<tr [class.my-rank]="user.isCurrentUser"><td><span class="rank-number" [class.podium]="user.rank <= 3">{{user.rank}}</span></td><td><b>{{user.name}}</b>@if (user.isCurrentUser) {<span class="you-label">Vos</span>}</td><td>{{user.exerciseName || selectedBoard()?.name}}</td><td><strong>{{user.weightKg | number:'1.0-2'}} <small>kg</small></strong></td><td>{{user.repetitions}}</td><td>{{user.achievedAt | date:'dd/MM/yyyy'}}</td></tr>} @empty {<tr><td colspan="6" class="empty-ranking">Todavía no hay marcas de este ejercicio en sesiones completadas.</td></tr>}</tbody></table></div>
        }
        <p class="ranking-note">Agrupamos las variantes de sentadilla, press de banca y peso muerto, incluido el rumano. Mostramos la mejor carga de cada persona y el ejercicio realizado. Las cargas de distintas variantes no son equivalentes.</p>
      </section>
    </section>
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles:[`
    .weight-form{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:22px 0}.weight-form label{display:flex;flex:1;min-width:140px;flex-direction:column;gap:8px;font-size:13px}.weight-form input{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:18px}.weight-form button{min-height:48px}.weight-success{color:var(--lime);font-size:13px}
    .progress .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.weight-toggle{border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:transparent;color:var(--muted);cursor:pointer}.weight-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;border-top:1px solid var(--line)}.weight-entry time,.history-help{font-size:13px;color:var(--muted)}.weight-entry strong{font-size:20px}.weight-entry small{font-size:12px;color:var(--muted)}.summary-error{color:#fca5a5}.metrics em{line-height:1.6}.progress h1{font-size:clamp(34px,5vw,54px)}@media(max-width:550px){.progress .metrics{grid-template-columns:1fr}}
    .leaderboard{margin-top:24px;padding:28px;background:var(--surface);border:1px solid var(--line);border-radius:20px}.ranking-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.ranking-head h2{margin:8px 0;font-size:28px}.ranking-head>button{border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:9px;padding:10px 13px;cursor:pointer;font-size:12px}.leaderboard>p{font-size:12px;line-height:1.7;color:var(--muted)}.ranking-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}.ranking-tabs button{padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--muted);cursor:pointer;font-size:12px}.ranking-tabs button.active{background:var(--lime);border-color:var(--lime);color:#0b130d;font-weight:800}.ranking-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:500px;text-align:left}caption{text-align:left;font-size:13px;font-weight:700;margin-bottom:16px}th{font-size:9px;letter-spacing:.1em;color:var(--muted);padding:12px 10px}td{padding:15px 10px;border-top:1px solid var(--line);font-size:12px}td strong{color:var(--lime);font-size:19px}td small{font-size:11px;color:var(--muted)}.rank-number{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--surface-2);color:var(--muted);font-weight:800}.rank-number.podium{background:#fbbf2415;color:#fbbf24}.my-rank{background:#a3e63508}.you-label{display:inline-block;color:var(--lime);font-size:9px;padding:4px 6px;margin-left:8px;border:1px solid #a3e63540;border-radius:5px}.empty-ranking{text-align:center;color:var(--muted);padding:30px}.leaderboard .ranking-error{color:#fca5a5}.leaderboard .ranking-note{font-size:10px;margin:18px 0 0}@media(max-width:550px){.leaderboard{padding:18px}.ranking-head h2{font-size:23px}}.progress{padding-top:58px;padding-bottom:80px}.kicker{color:var(--lime);font-size:11px;letter-spacing:.18em;font-weight:800}.progress>h1{font-size:clamp(46px,6vw,72px);letter-spacing:-.05em;margin:12px 0}.lead{color:var(--muted);font-size:17px;max-width:580px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:20px;overflow:hidden;margin:44px 0 20px}.metrics article{background:var(--surface);padding:28px}.metrics article>span{display:block;color:var(--muted);font-size:10px;letter-spacing:.13em}.metrics strong{font-size:42px;display:block;margin:14px 0 7px}.metrics small{font-size:16px;color:var(--muted)}.metrics em{font-size:12px;color:var(--lime);font-style:normal}.content{display:grid;grid-template-columns:1.65fr 1fr;gap:20px}.chart,.records{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:28px}.chart h2,.records h2{font-size:23px;margin:8px 0}svg{width:100%;height:240px;margin-top:12px;overflow:visible}.records>div{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-top:1px solid var(--line)}.records>div span{display:flex;flex-direction:column;font-weight:700}.records>div small{color:var(--muted);margin-top:5px;font-weight:400}.records>div strong{font-size:21px}.records i{font-size:11px;color:var(--muted);font-style:normal}.empty{color:var(--muted);font-size:13px;border-top:1px solid var(--line);padding-top:20px}@media(max-width:750px){.metrics{grid-template-columns:1fr}.content{grid-template-columns:1fr}.progress{padding-top:38px}.metrics article{padding:20px}.chart{padding:20px}}
  `]
})
export class ProgressComponent implements OnInit, OnChanges {
  @Input() visible=true;
  ngOnChanges(changes:SimpleChanges):void {if(changes['visible']?.currentValue&&!changes['visible'].firstChange){this.showWeight.set(localStorage.getItem(this.weightKey)==='true');this.ngOnInit();}}

  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly progress = inject(ProgressService);
  protected readonly auth = inject(AuthService);
  // datetime-local usa la hora del dispositivo; al enviar se convierte a UTC.
  readonly measurementDateDraft = signal(this.localDateTime());
  private localDateTime(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  readonly weightDraft = signal('');
  readonly weightSaving = signal(false);
  readonly weightError = signal('');
  readonly weightSaved = signal(false);
  /** Agrega una medición; solo actualiza la lista después de la confirmación del servidor. */
  registerWeight(event: Event, raw: string, dateValue = this.measurementDateDraft()): void {
    event.preventDefault();
    if (this.weightSaving()) return;
    const value = Number(raw.replace(',', '.'));
    this.weightSaved.set(false); this.weightError.set('');
    if (!raw.trim() || !Number.isFinite(value) || value <= 0 || value > 500) { this.weightError.set('Ingresá un peso mayor que 0 y hasta 500 kg.'); return; }
    const date = new Date(dateValue);
    if (!dateValue || !Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { this.weightError.set('Elegí una fecha y hora válida que no sea futura.'); return; }
    this.weightSaving.set(true);
    this.progress.addWeight(value, date.toISOString()).subscribe({next: entry => {
      this.weights.set([entry, ...this.weights()].sort((a,b) => new Date(b.recordedAt).getTime()-new Date(a.recordedAt).getTime()).slice(0,30)); this.weight.set(Number(this.weights()[0].weightKg).toFixed(1));
      this.weightDraft.set(''); this.weightSaving.set(false); this.weightSaved.set(true);
      this.auth.refreshProfile().subscribe({error: () => {}});
    }, error: () => { this.weightSaving.set(false); this.weightError.set('No pudimos guardar el peso. Tus datos siguen acá para reintentar.'); }});
  }
  readonly calories = signal(0);
  readonly weights = signal<WeightEntry[]>([]);
  readonly summaryLoading = signal(true);
  readonly summaryError = signal('');
  readonly showWeight = signal(localStorage.getItem(this.weightKey) === 'true');
  private get weightKey(): string { return `smartgymbro_show_weight_${this.auth.user()?.id || 'guest'}`; }
  toggleWeight(): void { this.showWeight.update(value => !value); localStorage.setItem(this.weightKey, String(this.showWeight())); }
  readonly weight = signal('—'); readonly volume = signal('0.0'); readonly sessions = signal(0);
  readonly records = signal<Array<{name:string;date:string;value:number}>>([]);
  readonly leaderboards = signal<ExerciseLeaderboard[]>([]);
  readonly selectedExercise = signal('bench');
  readonly rankingLoading = signal(false);
  readonly rankingError = signal('');
  readonly selectedBoard = computed(() => this.leaderboards().find(board => board.key === this.selectedExercise()));
  /** Carga las categorías del ranking y controla los estados de espera y error para permitir reintentos. */
  loadLeaderboard(): void {
    if (this.rankingLoading()) return;
    this.rankingLoading.set(true); this.rankingError.set('');
    this.progress.getLeaderboard().subscribe({ next: result => { this.leaderboards.set(result.exercises); this.rankingLoading.set(false); }, error: () => { this.rankingLoading.set(false); this.rankingError.set('No pudimos cargar el ranking. Intentá actualizarlo.'); } });
  }
  /** Carga ranking y resumen; transforma mediciones y registros al formato que muestra la pantalla. */
  ngOnInit(): void {
    this.loadLeaderboard();
    this.loadSummary();
  }
  /** Reúne las métricas antes repartidas en Inicio y conserva una mejor marca por ejercicio. */
  loadSummary(): void {
    this.summaryLoading.set(true); this.summaryError.set('');
    this.progress.getSummary().subscribe({next: summary => {
      const weights = [...summary.weights].sort((a,b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
      this.weights.set([...weights].reverse());
      const latestWeight = weights.at(-1); const currentWeight = latestWeight?.weightKg ?? this.auth.user()?.currentKg;
      this.weight.set(currentWeight != null ? Number(currentWeight).toFixed(1) : '—');
      this.calories.set(summary.totalCalories);
      this.volume.set((summary.sessions.reduce((sum, session) => sum + Number(session.totalVolumeKg || 0), 0) / 1000).toFixed(1));
      this.sessions.set(summary.completedSessions);
      const best = new Map<string, StrengthRecord>();
      for (const record of summary.records) if (!best.has(record.exercise.name) || Number(best.get(record.exercise.name)!.maxWeightKg) < Number(record.maxWeightKg)) best.set(record.exercise.name, record);
      this.records.set([...best.values()].map(record => ({ name:record.exercise.name, date:new Date(record.achievedAt).toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).toUpperCase(), value:Number(record.maxWeightKg) })));
      this.summaryLoading.set(false);
    }, error: () => { this.summaryLoading.set(false); this.summaryError.set('No pudimos cargar tu progreso. Intentá nuevamente.'); }});
  }
}
