/** 40 casos nuevos: constructor (20), autenticación (12), perfil (8). */
const test=require('node:test'),assert=require('node:assert/strict');
const {Subject,of}=require('rxjs');
const {loadComponent,HttpErrorResponse}=require('./test-support/frontend.cjs');
const event=()=>({preventDefault(){}}),plain=value=>JSON.parse(JSON.stringify(value));
function builderFixture(){
  const pending=new Subject(),newExercise=new Subject(),state={sent:[],created:[],routes:[]};
  const catalog=[
    {id:'power',name:'Press de banca',muscleGroup:'Pecho',equipment:'Barra',trainingType:'POWER'},
    {id:'cardio',name:'Caminata',muscleGroup:'Piernas',equipment:'Ninguno',trainingType:'AEROBIC'},
    {id:'interval',name:'Saltos rápidos',muscleGroup:'Piernas',equipment:'Ninguno',trainingType:'ANAEROBIC'},
  ];
  const {RoutineBuilderComponent}=loadComponent('frontend/src/app/components/routine-builder.component.ts',{
    exercises:{getCatalog:()=>of(catalog),create:body=>{state.created.push(body);return newExercise;}},
    routines:{create:body=>{state.sent.push(body);return pending;}},router:{navigateByUrl:url=>state.routes.push(url)},
  });
  const screen=new RoutineBuilderComponent();screen.ngOnInit();screen.routineName.set('Rutina');
  return {screen,catalog,state,pending,newExercise};
}
test('constructor: identificador desconocido no modifica el borrador',()=>{const {screen}=builderFixture();screen.addExercise('missing');assert.equal(screen.currentDay().items.length,0);});
test('constructor: duplicado conserva una sola ficha y muestra error',()=>{const {screen}=builderFixture();screen.addExercise('power');screen.addExercise('power');assert.equal(screen.currentDay().items.length,1);assert.ok(screen.error());});
test('constructor: quitar ficha conserva el catálogo original',()=>{const {screen}=builderFixture();screen.addExercise('power');screen.removeExercise(0);assert.equal(screen.currentDay().items.length,0);assert.equal(screen.catalog().length,3);});
test('constructor: fuerza inicia con series, repeticiones y descanso',()=>{const {screen}=builderFixture();screen.addExercise('power');const row=screen.currentDay().items[0];assert.equal(row.targetSets,3);assert.equal(row.minReps,8);assert.equal(row.maxReps,12);assert.equal(row.restSeconds,90);assert.equal(row.targetDurationMinutes,null);});
test('constructor: aeróbico inicia con duración y distancia',()=>{const {screen}=builderFixture();screen.addExercise('cardio');const row=screen.currentDay().items[0];assert.equal(row.targetSets,1);assert.equal(row.targetDurationMinutes,30);assert.equal(row.targetDistanceKm,5);assert.equal(row.restSeconds,0);});
test('constructor: anaeróbico no hereda distancia del aeróbico',()=>{const {screen}=builderFixture();screen.addExercise('interval');const row=screen.currentDay().items[0];assert.equal(row.targetDistanceKm,null);assert.equal(row.restSeconds,60);assert.equal(row.intensity,'MEDIA');});
test('constructor: búsqueda ignora tildes, mayúsculas y bordes de espacios',()=>{const {screen}=builderFixture();screen.search.set('  RAPIDOS  ');assert.equal(screen.filteredExercises()[0].id,'interval');assert.equal(screen.filteredExercises().length,1);});
test('constructor: filtro de tipo excluye los otros dos tipos',()=>{const {screen}=builderFixture();screen.typeFilter.set('AEROBIC');assert.deepEqual(plain(screen.filteredExercises().map(e=>e.id)),['cardio']);});
test('constructor: grupo muscular combina con la búsqueda',()=>{const {screen}=builderFixture();screen.muscleFilter.set('Piernas');screen.search.set('caminata');assert.deepEqual(plain(screen.filteredExercises().map(e=>e.id)),['cardio']);});
test('constructor: nombre en blanco bloquea avanzar',()=>{const {screen}=builderFixture();screen.routineName.set('   ');screen.nextStep();assert.equal(screen.step(),1);assert.ok(screen.error());});
test('constructor: volver no permite bajar del primer paso',()=>{const {screen}=builderFixture();screen.previousStep();assert.equal(screen.step(),1);});
test('constructor: ejercicio sin guardar bloquea pasar al resumen',()=>{const {screen}=builderFixture();screen.step.set(2);screen.showExerciseForm.set(true);screen.nextStep();assert.equal(screen.step(),2);assert.ok(screen.exerciseError());});
for(const [label,id,field,value] of [
  ['cero series','power','targetSets','0'],['series fraccionarias','power','targetSets','1.5'],
  ['repeticiones máximas menores al mínimo','power','maxReps','2'],['descanso negativo','power','restSeconds','-1'],
  ['cardio de duración cero','cardio','targetDurationMinutes','0'],
])test(`constructor: ${label} impide guardar`,()=>{const {screen,state}=builderFixture();screen.addExercise(id);screen.updateNumber(0,field,value);screen.save();assert.equal(state.sent.length,0);assert.equal(screen.step(),2);assert.ok(screen.error());});
test('constructor: fallo de guardado conserva ejercicios y permite reintentar',()=>{const {screen,state,pending}=builderFixture();screen.addExercise('power');screen.save();pending.error({error:{message:'Sin conexión'}});assert.equal(screen.saving(),false);assert.equal(screen.currentDay().items.length,1);assert.equal(state.routes.length,0);assert.equal(screen.error(),'Sin conexión');});
test('constructor: doble toque al guardar produce una solicitud',()=>{const {screen,state}=builderFixture();screen.addExercise('power');screen.save();screen.save();assert.equal(state.sent.length,1);assert.equal(screen.saving(),true);});
test('constructor: fallo al crear ejercicio no inserta una ficha fantasma',()=>{const {screen,state,newExercise}=builderFixture();screen.showExerciseForm.set(true);screen.createExercise(event(),'Nuevo','Piernas','Bandas','','POWER');newExercise.error({error:{message:'Ya existe'}});assert.equal(state.created.length,1);assert.equal(screen.currentDay().items.length,0);assert.equal(screen.catalog().length,3);assert.equal(screen.creatingExercise(),false);assert.equal(screen.showExerciseForm(),true);assert.equal(screen.exerciseError(),'Ya existe');});

