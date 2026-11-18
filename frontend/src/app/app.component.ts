/**
 * Estructura común y carrusel: conserva las cuatro vistas principales y mueve sus paneles con el dedo. Las rutas mantienen sus guardas; los formularios secundarios se muestran fuera del carrusel.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, NavigationError, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {adjacentTab,MAIN_TABS,swipeDirection,tabPath} from './tab-navigation';
import {DashboardComponent} from './components/dashboard.component';
import {ProgressComponent} from './components/progress.component';
import {ProfileViewComponent} from './components/profile-view.component';
import {TabRouteComponent} from './components/tab-route.component';
import { AlarmService } from './services/alarm.service';
import { AuthService } from './services/auth.service';
import { WorkoutComponent } from './components/workout.component';
import { WorkoutRouteComponent } from './components/workout-route.component';
import { AlarmSettingsComponent } from './components/alarm-settings.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WorkoutComponent, AlarmSettingsComponent,DashboardComponent,ProgressComponent,ProfileViewComponent],
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    @if(initialLoading()) {<div class="startup-screen" role="status" aria-live="polite"><span class="startup-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-35 16 16)"><path d="M11 16h10"/><rect x="6" y="8" width="5" height="16" rx="1.5"/><rect x="21" y="8" width="5" height="16" rx="1.5"/><path d="M3 12v8m26-8v8"/></g></svg></span><strong>Gymbro AI</strong>@if(initialError()){<p>No pudimos abrir Gymbro.</p><button class="button primary" type="button" (click)="retryStartup()">Reintentar</button>}@else{<span class="startup-spinner" aria-hidden="true"></span><p>Preparando tu espacio…</p>}</div>}
    <header class="topbar">
      <a class="brand" routerLink="/">
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-35 16 16)"><path d="M11 16h10"/><rect x="6" y="8" width="5" height="16" rx="1.5"/><rect x="21" y="8" width="5" height="16" rx="1.5"/><path d="M3 12v8m26-8v8"/></g></svg></span>
        <span>Gymbro <small>AI</small></span>
      </a>
      @if (auth.isAuthenticated()) {
        <div class="account">
          <button type="button" class="sound-button" (click)="alarmPanelOpen.set(!alarmPanelOpen())" [attr.aria-expanded]="alarmPanelOpen()" aria-controls="header-alarms" aria-label="Configurar sonido y alarmas" title="Sonido y alarmas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>
          </button>
          <a class="avatar" routerLink="/perfil">{{ initials }}</a><button type="button" (click)="logout()">Salir</button>
        </div>
        @if(alarmPanelOpen()) {
          <button class="alarm-backdrop" type="button" aria-label="Cerrar ajustes de alarmas" (click)="alarmPanelOpen.set(false)"></button>
          <div id="header-alarms" class="alarm-panel" (keydown.escape)="alarmPanelOpen.set(false)"><button type="button" class="alarm-close" (click)="alarmPanelOpen.set(false)" aria-label="Cerrar ajustes de alarmas">✕</button><app-alarm-settings /></div>
        }
      } @else {
        <div class="guest-links"><a routerLink="/login">Ingresar</a><a class="join" routerLink="/registro">Crear cuenta</a></div>
      }
    </header>
    <main [class.tabbed]="mainVisible()">
      <router-outlet (activate)="onRouteActivated($event)" />
      @if(auth.isAuthenticated() && workoutVisited() && tabOwner()===auth.user()?.id) {
        @for(owner of [tabOwner()];track owner) {
        <div #tabViewport class="tab-viewport" [hidden]="!mainVisible()" [class.dragging]="dragging()" [class.settling]="settling()"
          (pointerdown)="startDrag($event)" (pointermove)="moveDrag($event)" (pointerup)="endDrag($event)" (pointercancel)="cancelDrag()" (lostpointercapture)="captureLost($event)">
          @for(tab of tabs;track tab.index) {
            <section class="tab-pane" [class.current]="activeTab()===tab.index" [style.transform]="panelPosition(tab.index)"
              [style.visibility]="relativeTab(tab.index)===2 ? 'hidden' : 'visible'" [attr.inert]="activeTab()===tab.index ? null : ''"
              [attr.aria-hidden]="activeTab()!==tab.index" [attr.aria-label]="tab.name">
              @switch(tab.index) {
                @case(0){<app-dashboard [visible]="mainVisible() && activeTab()===0" />}
                @case(1){<app-workout [visible]="mainVisible() && activeTab()===1" />}
                @case(2){<app-progress [visible]="mainVisible() && activeTab()===2" />}
                @case(3){<app-profile-view [visible]="mainVisible() && activeTab()===3" />}
              }
            </section>
          }
        </div>
        }
      }
    </main>
    @if (auth.isAuthenticated() && !workoutVisible() && !editingForm) {
      <a class="workout-fab" routerLink="/entrenamiento" aria-label="Ir a entrenar" title="Ir a entrenar">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-35 16 16)"><path d="M11 16h10"/><rect x="6" y="8" width="5" height="16" rx="1.5"/><rect x="21" y="8" width="5" height="16" rx="1.5"/><path d="M3 12v8m26-8v8"/></g></svg>
      </a>
    }
    @if (auth.isAuthenticated()) {
      <nav class="mobile-nav" aria-label="Navegación principal">
        <a routerLink="/" routerLinkActive="selected" [routerLinkActiveOptions]="{exact:true}" ariaCurrentWhenActive="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg>Inicio</a>
        <a routerLink="/entrenamiento" routerLinkActive="selected" ariaCurrentWhenActive="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12h8M5 6h3v12H5zM16 6h3v12h-3zM2 9v6m20-6v6"/></svg>Entrenar</a>
        <a routerLink="/progreso" routerLinkActive="selected" ariaCurrentWhenActive="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M7 15l5-5 4 2 5-7"/></svg>Progreso</a>
        <a routerLink="/perfil" routerLinkActive="selected" ariaCurrentWhenActive="page"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/></svg>Perfil</a>
      </nav>
    }
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .startup-screen{position:fixed;inset:0;z-index:100;background:#090d18;color:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}.startup-mark{display:grid;place-items:center;width:70px;height:70px;border-radius:22px;background:#a3e635;color:#08110d;font-weight:900;font-size:24px}.brand-mark svg{width:26px;height:26px}.startup-mark svg{width:44px;height:44px}.startup-screen strong{font-size:28px}.startup-screen p{color:#94a3b8;font-size:14px}.startup-spinner{width:28px;height:28px;border:3px solid #263244;border-top-color:#a3e635;border-radius:50%;animation:startup-spin 1s linear infinite}@keyframes startup-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.startup-spinner{animation:none}}
    .tabbed{padding-bottom:0!important}.tab-viewport{position:relative;overflow:hidden;height:calc(100dvh - 144px - env(safe-area-inset-bottom));touch-action:pan-y pinch-zoom}
    .tab-pane{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;background:var(--bg,#090d18);touch-action:pan-y pinch-zoom;z-index:1}
    .tab-pane.current{z-index:2}.dragging{cursor:grabbing;user-select:none}.settling .tab-pane{transition:transform 220ms cubic-bezier(.2,.75,.2,1)}
    @media(max-width:680px){.tab-viewport{height:calc(100dvh - 134px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}}
    @media(prefers-reduced-motion:reduce){.settling .tab-pane{transition:none}}
    .account .sound-button{display:grid;place-items:center;width:44px;height:44px;padding:10px;color:var(--lime);border-radius:50%}.sound-button svg{width:23px;height:23px}.sound-button:focus-visible,.alarm-close:focus-visible{outline:2px solid var(--lime);outline-offset:2px}.sound-button[aria-expanded=true]{background:var(--surface-2)}.alarm-backdrop{position:fixed;inset:0;height:100dvh;background:#0005;border:0;z-index:40}.alarm-panel{position:absolute;right:16px;top:calc(100% + 8px);width:min(390px,calc(100vw - 32px));max-height:calc(100dvh - 110px);overflow:auto;z-index:41;background:var(--surface);border-radius:20px;box-shadow:0 12px 40px #0008}.alarm-close{position:absolute;right:8px;top:8px;background:var(--surface-2);color:var(--text);border:0;border-radius:50%;width:36px;height:36px;cursor:pointer;z-index:1}
    .mobile-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:64px;min-height:56px}.mobile-nav svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.mobile-nav a.selected{color:var(--lime)}
    .workout-fab{position:fixed;right:clamp(20px,4vw,48px);bottom:calc(96px + env(safe-area-inset-bottom));width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:var(--lime);color:#0b130d;border:2px solid #d9f99d;box-shadow:0 8px 30px #0007;z-index:30;transition:transform .15s,box-shadow .15s}.workout-fab svg{width:36px;height:36px}.workout-fab:hover{transform:translateY(-3px);box-shadow:0 12px 35px #a3e63530}.workout-fab:focus-visible{outline:3px solid var(--text);outline-offset:4px}@media(max-width:680px){.workout-fab{bottom:calc(80px + env(safe-area-inset-bottom));right:18px;width:56px;height:56px}}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,72px);border-bottom:1px solid var(--line);background:rgba(9,13,24,.88);backdrop-filter:blur(18px);position:sticky;top:0;z-index:10}.brand{display:flex;align-items:center;gap:12px;color:var(--text);font-weight:800;font-size:18px}.brand small{color:var(--lime)}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--lime);color:#08110d;font-size:13px}nav{display:flex;gap:34px}nav a{color:var(--muted);font-weight:600;font-size:14px}.active,nav a:hover{color:var(--text)!important}.account{display:flex;align-items:center;gap:10px}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);color:var(--text);font-weight:700;font-size:13px}.account button{background:transparent;border:0;color:var(--muted);cursor:pointer;font-size:12px}.account button:hover{color:var(--text)}.guest-links{display:flex;align-items:center;gap:18px}.guest-links a{color:var(--muted);font-size:13px;font-weight:700}.guest-links .join{background:var(--lime);color:#0a130d;padding:10px 14px;border-radius:10px}.mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:72px;background:#0d1320;border-top:1px solid var(--line);z-index:20;align-items:center;justify-content:space-around}main{padding-bottom:86px}@media(max-width:680px){.topbar{height:62px;padding:0 18px}.mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:64px;background:#0d1320;border-top:1px solid var(--line);z-index:20;align-items:center;justify-content:space-around}.mobile-nav a{font-size:13px}main{padding-bottom:72px}}
    /* Estos estilos viven en el componente para respetar la encapsulación de Angular. */
    @media(max-width:680px){
      .topbar{height:calc(62px + env(safe-area-inset-top));padding-top:env(safe-area-inset-top);padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
      .brand{font-size:15px;gap:8px}.guest-links{gap:10px}.guest-links a{font-size:12px}
      .account button{display:block;min-height:44px;min-width:44px}
      main{padding-bottom:calc(86px + env(safe-area-inset-bottom))}
      .mobile-nav{height:calc(72px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);gap:0}
      .mobile-nav a{font-size:11px;flex:1}
    }
  `],
})
export class AppComponent implements OnDestroy {
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  readonly auth = inject(AuthService);
  readonly initialLoading=signal(true);
  readonly initialError=signal(false);
  retryStartup():void {window.location.reload();}
  readonly alarmPanelOpen = signal(false);
  private readonly router = inject(Router);
  readonly workoutVisible = signal(false);
  readonly workoutVisited = signal(false);
  readonly tabs=[{index:0,name:'Inicio'},{index:1,name:'Entrenar'},{index:2,name:'Progreso'},{index:3,name:'Perfil'}];
  readonly mainVisible=signal(false);readonly activeTab=signal(0);readonly dragX=signal(0);
  readonly tabOwner=signal<string|null>(null);
  readonly dragging=signal(false);readonly settling=signal(false);
  private viewport?:HTMLElement;
  private pointer:{id:number;x:number;y:number;time:number;path:string;horizontal:boolean}|null=null;
  private navigating=false;private suppressClickUntil=0;
  private readonly stopDraggedClick=(event:Event)=>{
    if(this.navigating||Date.now()<this.suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  };
  @ViewChild('tabViewport') set viewportRef(value:ElementRef<HTMLElement>|undefined){
    this.viewport?.removeEventListener('click',this.stopDraggedClick,true);
    this.viewport=value?.nativeElement;
    this.viewport?.addEventListener('click',this.stopDraggedClick,true);
  }
  private readonly navigation=this.router.events.subscribe(event=>{
    if(event instanceof NavigationError&&this.initialLoading())this.initialError.set(true);
    if(!(event instanceof NavigationEnd))return;
    this.pointer=null;this.dragX.set(0);this.dragging.set(false);
    const index=MAIN_TABS.findIndex(path=>path===tabPath(event.urlAfterRedirects));
    if(index>=0)this.activeTab.set(index);
  });
  relativeTab(index:number):number {
    const offset=(index-this.activeTab()+MAIN_TABS.length)%MAIN_TABS.length;
    return offset===MAIN_TABS.length-1?-1:offset;
  }
  panelPosition(index:number):string {
    return 'translate3d(calc('+this.relativeTab(index)*100+'% + '+this.dragX()+'px),0,0)';
  }
  startDrag(event:PointerEvent):void {
    if(!event.isPrimary){this.cancelDrag();return;}
    if(event.button!==0||this.navigating||!this.mainVisible()||!this.auth.isAuthenticated()||this.alarmPanelOpen())return;
    this.suppressClickUntil=0;
    const target=event.target;
    if(!(target instanceof Element)||target.closest('input,textarea,select,[contenteditable],[data-no-swipe],[role="slider"],[role="dialog"],dialog,[aria-modal="true"]'))return;
    for(let element:Element|null=target;element&&element!==event.currentTarget;element=element.parentElement){
      if(element.scrollWidth>element.clientWidth+2&&/auto|scroll/.test(getComputedStyle(element).overflowX))return;
    }
    if(event.clientX<12||event.clientX>window.innerWidth-12)return;
    this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now(),path:tabPath(this.router.url),horizontal:false};
    this.settling.set(false);
  }
  moveDrag(event:PointerEvent):void {
    const start=this.pointer;if(!start||event.pointerId!==start.id)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(!start.horizontal){
      if(Math.abs(dy)>16&&Math.abs(dy)>Math.abs(dx)*1.3){this.cancelDrag();return;}
      if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.1)return;
      start.horizontal=true;this.dragging.set(true);
      try{this.viewport?.setPointerCapture(event.pointerId);}catch{/* El sistema pudo cancelar el contacto. */}
    }
    if(event.cancelable)event.preventDefault();
    this.suppressClickUntil=Date.now()+500;
    const width=this.viewport?.clientWidth||window.innerWidth;
    this.dragX.set(Math.max(-width,Math.min(width,dx)));
  }
  cancelDrag():void {
    this.pointer=null;this.dragging.set(false);this.settling.set(true);this.dragX.set(0);
  }
  @HostListener('window:blur')
  @HostListener('window:resize')
  @HostListener('document:visibilitychange')
  interruptDrag():void {this.cancelDrag();}
  captureLost(event:PointerEvent):void {
    // Touch captura implícitamente el elemento tocado. Al transferir la captura al
    // carrusel, el lostpointercapture del hijo burbujea hasta aquí: no es una cancelación.
    if(event.target!==this.viewport||this.viewport?.hasPointerCapture(event.pointerId))return;
    if(this.pointer?.id===event.pointerId)this.cancelDrag();
  }
  endDrag(event:PointerEvent):void {
    const start=this.pointer;
    if(!start||event.pointerId!==start.id)return;
    // Algunos dispositivos entregan pocos eventos move: también evaluamos la posición final.
    this.moveDrag(event);
    this.pointer=null;this.dragging.set(false);this.settling.set(true);
    if(!start.horizontal||start.path!==tabPath(this.router.url)||this.navigating||this.alarmPanelOpen()||!this.auth.isAuthenticated()){this.dragX.set(0);return;}
    this.suppressClickUntil=Date.now()+500;
    const width=this.viewport?.clientWidth||window.innerWidth;
    const direction=swipeDirection(this.dragX(),0,Date.now()-start.time,width);
    const next=direction?adjacentTab(this.router.url,direction):null;
    if(!next){this.dragX.set(0);return;}
    this.navigating=true;
    // La ruta conserva sus guardas; mientras responde se mantiene la vista parcialmente arrastrada.
    void this.router.navigateByUrl(next).catch(()=>false).finally(()=>{this.navigating=false;this.dragX.set(0);});
  }
  ngOnDestroy():void {this.navigation.unsubscribe();this.viewport?.removeEventListener('click',this.stopDraggedClick,true);}

  /** Registra un efecto que descarta el entrenamiento montado cuando la cuenta deja de estar autenticada. */
  constructor() {
    // Mantiene los avisos activos fuera de Entrenar; no necesitamos guardar otra referencia.
    inject(AlarmService);
    effect(() => {
      if (!this.auth.isAuthenticated()) {this.workoutVisited.set(false);this.tabOwner.set(null);this.mainVisible.set(false);this.cancelDrag();this.alarmPanelOpen.set(false);}
    });
  }
  /** Activa el panel autorizado sin recrear las vistas ni los cronómetros. */
  onRouteActivated(component: unknown): void {
    this.initialLoading.set(false);
    this.initialError.set(false);
    const index=component instanceof WorkoutRouteComponent?1:component instanceof TabRouteComponent?component.index:null;
    this.mainVisible.set(index!==null);this.workoutVisible.set(index===1);
    if(index!==null&&this.auth.isAuthenticated()){
      this.tabOwner.set(this.auth.user()?.id||null);
      this.settling.set(this.workoutVisited());this.activeTab.set(index);this.dragX.set(0);this.dragging.set(false);
      this.workoutVisited.set(true);
    }
  }
  /** Obtiene hasta dos iniciales del nombre para el avatar que se muestra como alternativa a una foto. */
  get initials(): string { return (this.auth.user()?.name || 'U').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
  /** La barra inferior ya permite ir a Entrenar; durante la edición evitamos tapar el botón Continuar. */
  get editingForm(): boolean { return this.router.url.startsWith('/rutinas/nueva') || this.router.url.startsWith('/perfil/editar') || this.router.url.startsWith('/bienvenida'); }
  /** Descarta la vista de entrenamiento, cierra la sesión local y navega al formulario de ingreso. */
  logout(): void { this.workoutVisited.set(false); this.auth.logout(); this.router.navigateByUrl('/login'); }
}
