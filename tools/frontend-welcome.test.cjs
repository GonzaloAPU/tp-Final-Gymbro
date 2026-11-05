/** Recorrido de bienvenida con servicios simulados; nunca consulta Gemini. */
const test=require('node:test'),assert=require('node:assert/strict'),{of,Subject,throwError}=require('rxjs');
const {loadComponent}=require('./test-support/frontend.cjs');
function fixture(){
  const state={previews:[],accepts:[],routes:[],skips:0},pending=new Subject();
  const welcome={status:()=>of({aiAvailable:false}),draft:()=>of(null),preview:body=>{state.previews.push(body);return pending;},accept:id=>{state.accepts.push(id);return pending;},skip:()=>{state.skips++;return of({});}};
  const services={auth:{user:()=>({heightCm:170,currentKg:70}),refreshProfile:()=>of({})},welcome,routines:{getAll:()=>of([])},router:{navigateByUrl:url=>{state.routes.push(url);return Promise.resolve(true);}}};
  const {WelcomeComponent}=loadComponent('frontend/src/app/components/welcome.component.ts',services),screen=new WelcomeComponent();
  screen.numberField('age','30');screen.restrictionAnswer.set('NO');
  return {screen,state,pending,welcome,services};
}

test('bienvenida UI: siete sesiones marcan toda la semana y al reducir no quedan días extra',()=>{
  const {screen}=fixture();screen.numberField('sessions','7');
  assert.deepEqual(Array.from(screen.form().availability,slot=>slot.weekday),[1,2,3,4,5,6,0]);
  screen.numberField('sessions','3');assert.equal(screen.form().availability.length,3);
});
test('bienvenida UI: precarga altura y peso sin inventar edad',()=>{const {screen}=fixture();screen.numberField('age','');assert.equal(screen.form().heightCm,170);assert.equal(screen.form().weightKg,70);assert.equal(screen.form().age,0);});

test('bienvenida UI: reutiliza edad y experiencia y prioriza las medidas actuales del perfil',async()=>{
  const {screen,welcome,services}=fixture();
  const preferences={...screen.form(),age:42,heightCm:160,weightKg:80,experience:'INTERMEDIATE',goal:'GENERAL',aiConsent:true};
  welcome.draft=()=>of({preferences,proposal:null});
  services.auth.user=()=>({heightCm:175,currentKg:75,goal:'Ganar fuerza'});
  await screen.ngOnInit();
  assert.equal(screen.form().age,42);assert.equal(screen.form().experience,'INTERMEDIATE');
  assert.equal(screen.form().heightCm,175);assert.equal(screen.form().weightKg,75);
  assert.equal(screen.form().goal,'STRENGTH');assert.equal(screen.form().aiConsent,false);
  assert.equal(screen.proposal(),null);assert.equal(screen.step(),1);
  assert.equal(screen.fieldLocked('age'),true);assert.equal(screen.fieldLocked('heightCm'),true);
  assert.equal(screen.fieldLocked('weightKg'),true);assert.equal(screen.fieldLocked('experience'),true);
  screen.editingSaved.set(true);assert.equal(screen.fieldLocked('age'),false);assert.equal(screen.fieldLocked('weightKg'),true);
});

test('bienvenida UI: toma el último pesaje del servidor aunque el perfil local esté desactualizado',async()=>{
  const {screen,welcome}=fixture();
  welcome.draft=()=>of({preferences:null,proposal:null,profile:{heightCm:160,currentKg:68,goal:'Ganar fuerza'}});
  screen.numberField('age','');await screen.ngOnInit();
  assert.equal(screen.form().weightKg,68);assert.equal(screen.form().heightCm,160);
  assert.equal(screen.form().age,0);assert.equal(screen.fieldLocked('age'),false);
  assert.equal(screen.fieldLocked('heightCm'),true);assert.equal(screen.fieldLocked('weightKg'),true);
});

