/**
 * Verifica el comportamiento del entrenamiento al navegar usando componentes cargados en un entorno simulado; ayuda a detectar reinicios de estado.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Subject } = require('rxjs');

const effects = [];
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
const authenticated = signal(true);
const events = new Subject();
class NavigationEnd { constructor(url) { this.urlAfterRedirects = url; } }
class NavigationError {}
class WorkoutRouteComponent {}
class TabRouteComponent {constructor(index){this.index=index;}}
let shell,now=1000;
let userId='user-a';
const auth = {user:()=>({id:userId}), isAuthenticated: authenticated, logout: () => authenticated.set(false) };
const router = { url: '/', events,blocked:false, navigateByUrl: url => { if(router.blocked)return Promise.resolve(false);router.url=url;const index=['/','/entrenamiento','/progreso','/perfil'].indexOf(url.split(/[?#]/)[0]);shell?.onRouteActivated(index===1?new WorkoutRouteComponent():index>=0?new TabRouteComponent(index):{});events.next(new NavigationEnd(url));effects.forEach(run=>run());return Promise.resolve(true); } };
const compiled = ts.transpileModule(fs.readFileSync('frontend/src/app/app.component.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText;
class TestElement {
 constructor(blocked=false,horizontal=false,button=false){this.blocked=blocked;this.horizontal=horizontal;this.button=button;this.clientWidth=100;this.scrollWidth=horizontal?200:100;this.parentElement=null;this.listeners=new Map();}
 closest(selector){return this.blocked||(this.button&&selector.includes('button'))?{}:null;}
 addEventListener(type,callback){this.listeners.set(type,callback);} removeEventListener(type){this.listeners.delete(type);}setPointerCapture(id){this.captured=id;this.onTransfer?.();}hasPointerCapture(id){return this.captured===id;}
}
const output = {};
vm.runInNewContext(compiled, { exports: output, Date:class extends Date{static now(){return now;}},Element:TestElement,window:{innerWidth:400},getComputedStyle:element=>({overflowX:element.horizontal?'auto':'visible'}), require: name => {
  if (name === '@angular/core') return { ChangeDetectionStrategy:{Eager:1,OnPush:0}, Component: () => target => target, ViewChild:()=>()=>{}, HostListener:()=>()=>{},signal, computed: read => read, effect: run => { effects.push(run); run(); }, inject: token => token === 'auth' ? auth : router };
  if (name === '@angular/router') return { Router: 'router', NavigationEnd, NavigationError };
  if (name === '@angular/core/rxjs-interop') return { toSignal: (observable, options) => { const value = signal(options.initialValue); observable.subscribe(next => value.set(next)); return value; } };
  if (name==='./tab-navigation') {const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/src/app/tab-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out});return out;}
  if (name.includes('alarm.service')) return {AlarmService:'alarms'};
  if (name.includes('alarm-settings.component')) return {AlarmSettingsComponent:class {}};
  if (name.includes('auth.service')) return { AuthService: 'auth' };
  if(name.includes('tab-route.component'))return {TabRouteComponent};
  if(name.includes('dashboard.component'))return {DashboardComponent:class {}};
  if(name.includes('progress.component'))return {ProgressComponent:class {}};
  if(name.includes('profile-view.component'))return {ProfileViewComponent:class {}};
  if (name.includes('workout-route.component')) return { WorkoutRouteComponent };
  if (name.includes('workout.component')) return { WorkoutComponent: class {} };
  return require(name);
} });
shell=new output.AppComponent();
const viewport=new TestElement();viewport.clientWidth=400;viewport.scrollWidth=400;
shell.viewportRef={nativeElement:viewport};
const point=(x,y,target=new TestElement(),extra={})=>({target,currentTarget:viewport,isPrimary:true,button:0,pointerType:'touch',pointerId:1,clientX:x,clientY:y,cancelable:true,preventDefault(){},...extra});
const start=(target=new TestElement(),x=250,y=120)=>shell.startDrag(point(x,y,target));
const move=(x,y=120)=>shell.moveDrag(point(x,y));
const end=(x=100,y=120)=>shell.endDrag(point(x,y));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const click=()=>{let stopped=false;viewport.listeners.get('click')?.({preventDefault(){},stopImmediatePropagation(){stopped=true;}});return stopped;};
(async()=>{
 assert.equal(shell.workoutVisited(),false);
 assert.equal(shell.initialLoading(),true);events.next(new NavigationError());assert.equal(shell.initialError(),true,'El arranque fallido permite reintentar');
 await router.navigateByUrl('/');assert.equal(shell.mainVisible(),true);assert.equal(shell.workoutVisited(),true,'Las vistas se preparan tras pasar las guardas de una pestaña');
 assert.equal(shell.initialLoading(),false);assert.equal(shell.initialError(),false,'La carga inicial termina al activar la primera vista');
 await router.navigateByUrl('/entrenamiento');assert.equal(shell.workoutVisible(),true);
 await router.navigateByUrl('/progreso');assert.equal(shell.workoutVisible(),false);assert.equal(shell.workoutVisited(),true);
 await router.navigateByUrl('/');
 start();now+=1000;move(225);assert.equal(shell.dragX(),-25);assert.equal(shell.dragging(),true);
 assert.match(shell.panelPosition(1),/100%.*-25px/,'La vista vecina se muestra durante el arrastre');
 assert.equal(router.url,'/','Arrastrar no cambia todavía la ruta');now+=500;end(225);await settle();
 assert.equal(router.url,'/');assert.equal(shell.dragX(),0);assert.equal(shell.settling(),true);assert.equal(click(),true,'No activa un control al soltar un arrastre cancelado');
 start();now+=2500;move(120);assert.equal(shell.dragX(),-130);end(120);await settle();assert.equal(router.url,'/entrenamiento','Arrastres lentos siguen funcionando');assert.equal(shell.activeTab(),1);
 await router.navigateByUrl('/');start(new TestElement(false,false,true));now+=300;move(100);end();await settle();assert.equal(router.url,'/entrenamiento','También se puede arrastrar sobre un botón');assert.equal(click(),true,'El botón no recibe el clic accidental');
 await router.navigateByUrl('/');start();now+=1000;move(100);move(235);end(235);await settle();assert.equal(router.url,'/','Volver el dedo al origen cancela');
 start();now+=80;move(205);end(205);await settle();assert.equal(router.url,'/entrenamiento','Un gesto corto y rápido funciona');
 await router.navigateByUrl('/perfil');start();now+=500;move(100);end();await settle();assert.equal(router.url,'/');
 start(new TestElement(),100);now+=500;move(250);end(250);await settle();assert.equal(router.url,'/perfil');
 await router.navigateByUrl('/');
 for(const target of [new TestElement(true),new TestElement(false,true)]){start(target);move(100);end();await settle();assert.equal(router.url,'/');}
 start();move(252,190);move(100);end();await settle();assert.equal(router.url,'/','El scroll vertical no termina convertido en un cambio de pestaña');
 start();move(180);shell.cancelDrag();end();await settle();assert.equal(router.url,'/');assert.equal(shell.dragX(),0);
 start(new TestElement(),5);move(200);end(200);await settle();assert.equal(router.url,'/');
 start();move(180);shell.startDrag(point(200,100,new TestElement(),{isPrimary:false,pointerId:2}));end();await settle();assert.equal(router.url,'/');assert.equal(shell.dragX(),0);
 start();end(250);assert.equal(click(),false,'Los toques normales siguen funcionando después del gesto');
 router.blocked=true;start();now+=500;move(100);end();await settle();assert.equal(shell.dragX(),0);assert.equal(router.url,'/');router.blocked=false;
 shell.alarmPanelOpen.set(true);start();move(100);end();await settle();assert.equal(router.url,'/');shell.alarmPanelOpen.set(false);
 await router.navigateByUrl('/perfil/editar');assert.equal(shell.mainVisible(),false);assert.equal(shell.workoutVisited(),true);start();end();await settle();assert.equal(router.url,'/perfil/editar');
 start();move(180);shell.interruptDrag();assert.equal(shell.dragX(),0);
 await router.navigateByUrl('/');start();move(180);viewport.captured=undefined;shell.captureLost({pointerId:1,target:viewport});assert.equal(shell.dragX(),0);

 // Chrome táctil captura primero el hijo: transferir al viewport genera lostpointercapture en el hijo.
 await router.navigateByUrl('/');const child=new TestElement();
 viewport.onTransfer=()=>shell.captureLost({pointerId:1,target:child});
 start(child);now+=500;move(100);assert.equal(shell.dragging(),true);assert.equal(shell.dragX(),-150,'La transferencia táctil no devuelve el panel al origen');
 end();await settle();assert.equal(router.url,'/entrenamiento','La secuencia táctil completa sí cambia de pestaña');
 await router.navigateByUrl('/');
 viewport.onTransfer=()=>shell.captureLost({pointerId:1,target:viewport});
 start();now+=500;move(100);assert.equal(shell.dragX(),-150,'No cancela un evento viejo cuando el viewport aún tiene la captura');
 end();await settle();assert.equal(router.url,'/entrenamiento');viewport.onTransfer=undefined;
 await router.navigateByUrl('/');start();move(180);viewport.captured=undefined;
 shell.captureLost({pointerId:1,target:viewport});assert.equal(shell.dragX(),0,'Una pérdida real de captura todavía cancela el gesto');
 userId='user-b';await router.navigateByUrl('/perfil');assert.equal(shell.tabOwner(),'user-b','El carrusel se identifica por cuenta y recrea sus paneles');
 shell.logout();assert.equal(shell.workoutVisited(),false);assert.equal(shell.mainVisible(),false);
 shell.ngOnDestroy();assert.equal(viewport.listeners.has('click'),false);
 console.log('OK: carrusel progresivo real, arrastre lento, botones sin clic accidental, cancelación/reversión, vuelta circular y conservación del entrenamiento.');
})().catch(error=>{console.error(error);process.exitCode=1;});