function authFixture(kind){
  const pending=new Subject(),state={sent:[],routes:[]};
  const auth={login:body=>{state.sent.push(body);return pending;},register:body=>{state.sent.push(body);return pending;}};
  const result=loadComponent(`frontend/src/app/components/${kind}.component.ts`,{auth,endpoint:{native:true},router:{navigateByUrl:url=>state.routes.push(url)}});
  const screen=new result[kind==='login'?'LoginComponent':'RegisterComponent']();
  if(kind==='register'){screen.terms.set(true);screen.privacy.set(true);screen.adult.set(true);screen.sports.set(true);}
  const submit=kind==='login'?()=>screen.submit(event(),'ana@example.test','Password1!'):()=>screen.submit(event(),' Ana ','ana@example.test','Password1!','Password1!');
  return {screen,state,pending,submit};
}
test('ingreso: email vacío no llama al servidor',()=>{const {screen,state}=authFixture('login');screen.submit(event(),'','Password1!');assert.equal(state.sent.length,0);assert.ok(screen.error());});
test('ingreso: contraseña corta no inicia estado de espera',()=>{const {screen,state}=authFixture('login');screen.submit(event(),'a@b.test','short');assert.equal(state.sent.length,0);assert.equal(screen.loading(),false);});
test('ingreso: espera confirmación antes de navegar y libera loading',()=>{const {screen,state,pending,submit}=authFixture('login');submit();assert.equal(screen.loading(),true);assert.equal(state.routes.length,0);pending.next({});pending.complete();assert.deepEqual(state.routes,['/']);assert.equal(screen.loading(),false);});
test('ingreso: muestra error HTTP y no navega',()=>{const {screen,state,pending,submit}=authFixture('login');submit();pending.error(new HttpErrorResponse('Credenciales incorrectas'));assert.equal(screen.error(),'Credenciales incorrectas');assert.equal(screen.loading(),false);assert.equal(state.routes.length,0);});
test('ingreso: conserva mensaje de tiempo de espera',()=>{const {screen,pending,submit}=authFixture('login');submit();pending.error(new Error('Tiempo de espera agotado'));assert.equal(screen.error(),'Tiempo de espera agotado');assert.equal(screen.loading(),false);});
test('ingreso: doble envío mientras espera no duplica solicitudes',()=>{const {state,submit}=authFixture('login');submit();submit();assert.equal(state.sent.length,1);});
test('registro: nombre solo de espacios se rechaza',()=>{const {screen,state}=authFixture('register');screen.submit(event(),'  ','a@b.test','Password1!','Password1!');assert.equal(state.sent.length,0);assert.ok(screen.error());});
test('registro: confirmación distinta no llama al backend',()=>{const {screen,state}=authFixture('register');screen.submit(event(),'Ana','a@b.test','Password1!','Password2!');assert.equal(state.sent.length,0);assert.ok(screen.error());});
test('registro: recorta nombre y no envía confirmación de contraseña',()=>{const {state,submit}=authFixture('register');submit();assert.deepEqual(plain(state.sent[0]),{name:'Ana',email:'ana@example.test',password:'Password1!',legal:{version:require('../shared/legal-documents.json').version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:true}});});
test('registro: navega a bienvenida solo tras respuesta exitosa',()=>{const {screen,state,pending,submit}=authFixture('register');submit();assert.equal(state.routes.length,0);assert.equal(screen.loading(),true);pending.next({});pending.complete();assert.deepEqual(state.routes,['/bienvenida']);assert.equal(screen.loading(),false);});
test('registro: email ocupado mantiene formulario y libera envío',()=>{const {screen,state,pending,submit}=authFixture('register');submit();pending.error(new HttpErrorResponse('Email ocupado'));assert.equal(screen.error(),'Email ocupado');assert.equal(screen.loading(),false);assert.equal(state.routes.length,0);});
test('registro: doble envío mientras espera no crea dos cuentas',()=>{const {state,submit}=authFixture('register');submit();submit();assert.equal(state.sent.length,1);});