test('bienvenida UI: sin ficha previa mantiene la edad vacía y recupera el objetivo del perfil',async()=>{
  const {screen,services}=fixture();screen.numberField('age','');
  services.auth.user=()=>({heightCm:170,currentKg:70,goal:'Desarrollar músculo'});
  await screen.ngOnInit();assert.equal(screen.form().age,0);assert.equal(screen.form().goal,'MUSCLE');
});
test('bienvenida UI: edad inválida impide continuar',()=>{const {screen}=fixture();screen.numberField('age','17');screen.next();assert.equal(screen.step(),1);assert.ok(screen.error());});
test('bienvenida UI: exige respuesta sobre restricciones',()=>{const {screen}=fixture();screen.restrictionAnswer.set('');screen.next();assert.equal(screen.step(),1);assert.ok(screen.error());});
test('bienvenida UI: restricciones bloquean el plan automático',()=>{const {screen,state}=fixture();screen.setField('hasRestrictions',true);screen.next();assert.equal(screen.step(),1);assert.equal(state.previews.length,0);});
test('bienvenida UI: ficha válida avanza al calendario',()=>{const {screen}=fixture();screen.next();assert.equal(screen.step(),2);});
test('bienvenida UI: inicio a las 19 propone final a las 19:45 y permite editarlo',()=>{const {screen}=fixture();screen.changeTime(1,'start','19:00');assert.equal(screen.form().availability[0].end,'19:45');screen.changeTime(1,'end','20:00');assert.equal(screen.form().availability[0].end,'20:00');});
test('bienvenida UI: ajustar duración actualiza el final y los días reemplazados',()=>{const {screen}=fixture();screen.numberField('minutes','60');screen.changeTime(1,'start','19:00');assert.equal(screen.form().availability[0].end,'20:00');screen.toggleDay(5);screen.toggleDay(2);assert.equal(screen.form().availability.find(slot=>slot.weekday===2).end,'19:00');});
test('bienvenida UI: horario que cruza medianoche exige corrección',()=>{const {screen}=fixture();screen.step.set(2);screen.changeTime(1,'start','23:45');assert.equal(screen.form().availability[0].end,'');screen.next();assert.equal(screen.step(),2);assert.ok(screen.error());});
test('bienvenida UI: las pestañas permiten volver conservando datos y validan al avanzar',()=>{const {screen}=fixture();screen.step.set(3);screen.goToStep(1);assert.equal(screen.step(),1);assert.equal(screen.form().age,30);screen.numberField('age','17');screen.goToStep(3);assert.equal(screen.step(),1);assert.ok(screen.error());screen.numberField('age','30');screen.goToStep(3);assert.equal(screen.step(),3);});
test('bienvenida UI: valida un borrador incompleto aunque la interfaz mantenga la cantidad',()=>{const {screen}=fixture();screen.step.set(2);screen.setField('availability',screen.form().availability.slice(0,1));screen.next();assert.equal(screen.step(),2);assert.ok(screen.error());});
test('bienvenida UI: cuatro sesiones marcan cuatro días automáticamente y permiten continuar',()=>{const {screen}=fixture();screen.step.set(2);screen.numberField('sessions','4');assert.equal(screen.form().availability.length,4);assert.deepEqual(Array.from(screen.form().availability,slot=>slot.weekday),[1,2,4,5]);screen.next();assert.equal(screen.step(),3);assert.equal(screen.error(),'');});
test('bienvenida UI: cambiar cantidad mantiene tantos días como sesiones',()=>{const {screen}=fixture();for(const count of [4,2,3,4]){screen.numberField('sessions',String(count));assert.equal(screen.form().availability.length,count);assert.equal(new Set(screen.form().availability.map(slot=>slot.weekday)).size,count);}});
test('bienvenida UI: reemplazar un día conserva su horario y la cantidad elegida',()=>{const {screen}=fixture();screen.changeTime(1,'start','19:00');screen.changeTime(1,'end','20:00');screen.toggleDay(1);assert.equal(screen.form().availability.length,3);screen.toggleDay(2);assert.equal(screen.available(1),false);const slot=screen.form().availability.find(slot=>slot.weekday===2);assert.equal(slot.start,'19:00');assert.equal(slot.end,'20:00');screen.numberField('sessions','4');assert.equal(screen.available(2),true);assert.equal(screen.form().availability.length,4);});
test('bienvenida UI: rango muy corto bloquea continuar',()=>{const {screen}=fixture();screen.step.set(2);screen.changeTime(1,'end','18:15');screen.next();assert.equal(screen.step(),2);assert.ok(screen.error());});
test('bienvenida UI: cambiar equipamiento no duplica selecciones',()=>{const {screen}=fixture();screen.toggleEquipment('DUMBBELLS');screen.toggleEquipment('DUMBBELLS');assert.equal(screen.form().equipment.length,0);});
test('bienvenida UI: puede preparar local sin IA configurada',async()=>{const {screen,state,pending}=fixture();const generation=screen.generate();assert.equal(state.previews[0].mode,'LOCAL');pending.next({id:'preview',source:'LOCAL',sessions:[],restDays:[]});await generation;assert.equal(screen.proposal().source,'LOCAL');assert.equal(screen.busy(),false);});
test('bienvenida UI: IA sin consentimiento no envía parámetros',async()=>{const {screen,state}=fixture();screen.aiAvailable.set(true);screen.setField('mode','GEMINI');await screen.generate();assert.equal(state.previews.length,0);assert.ok(screen.error());});
test('bienvenida UI: doble generación pendiente produce una solicitud',async()=>{const {screen,state,pending}=fixture();const first=screen.generate();await screen.generate();assert.equal(state.previews.length,1);pending.next({id:'p'});await first;});
test('bienvenida UI: fallo al generar conserva ficha y permite reintentar',async()=>{const {screen,welcome}=fixture();welcome.preview=()=>throwError(()=>({error:{message:'Sin conexión'}}));await screen.generate();assert.equal(screen.form().age,30);assert.equal(screen.error(),'Sin conexión');assert.equal(screen.busy(),false);});
test('bienvenida UI: aceptar guarda una sola vez y vuelve al inicio',async()=>{const {screen,state,pending}=fixture();screen.proposal.set({id:'proposal'});const first=screen.accept();await screen.accept();assert.deepEqual(state.accepts,['proposal']);assert.equal(state.routes.length,0);pending.next({routineId:'routine'});await first;assert.deepEqual(state.routes,['/']);});
test('bienvenida UI: editar descarta la vista previa pero conserva la ficha',()=>{const {screen}=fixture();screen.proposal.set({id:'proposal'});screen.edit();assert.equal(screen.proposal(),null);assert.equal(screen.step(),1);assert.equal(screen.form().age,30);});
test('bienvenida UI: omitir se confirma antes de ir al inicio',async()=>{const {screen,state}=fixture();await screen.skip();assert.equal(state.skips,1);assert.deepEqual(state.routes,['/']);});
test('guard bienvenida: cuenta sin rutinas redirige a la ficha',async()=>{const {services}=fixture();services.auth.isAuthenticated=()=>true;services.welcome.status=()=>of({needed:true});services.router.createUrlTree=paths=>paths;const {welcomeGuard}=loadComponent('frontend/src/app/guards/welcome.guard.ts',services);const {firstValueFrom}=require('rxjs');assert.deepEqual(Array.from(await firstValueFrom(welcomeGuard())),['/bienvenida']);});
test('guard bienvenida: servidor caído no bloquea el inicio existente',async()=>{const {services}=fixture();services.auth.isAuthenticated=()=>true;services.welcome.status=()=>throwError(()=>Error('offline'));const {welcomeGuard}=loadComponent('frontend/src/app/guards/welcome.guard.ts',services);const {firstValueFrom}=require('rxjs');assert.equal(await firstValueFrom(welcomeGuard()),true);});
