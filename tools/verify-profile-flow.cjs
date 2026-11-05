/** Valida que el perfil solo vuelva a lectura después de guardar y que Progreso use los totales reales. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Subject, of } = require('rxjs');
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; read.update = fn => { value = fn(value); }; return read; };
const data = new Map();
const localStorage = { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) };
let request, payload, navigated;
const user = { id:'test',name:'Lucía',photoUrl:'existing-photo',currentKg:65 };
const auth = { user:()=>user, updateProfile: value => { payload=value; request=new Subject(); return request; }, refreshProfile:()=>of(user) };
const router = { navigateByUrl:url=>{navigated=url;} };
const summary = { totalCalories:11213,completedSessions:101,sessions:[{totalVolumeKg:1000}],weights:[],records:[
  { id:'old',exercise:{name:'Sentadilla'},maxWeightKg:60,estimatedOneRm:999,achievedAt:'2026-10-01' },
  { id:'new',exercise:{name:'Sentadilla'},maxWeightKg:80,estimatedOneRm:100,achievedAt:'2026-10-20' },
] };
const progress = { getSummary:()=>of(summary),getLeaderboard:()=>of({exercises:[]}) };
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText, {
    exports,localStorage,require:name=>{
      if(name==='@angular/core') return { ChangeDetectionStrategy:{Eager:1,OnPush:0},Component:()=>target=>target,Input:()=>()=>{},signal,computed:fn=>fn,inject:token=>token==='auth'?auth:token==='progress'?progress:router};
      if(name==='@angular/router') return {Router:'router'};
      if(name==='@angular/common'||name==='@angular/common/http') return {};
      if(name.includes('alarm-settings.component'))return {AlarmSettingsComponent:class {}};
      if(name.includes('auth.service')) return {AuthService:'auth'};
      if(name.includes('progress.service')) return {ProgressService:'progress'};
      if(name.includes('profile-photo')) return {prepareProfilePhoto:async()=> 'compressed-photo'};
      return require(name);
    },
  });
  return exports;
}
const {ProfileComponent}=load('frontend/src/app/components/profile.component.ts');
const editor=new ProfileComponent();
editor.draftPhoto.set('new-photo');
assert.equal(payload,undefined,'Preparar una foto no debe persistir cambios');
const save=()=>editor.save({preventDefault(){}},' Lucía ', '170','65',' Mi gimnasio ',' Fuerza ',' Karate ');
save();
assert.equal(payload.photoUrl,'new-photo');
assert.equal(payload.name,'Lucía');
assert.equal(payload.discipline,'Karate');
assert.equal(navigated,undefined,'No navegar antes de la confirmación del servidor');
request.error({error:{message:'Sin conexión'}});
assert.equal(editor.loading(),false);
assert.equal(navigated,undefined,'Un fallo debe mantener el editor y su borrador');
assert.equal(editor.draftPhoto(),'new-photo');
save();request.next({});
assert.equal(navigated,'/perfil');
const {ProfileViewComponent}=load('frontend/src/app/components/profile-view.component.ts');
const profile=new ProfileViewComponent();
assert.equal(profile.showWeight(),false);
profile.toggleWeight();
const {ProgressComponent}=load('frontend/src/app/components/progress.component.ts');
const screen=new ProgressComponent();screen.ngOnInit();
assert.equal(screen.showWeight(),true,'La preferencia del ojo se comparte entre Perfil y Progreso');
assert.equal(screen.sessions(),101,'Usar el total de sesiones, no el tamaño del historial reciente');
assert.equal(screen.calories(),11213);
assert.equal(screen.records().length,1);
assert.equal(screen.records()[0].value,80);
assert.equal(screen.weight(),'65.0');
console.log('OK: foto en borrador, guardado confirmado, error sin navegación, privacidad compartida y totales de progreso.');

// El historial cambia solo con respuesta exitosa; errores conservan el borrador para reintentar.
let weightRequest,submittedWeight;
progress.addWeight=value=>{submittedWeight=value;weightRequest=new Subject();return weightRequest;};
screen.weightDraft.set('67.25');
screen.registerWeight({preventDefault(){}},'');
assert.equal(submittedWeight,undefined);
screen.registerWeight({preventDefault(){}},'67.25');
assert.equal(screen.weights().length,0);
assert.equal(screen.weightSaving(),true);
screen.registerWeight({preventDefault(){}},'80');
assert.equal(submittedWeight,67.25,'Bloquea envíos simultáneos');
weightRequest.error(new Error('Sin conexión'));
assert.equal(screen.weightDraft(),'67.25'); assert.equal(screen.weights().length,0);
screen.registerWeight({preventDefault(){}},'67.25');
weightRequest.next({id:'measurement',weightKg:67.25,recordedAt:'2026-10-20T12:00:00Z'});
assert.equal(screen.weights().length,1); assert.equal(screen.weightDraft(),'');
assert.equal(screen.weight(),'67.3'); assert.equal(screen.weightSaved(),true);
assert.equal(screen.showWeight(),true);
console.log('OK: registro de peso confirmado, validación, protección contra doble envío y reintento.');

let measuredAt;
progress.addWeight=(value,date)=>{submittedWeight=value;measuredAt=date;weightRequest=new Subject();return weightRequest;};
screen.registerWeight({preventDefault(){}},'64','2020-01-15T10:30');
assert.equal(measuredAt,new Date('2020-01-15T10:30').toISOString());
weightRequest.next({id:'older',weightKg:64,recordedAt:measuredAt});
assert.equal(screen.weights()[0].id,'measurement','Insertar una medición antigua conserva el orden por fecha');
assert.equal(screen.weight(),'67.3','El registro antiguo no reemplaza el peso reciente');
screen.registerWeight({preventDefault(){}},'65','2099-01-01T10:00');
assert.equal(screen.weightSaving(),false); assert.ok(screen.weightError());
console.log('OK: fecha elegida, orden cronológico y rechazo de fechas futuras.');
