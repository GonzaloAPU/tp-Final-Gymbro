/** Comprueba el recorrido guiado y el contrato enviado al servidor sin modificar ninguna base de datos. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { of } = require('rxjs');
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; read.update = fn => { value = fn(value); }; return read; };
const catalog = [{ id:'bench', name:'Press de banca', muscleGroup:'Pecho', equipment:'Barra', trainingType:'POWER' }, { id:'curl', name:'Curl de bíceps', muscleGroup:'Brazos', equipment:'Mancuernas', trainingType:'POWER' }];
let payload;
let destination;
const exercises = { getCatalog: () => of(catalog) };
const routines = { create: data => { payload = data; return of({ id:'new' }); } };
const router = { navigateByUrl: url => { destination = url; } };
const output = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/app/components/routine-builder.component.ts','utf8'), {
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText, { exports:output, window:{scrollTo(){}}, require: name => {
  if(name==='@angular/core') return { ChangeDetectionStrategy:{Eager:1,OnPush:0},Component:()=>target=>target,signal,computed:fn=>fn,inject:token=>token==='exercises'?exercises:token==='routines'?routines:router};
  if(name==='@angular/router') return {Router:'router'};
  if(name.includes('exercise.service')) return {ExerciseService:'exercises'};
  if(name.includes('routine.service')) return {RoutineService:'routines'};
  return require(name);
} });
const builder = new output.RoutineBuilderComponent();
builder.ngOnInit();
builder.nextStep();
assert.equal(builder.step(),1,'No avanzar sin nombre');
builder.routineName.set('Pecho y brazos');
builder.nextStep();
assert.equal(builder.step(),2);
builder.nextStep();
assert.equal(builder.step(),2,'No avanzar con rutina vacía');
builder.search.set('biceps');
assert.equal(builder.filteredExercises()[0].id,'curl','Buscar sin exigir acentos');
builder.addExercise('bench');
builder.addExercise('bench');
assert.equal(builder.currentDay().items.length,1,'No duplicar ejercicios');
builder.updateNumber(0,'maxReps','2');
builder.nextStep();
assert.equal(builder.step(),2,'Bloquear un rango de repeticiones invertido');
builder.updateNumber(0,'maxReps','12');
builder.nextStep();
assert.equal(builder.step(),3);
builder.previousStep();
assert.equal(builder.currentDay().items.length,1,'Atrás conserva los ejercicios');
builder.nextStep();
builder.save();
assert.equal(payload.name,'Pecho y brazos');
assert.equal(payload.days[0].name,'Pecho y brazos');
assert.equal(payload.days[0].exercises[0].exerciseId,'bench');
assert.equal(payload.days[0].exercises[0].targetSets,3);
assert.equal(destination,'/#library-title');
console.log('OK: pasos guiados, búsqueda sin acentos, validación, conservación del borrador y guardado compatible.');

// Las propuestas usan IDs reales, conservan el borrador y no asignan kilómetros a ejercicios en el lugar.
(async () => {
  const {exerciseData}=await import('../backend/src/data/exercise-catalog.js');
  const {normalizeExerciseName}=await import('../backend/src/services/exercise-name.js');
  assert.equal(new Set(exerciseData.map(e=>normalizeExerciseName(e.name))).size,exerciseData.length);
  for(const proposal of builder.proposals) {
    const sample=new output.RoutineBuilderComponent();sample.ngOnInit();
    sample.catalog.set(exerciseData.map((e,i)=>({...e,id:String(i)})));
    sample.loadProposal(proposal);
    assert.equal(sample.step(),2);assert.equal(sample.currentDay().items.length,proposal.entries.length);
    for(const item of sample.currentDay().items) if(item.exercise.trainingType!=='POWER') {
      assert.ok(item.targetDurationMinutes>0);assert.equal(item.targetDistanceKm,null);
    }
    const before=sample.currentDay().items.length;sample.loadProposal(proposal);
    assert.equal(sample.currentDay().items.length,before);
  }
  const missing=new output.RoutineBuilderComponent();missing.ngOnInit();missing.loadProposal(builder.proposals[0]);
  assert.equal(missing.currentDay().items.length,0);assert.ok(missing.error());
  console.log('OK: cuatro propuestas completas, catálogo único, tiempos de cardio y borradores protegidos.');
})().catch(error=>{console.error(error);process.exitCode=1;});
