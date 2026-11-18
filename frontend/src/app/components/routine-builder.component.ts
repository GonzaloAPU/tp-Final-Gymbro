/**
 * Editor de rutinas: carga el catálogo, filtra ejercicios y configura objetivos. Mantiene internamente un único bloque RoutineDay por compatibilidad con el modelo del backend.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService } from '../services/exercise.service';
import { Exercise, RoutineService } from '../services/routine.service';

type TrainingType = 'POWER' | 'AEROBIC' | 'ANAEROBIC';
type Intensity = 'BAJA' | 'MEDIA' | 'ALTA';

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
interface BuilderItem {
  exercise: Exercise;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  targetDurationMinutes: number | null;
  targetDistanceKm: number | null;
  intensity: Intensity | null;
}

// Contrato de datos: describe campos y tipos para detectar errores durante la compilación.
interface BuilderDay { name: string; items: BuilderItem[]; }

@Component({
  standalone: true,
  imports: [RouterLink],
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    <section class="page builder">
      <header class="page-head">
        <div><a routerLink="/" class="back-link">← Volver al inicio</a><h1>Crear rutina</h1><p>{{step() === 1 ? 'Primero, poné un nombre que reconozcas fácilmente.' : step() === 2 ? 'Agregá los ejercicios que vas a hacer. Podés ajustar sus valores.' : 'Revisá tu rutina antes de guardarla.'}}</p></div>
      </header>
      <ol class="steps" aria-label="Pasos para crear la rutina"><li [class.current]="step()===1" [attr.aria-current]="step()===1 ? 'step' : null"><b>1</b> Nombre</li><li [class.current]="step()===2" [attr.aria-current]="step()===2 ? 'step' : null"><b>2</b> Ejercicios</li><li [class.current]="step()===3" [attr.aria-current]="step()===3 ? 'step' : null"><b>3</b> Revisar</li></ol>
      @if (error()) { <div class="notice error" role="alert">{{error()}}</div> }
      <div class="builder-grid" [class.single-step]="step() !== 2">
        <main class="plan">
          @if (step() === 1) {
          <h2>¿Cómo se llama tu rutina?</h2>
          @if (!currentDay().items.length) {
            <p class="step-help">Empezá con una propuesta editable:</p>
            @for (proposal of proposals; track proposal.name) {<button type="button" class="button ghost" style="margin:4px" (click)="loadProposal(proposal)" [disabled]="catalogLoading() || !!catalogError()">{{proposal.name}}</button>}
          }
          <section class="routine-data">
            <label>Nombre de la rutina<input [value]="routineName()" (input)="routineName.set($any($event.target).value)" placeholder="Ej. Espalda y bíceps" maxlength="255"></label>
            <label>Objetivo principal<select [value]="goal()" (change)="goal.set($any($event.target).value)"><option>Fuerza</option><option>Hipertrofia</option><option>Resistencia</option><option>Cardio</option><option>Rendimiento mixto</option></select></label>
          </section>
          <p class="step-help">Los días y horarios se eligen después de guardar. Podés usar esta misma rutina varios días.</p>
          }
          @if (step() === 2) {
          <section class="day-card">
            <h2 class="exercise-list-title">{{routineName()}} · {{currentDay().items.length}} ejercicios</h2>
            <div class="columns"><span>EJERCICIO</span><span>OBJETIVO</span><span></span></div>
            @for (item of currentDay().items; track item.exercise.id; let itemIndex=$index) {
              <article class="exercise-item">
                <div class="exercise-info"><span class="type" [attr.data-type]="item.exercise.trainingType">{{typeLabel(item.exercise.trainingType)}}</span><strong>{{item.exercise.name}}</strong><small>{{item.exercise.muscleGroup}} · {{item.exercise.equipment}}</small></div>
                @if (item.exercise.trainingType === 'POWER') {
                  <div class="targets power"><label>Series<input type="number" min="1" [value]="item.targetSets" (input)="updateNumber(itemIndex,'targetSets',$any($event.target).value)"></label><label>Reps mín.<input type="number" min="1" [value]="item.minReps" (input)="updateNumber(itemIndex,'minReps',$any($event.target).value)"></label><label>Reps máx.<input type="number" min="1" [value]="item.maxReps" (input)="updateNumber(itemIndex,'maxReps',$any($event.target).value)"></label><label>Descanso (segundos)<input type="number" min="0" [value]="item.restSeconds" (input)="updateNumber(itemIndex,'restSeconds',$any($event.target).value)"></label></div>
                } @else {
                  <div class="targets cardio">@if(item.exercise.trainingType === 'ANAEROBIC'){<label>Rondas<input type="number" min="1" [value]="item.targetSets" (input)="updateNumber(itemIndex,'targetSets',$any($event.target).value)"></label>}<label>Minutos<input type="number" min="1" [value]="item.targetDurationMinutes" (input)="updateNumber(itemIndex,'targetDurationMinutes',$any($event.target).value)"></label><label>Distancia km<input type="number" min="0" step="0.1" [value]="item.targetDistanceKm" (input)="updateNumber(itemIndex,'targetDistanceKm',$any($event.target).value)"></label><label>Intensidad<select [value]="item.intensity" (change)="updateIntensity(itemIndex,$any($event.target).value)"><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></select></label></div>
                }
                <button class="remove" type="button" (click)="removeExercise(itemIndex)" aria-label="Quitar ejercicio">×</button>
              </article>
            } @empty {<div class="empty"><strong>Tu rutina todavía está vacía</strong><span>Buscá un ejercicio y tocá «Agregar».</span></div>}
          </section>
          }
          @if (step() === 3) {
            <h2>{{routineName()}}</h2><p class="step-help">{{goal()}} · {{currentDay().items.length}} ejercicios</p>
            <ol class="review-list">@for (item of currentDay().items; track item.exercise.id) {<li><strong>{{item.exercise.name}}</strong><span>@if(item.exercise.trainingType === 'POWER') {{{item.targetSets}} series · {{item.minReps}}–{{item.maxReps}} repeticiones · {{item.restSeconds}} s de descanso} @else {{{item.targetDurationMinutes}} minutos · {{item.intensity}}}</span></li>}</ol>
            <p class="step-help">Se guardará en tus Rutinas. Después podés asignarle días y horarios desde Inicio.</p>
          }
        </main>
        @if (step() === 2) {
        <aside class="catalog">
          <div><h2>Agregar ejercicios</h2><p>Buscá por nombre y tocá «Agregar».</p></div>
          <p role="status" class="exercise-success">{{currentDay().items.length}} ejercicios agregados a tu rutina.</p>
          @if (catalogLoading()) {<p role="status">Cargando ejercicios…</p>}
          @if (catalogError()) {<p class="notice error" role="alert">{{catalogError()}}</p><button class="button ghost" type="button" (click)="loadCatalog()">Reintentar carga</button>}
          <label>Buscar ejercicio<input type="search" placeholder="Ej. Press de banca" [value]="search()" (input)="search.set($any($event.target).value)"></label>
          <button type="button" class="new-exercise-toggle" (click)="showExerciseForm.set(!showExerciseForm())" [disabled]="creatingExercise()" [attr.aria-expanded]="showExerciseForm()">¿No lo encontrás? Crear un ejercicio</button>
          @if (showExerciseForm()) {
            <p class="exercise-help">Los ejercicios que creás son privados. Solo vos podés verlos y agregarlos a tus rutinas.</p><form class="new-exercise-card" (submit)="createExercise($event, exerciseName.value, muscle.value, equipment.value, movement.value, training.value)">
              <h3>Agregar ejercicio</h3>
              <label>Nombre<input #exerciseName required minlength="2" maxlength="255" placeholder="Ej. Sentadilla búlgara" [disabled]="creatingExercise()"></label>
              <label>Grupo muscular<input #muscle required minlength="2" maxlength="255" placeholder="Ej. Piernas" list="exercise-muscles" [disabled]="creatingExercise()"><datalist id="exercise-muscles">@for (group of muscleGroups(); track group) {<option [value]="group"></option>}</datalist></label>
              <label>Equipamiento<input #equipment required minlength="2" maxlength="255" placeholder="Ej. Mancuernas o peso corporal" [disabled]="creatingExercise()"></label>
              <label>Patrón de movimiento (opcional)<input #movement maxlength="255" placeholder="Ej. Sentadilla unilateral" [disabled]="creatingExercise()"></label>
              <label>Tipo de entrenamiento<select #training [disabled]="creatingExercise()"><option value="POWER">Fuerza / Power</option><option value="AEROBIC">Aeróbico</option><option value="ANAEROBIC">Anaeróbico</option></select></label>
              <p>Se guarda en el catálogo y se agrega a tu rutina.</p>
              @if (exerciseError()) {<div class="notice error" role="alert">{{exerciseError()}}</div>}
              <div class="new-exercise-actions"><button type="button" (click)="showExerciseForm.set(false)" [disabled]="creatingExercise()">Cancelar</button><button type="submit" class="button primary" [disabled]="creatingExercise() || saving()">{{creatingExercise() ? 'Guardando…' : 'Guardar ejercicio'}}</button></div>
            </form>
          }
          @if (exerciseMessage()) {<p class="exercise-success" role="status">{{exerciseMessage()}}</p>}
          <label>Tipo de entrenamiento<select [value]="typeFilter()" (change)="typeFilter.set($any($event.target).value)"><option value="ALL">Todos</option><option value="POWER">Fuerza / Power</option><option value="AEROBIC">Aeróbico</option><option value="ANAEROBIC">Anaeróbico</option></select></label>
          <label>Grupo muscular<select [value]="muscleFilter()" (change)="muscleFilter.set($any($event.target).value)"><option value="ALL">Todos los grupos</option>@for(group of muscleGroups();track group){<option [value]="group">{{group}}</option>}</select></label>
          <div class="catalog-list">@for(exercise of filteredExercises();track exercise.id){<button type="button" (click)="addExercise(exercise.id)" [disabled]="hasExercise(exercise.id)" [attr.aria-label]="(hasExercise(exercise.id) ? 'Agregado: ' : 'Agregar ') + exercise.name"><div><strong>{{exercise.name}}</strong><small>{{exercise.createdByUserId ? 'Personal · ' : 'Oficial · '}}{{exercise.muscleGroup}} · {{exercise.equipment}}</small></div><b>{{hasExercise(exercise.id) ? '✓ Agregado' : '+ Agregar'}}</b></button>} @empty {<p>No hay ejercicios con esos filtros.</p>}</div>
        </aside>
        }
      </div>
      <footer class="builder-footer"><span>Paso {{step()}} de 3</span><div>@if(step() > 1) {<button class="button ghost" type="button" (click)="previousStep()" [disabled]="saving() || creatingExercise()">← Atrás</button>}@if(step() < 3) {<button class="button primary" type="button" (click)="nextStep()" [disabled]="creatingExercise()">{{step() === 1 ? 'Elegir ejercicios →' : 'Revisar rutina →'}}</button>} @else {<button class="button primary" type="button" (click)="save()" [disabled]="saving()">{{saving() ? 'Guardando…' : 'Guardar mi rutina'}}</button>}</div></footer>
    </section>
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .back-link{color:var(--muted);font-size:14px}.steps{display:flex;gap:12px;list-style:none;padding:0;margin:0 0 24px}.steps li{flex:1;display:flex;align-items:center;gap:8px;color:var(--muted);padding:12px 0;border-bottom:3px solid var(--line);font-size:14px}.steps b{width:25px;height:25px;display:grid;place-items:center;background:var(--surface-2);border-radius:50%}.steps li.current{color:var(--lime);border-color:var(--lime);font-weight:800}.single-step{grid-template-columns:1fr!important;max-width:760px}.step-help{color:var(--muted);line-height:1.6;font-size:14px}.review-list{padding-left:22px}.review-list li{padding:16px 0;border-bottom:1px solid var(--line)}.review-list strong,.review-list span{display:block;margin-bottom:7px}.review-list span{color:var(--muted);font-size:14px}.builder-footer{position:sticky;bottom:0;z-index:8;background:#111827f5;border:1px solid var(--line);border-radius:16px;margin-top:24px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:12px}.builder-footer>span{font-size:12px;color:var(--muted)}.builder-footer>div{display:flex;gap:8px}.catalog .catalog-list button{grid-template-columns:minmax(0,1fr) auto;gap:10px;min-height:64px}.catalog .catalog-list b{font-size:12px}.catalog .new-exercise-toggle{border:0;color:var(--muted);background:transparent;text-align:left;margin:0 0 12px;padding:8px 0}.catalog .catalog-list{max-height:none}.builder .day-card{margin-top:0}.builder .empty{padding:24px 8px;text-align:center;line-height:1.6}@media(max-width:950px){.builder-grid:not(.single-step){display:flex;flex-direction:column}.catalog{order:-1}}@media(max-width:680px){.builder{padding-top:22px}.builder-footer{bottom:calc(76px + env(safe-area-inset-bottom));padding:12px}.builder-footer>span{display:none}.builder-footer>div{width:100%;justify-content:space-between}.builder-footer .primary{flex:1}.page-head h1{font-size:34px!important}.steps{gap:7px}.steps li{font-size:12px}.catalog .catalog-list{max-height:340px}.targets label{font-size:12px!important}}
    .new-exercise-toggle{width:100%;border:1px dashed #a3e63565;border-radius:12px;padding:13px;background:#a3e63508;color:var(--lime);font-weight:700;font-size:12px;cursor:pointer;margin-bottom:20px}.new-exercise-card{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:22px;background:#090d1855}.new-exercise-card h3{margin:0 0 16px;font-size:18px}.new-exercise-card label{display:flex;flex-direction:column;gap:7px;font-size:11px;color:var(--muted);margin-bottom:13px}.new-exercise-card p{font-size:11px;line-height:1.6;margin-bottom:12px}.new-exercise-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.new-exercise-actions>button:first-child{background:transparent;border:0;color:var(--muted);font-size:11px;cursor:pointer}.new-exercise-actions .primary{font-size:11px;padding:12px}.exercise-success{color:var(--lime)!important;font-size:12px;line-height:1.6;margin-bottom:16px!important}button:disabled{opacity:.5;cursor:default}.exercise-list-title{font-size:18px;margin:0 0 24px}.day-card{margin-top:24px}.builder{padding-top:48px;padding-bottom:80px}.page-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:34px}.page-head h1{font-size:52px;letter-spacing:-.05em;margin:8px 0}.page-head p,.catalog p{color:var(--muted);margin:0}.builder-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.75fr);gap:20px}.plan,.catalog{background:var(--surface);border:1px solid var(--line);border-radius:22px}.plan{padding:28px}.routine-data{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}.routine-data label,.catalog>label{display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.06em}input,select{width:100%;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:12px;outline:none}input:focus,select:focus{border-color:var(--lime)}.day-card{border:1px solid var(--line);border-radius:16px;padding:20px}.remove{background:transparent;border:0;color:#fca5a5;cursor:pointer}.columns{display:grid;grid-template-columns:200px 1fr 28px;gap:14px;color:var(--muted);font-size:9px;letter-spacing:.12em;padding:0 12px 9px}.exercise-item{display:grid;grid-template-columns:200px 1fr 28px;gap:14px;align-items:center;padding:16px 12px;border-top:1px solid var(--line)}.exercise-info{display:flex;flex-direction:column;gap:4px}.exercise-info small{color:var(--muted);font-size:10px}.type,.catalog-list button>span{font-size:8px;font-weight:800;letter-spacing:.09em;color:#93c5fd}.type[data-type="AEROBIC"],.catalog-list span[data-type="AEROBIC"]{color:#67e8f9}.type[data-type="ANAEROBIC"],.catalog-list span[data-type="ANAEROBIC"]{color:#fbbf24}.targets{display:grid;gap:8px}.targets.power{grid-template-columns:repeat(4,1fr)}.targets.cardio{grid-template-columns:repeat(3,1fr)}.targets label{font-size:8px;color:var(--muted);display:flex;flex-direction:column;gap:5px}.targets input,.targets select{padding:9px;font-size:12px}.remove{font-size:22px}.empty{display:flex;flex-direction:column;align-items:center;padding:48px;color:var(--muted);gap:7px}.empty strong{color:var(--text)}.catalog{padding:25px;height:fit-content;position:sticky;top:92px}.catalog h2{font-size:27px;margin:8px 0}.catalog>div:first-child{margin-bottom:24px}.catalog>label{margin-bottom:14px}.catalog-list{border-top:1px solid var(--line);margin-top:22px;padding-top:12px;max-height:430px;overflow:auto}.catalog-list button{width:100%;display:grid;grid-template-columns:70px 1fr 20px;align-items:center;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);color:var(--text);padding:14px 4px;cursor:pointer}.catalog-list button:hover{background:rgba(255,255,255,.025)}.catalog-list button div{display:flex;flex-direction:column;gap:3px}.catalog-list small{color:var(--muted);font-size:9px}.catalog-list b{font-size:20px;color:var(--lime)}.notice{border-radius:11px;padding:12px;margin-bottom:14px;font-size:12px}.error{background:rgba(248,113,113,.1);color:#fca5a5}@media(max-width:950px){.builder-grid{grid-template-columns:1fr}.catalog{position:static}.exercise-item,.columns{grid-template-columns:160px 1fr 24px}}@media(max-width:650px){.page-head{align-items:start;gap:20px}.page-head h1{font-size:39px}.routine-data{grid-template-columns:1fr}.plan,.catalog{padding:18px}.columns{display:none}.exercise-item{grid-template-columns:1fr 24px}.targets{grid-column:1/-1}.targets.power,.targets.cardio{grid-template-columns:repeat(2,1fr)}}
  `],
})
export class RoutineBuilderComponent implements OnInit {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly exerciseService = inject(ExerciseService);
  private readonly routineService = inject(RoutineService);
  private readonly router = inject(Router);
  readonly catalog = signal<Exercise[]>([]); readonly typeFilter = signal<'ALL' | TrainingType>('ALL'); readonly muscleFilter = signal('ALL');
  readonly routineName = signal(''); readonly goal = signal('Rendimiento mixto');
  readonly step = signal(1);
  readonly search = signal('');
  readonly catalogLoading = signal(true);
  readonly catalogError = signal('');
  /** Resuelve propuestas contra ejercicios oficiales existentes; no duplica el catálogo. */
  readonly proposals = [
    {name:'Casa · sin equipo', entries:[['Sentadilla con peso corporal',0],['Flexiones con rodillas apoyadas',0],['Puente de glúteos',0],['Bird dog',0]]},
    {name:'Parque · banco y barra', entries:[['Caminata activa',5],['Flexiones inclinadas en banco',0],['Remo invertido',0],['Zancadas sin peso',0]]},
    {name:'Trote y técnica de carrera', entries:[['Caminata activa',5],['Trote suave',8],['Trote lateral',1],['Trote con rodillas al pecho',1],['Trote con talones a la cola',1],['Caminata de recuperación',5]]},
    {name:'Casa · circuito con cuerda', entries:[['Marcha con rodillas altas',3],['Saltar cuerda',1],['Sentadilla con peso corporal',0],['Pasos laterales sin salto',2]]},
  ];
  loadProposal(proposal: {name:string;entries:(string|number)[][]}): void {
    if(this.currentDay().items.length || this.catalogLoading()) return;
    const entries = proposal.entries.map(([name, minutes]) => ({exercise:this.catalog().find(e => !e.createdByUserId && e.name === name), minutes:Number(minutes)}));
    if(entries.some(entry => !entry.exercise)) {this.error.set('Actualizá el catálogo del backend para cargar esta propuesta.');return;}
    this.routineName.set(proposal.name); this.goal.set('Rendimiento mixto');
    for(const entry of entries) {
      this.addExercise(entry.exercise!.id);
      const index=this.currentDay().items.length-1;
      if(entry.minutes) {
        this.updateNumber(index,'targetDurationMinutes',String(entry.minutes));
        this.updateNumber(index,'targetDistanceKm','');
        this.updateIntensity(index,'BAJA');
      }
    }
    this.step.set(2);
  }
  hasExercise(id: string): boolean { return this.currentDay().items.some(item => item.exercise.id === id); }
  /** Cada paso valida lo necesario antes de mostrar la siguiente decisión. Atrás conserva el borrador. */
  nextStep(): void {
    this.error.set('');
    if (this.step() === 2 && this.showExerciseForm()) { this.exerciseError.set('Guardá este ejercicio o tocá Cancelar antes de continuar.'); return; }
    if (this.step() === 1 && this.routineName().trim().length < 2) { this.error.set('Poné un nombre para reconocer tu rutina.'); return; }
    if (this.step() === 2 && !this.validExercises()) return;
    this.step.set(Math.min(3, this.step() + 1));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  previousStep(): void { this.error.set(''); this.step.set(Math.max(1, this.step() - 1)); window.scrollTo({ top: 0, behavior: 'auto' }); }
  /** Evita llegar al resumen con series, repeticiones o tiempos incompletos. */
  private validExercises(): boolean {
    const items = this.currentDay().items;
    if (!items.length) { this.error.set('Agregá al menos un ejercicio para continuar.'); return false; }
    for (const item of items) {
      if (!Number.isInteger(item.targetSets) || item.targetSets < 1 || !Number.isFinite(item.restSeconds) || item.restSeconds < 0 || item.restSeconds === null ||
        (item.exercise.trainingType === 'POWER' && (!Number.isInteger(item.minReps) || item.minReps < 1 || !Number.isInteger(item.maxReps) || item.maxReps < item.minReps)) ||
        (item.exercise.trainingType !== 'POWER' && (!item.targetDurationMinutes || item.targetDurationMinutes <= 0))) {
        this.error.set(`Revisá las series, repeticiones y tiempos de ${item.exercise.name}.`); return false;
      }
    }
    return true;
  }
  readonly days = signal<BuilderDay[]>([{ name: 'Ejercicios', items: [] }]); readonly saving = signal(false); readonly error = signal('');
  readonly showExerciseForm = signal(false);
  readonly creatingExercise = signal(false);
  readonly exerciseError = signal('');
  readonly exerciseMessage = signal('');
  /** Valida campos básicos, guarda el nuevo ejercicio del catálogo y lo añade a la rutina en edición. */
  createExercise(event: Event, name: string, muscleGroup: string, equipment: string, movementPattern: string, trainingType: string): void {
    event.preventDefault();
    if (this.creatingExercise() || this.saving()) return;
    if ([name,muscleGroup,equipment].some(value => value.trim().length < 2)) { this.exerciseError.set('Completá nombre, grupo muscular y equipamiento.'); return; }
    this.creatingExercise.set(true); this.exerciseError.set(''); this.exerciseMessage.set('');
    this.exerciseService.create({name:name.trim(),muscleGroup:muscleGroup.trim(),equipment:equipment.trim(),movementPattern:movementPattern.trim() || null,trainingType:trainingType as TrainingType}).subscribe({
      next: exercise => {
        this.catalog.update(items => [...items, exercise].sort((a,b) => a.name.localeCompare(b.name)));
        this.typeFilter.set('ALL'); this.muscleFilter.set('ALL'); this.search.set(''); this.addExercise(exercise.id);
        this.creatingExercise.set(false); this.showExerciseForm.set(false);
        this.exerciseMessage.set(`${exercise.name} guardado en el catálogo y agregado a tu rutina.`);
      }, error: error => { this.creatingExercise.set(false); this.exerciseError.set(error.error?.message || 'No pudimos guardar el ejercicio.'); },
    });
  }
  readonly muscleGroups = computed(() => [...new Set(this.catalog().map(item => item.muscleGroup))].sort());
  readonly filteredExercises = computed(() => this.catalog().filter(item => (this.typeFilter()==='ALL'||item.trainingType===this.typeFilter()) && (this.muscleFilter()==='ALL'||item.muscleGroup===this.muscleFilter()) && item.name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(this.search().trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))));

  /** Carga el catálogo de ejercicios para comenzar a editar una rutina. */
  ngOnInit(): void { this.loadCatalog(); }
  loadCatalog(): void {
    this.catalogLoading.set(true); this.catalogError.set('');
    this.exerciseService.getCatalog().subscribe({ next: catalog => { this.catalog.set(catalog); this.catalogLoading.set(false); }, error: () => { this.catalogLoading.set(false); this.catalogError.set('No pudimos cargar los ejercicios. Comprobá tu conexión e intentá de nuevo.'); } });
  }
  /** Devuelve el único bloque de ejercicios que utiliza actualmente el editor de rutinas. */
  currentDay(): BuilderDay { return this.days()[0]; }
  /** Traduce el identificador de tipo de entrenamiento a su etiqueta visible. */
  typeLabel(type: TrainingType): string { return ({ POWER:'FUERZA', AEROBIC:'AERÓBICO', ANAEROBIC:'ANAERÓBICO' })[type]; }
  /** Evita duplicados y agrega un ejercicio al borrador con objetivos iniciales según su tipo. */
  addExercise(id:string): void {
    if (!id) return; const exercise=this.catalog().find(item=>item.id===id); if(!exercise) return;
    if(this.currentDay().items.some(item=>item.exercise.id===id)){this.error.set('Ese ejercicio ya está en la rutina');return;}
    const item:BuilderItem={ exercise,targetSets:exercise.trainingType==='POWER'?3:1,minReps:exercise.trainingType==='POWER'?8:1,maxReps:exercise.trainingType==='POWER'?12:1,restSeconds:exercise.trainingType==='POWER'?90:exercise.trainingType==='ANAEROBIC'?60:0,targetDurationMinutes:exercise.trainingType==='POWER'?null:exercise.movementPattern==='Técnica de carrera'?1:30,targetDistanceKm:exercise.trainingType==='AEROBIC'?5:null,intensity:exercise.trainingType==='POWER'?null:'MEDIA' };
    this.error.set(''); this.updateDay(day=>({...day,items:[...day.items,item]}));
  }
  /** Quita del borrador el ejercicio indicado por su posición; no lo elimina del catálogo. */
  removeExercise(index:number):void{this.updateDay(day=>({...day,items:day.items.filter((_,i)=>i!==index)}));}
  /** Convierte un input de texto a número o null y actualiza el objetivo seleccionado del ejercicio. */
  updateNumber(index:number,field:keyof Pick<BuilderItem,'targetSets'|'minReps'|'maxReps'|'restSeconds'|'targetDurationMinutes'|'targetDistanceKm'>,value:string):void{this.updateItem(index,item=>({...item,[field]:value===''?null:Number(value)}));}
  /** Actualiza la intensidad elegida para un ejercicio del borrador. */
  updateIntensity(index:number,value:Intensity):void{this.updateItem(index,item=>({...item,intensity:value}));}
  /** Convierte el borrador a la estructura esperada por el backend, guarda la rutina y vuelve al inicio. */
  save():void{
    if (this.creatingExercise() || this.saving()) return;
    const name=this.routineName().trim(); const days=this.days();
    if (!this.validExercises()) { this.step.set(2); return; }
    if(name.length<2||days.some(day=>day.items.length===0)){this.error.set('Completá el nombre y agregá al menos un ejercicio a la rutina');return;}
    this.saving.set(true);this.error.set('');
    this.routineService.create({name,goal:this.goal(),days:days.map((day,dayIndex)=>({name,dayNumber:dayIndex+1,exercises:day.items.map((item,index)=>({exerciseId:item.exercise.id,order:index+1,targetSets:item.targetSets,minReps:item.minReps,maxReps:item.maxReps,restSeconds:item.restSeconds,targetDurationMinutes:item.targetDurationMinutes,targetDistanceKm:item.targetDistanceKm,intensity:item.intensity}))}))}).subscribe({next:()=>this.router.navigateByUrl('/#library-title'),error:(error)=>{this.error.set(error.error?.message||'No pudimos guardar la rutina');this.saving.set(false);}});
  }
  /** Reemplaza el bloque del editor mediante una función; genera un nuevo array para actualizar la signal. */
  private updateDay(mapper:(day:BuilderDay)=>BuilderDay):void{const index=0;this.days.update(days=>days.map((day,i)=>i===index?mapper(day):day));}
  /** Transforma solo el ejercicio indicado y conserva los demás elementos del borrador. */
  private updateItem(index:number,mapper:(item:BuilderItem)=>BuilderItem):void{this.updateDay(day=>({...day,items:day.items.map((item,i)=>i===index?mapper(item):item)}));}
}