function profileFixture(){
  const pending=new Subject(),state={sent:[],routes:[],prepared:0};
  const {ProfileComponent}=loadComponent('frontend/src/app/components/profile.component.ts',{
    auth:{user:()=>({name:'Ana Pérez',photoUrl:'original'}),updateProfile:body=>{state.sent.push(body);return pending;}},
    router:{navigateByUrl:url=>state.routes.push(url)},preparePhoto:async()=>{state.prepared++;return 'comprimida';},
  });
  const screen=new ProfileComponent(),save=()=>screen.save(event(),'Ana','170','65','Gym','Fuerza','Karate');
  return {screen,state,pending,save};
}
test('perfil: nombre inválido no envía cambios',()=>{const {screen,state}=profileFixture();screen.save(event(),' ','','','','','');assert.equal(state.sent.length,0);assert.ok(screen.error());});
test('perfil: guardar dos veces no duplica la edición',()=>{const {state,save}=profileFixture();save();save();assert.equal(state.sent.length,1);});
test('perfil: preparar foto bloquea el guardado parcial',()=>{const {screen,state,save}=profileFixture();screen.photoPreparing.set(true);save();assert.equal(state.sent.length,0);});
test('perfil: opcionales vacíos se envían como null',()=>{const {screen,state}=profileFixture();screen.save(event(),'Ana','','','  ','  ','  ');for(const key of ['heightCm','currentKg','gymName','goal','discipline'])assert.equal(state.sent[0][key],null);});
test('perfil: recorta textos y convierte medidas numéricas',()=>{const {screen,state}=profileFixture();screen.save(event(),' Ana ','170','65.5',' Gym ',' Fuerza ',' Karate ');assert.deepEqual(plain(state.sent[0]),{name:'Ana',heightCm:170,currentKg:65.5,gymName:'Gym',goal:'Fuerza',discipline:'Karate',photoUrl:'original'});});
test('perfil: quitar foto envía null solo al guardar',()=>{const {screen,state,save}=profileFixture();screen.draftPhoto.set(null);assert.equal(state.sent.length,0);save();assert.equal(state.sent[0].photoUrl,null);});
test('perfil: cancelar selector de fotos no altera el borrador',async()=>{const {screen,state}=profileFixture();await screen.uploadPhoto({target:{files:[]}});assert.equal(screen.draftPhoto(),'original');assert.equal(state.prepared,0);});
test('perfil: foto preparada queda en borrador y limpia el selector',async()=>{const {screen,state}=profileFixture();const input={files:[{}],value:'foto.jpg'};await screen.uploadPhoto({target:input});assert.equal(screen.draftPhoto(),'comprimida');assert.equal(screen.photoPreparing(),false);assert.equal(input.value,'');assert.equal(state.sent.length,0);});
