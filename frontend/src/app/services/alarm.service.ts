/** Avisos por cuenta/servidor: Android programa localmente; web requiere la página abierta. */
import {Injectable,OnDestroy,computed,effect,inject,signal,untracked} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Capacitor,PluginListenerHandle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {LocalNotifications,LocalNotificationSchema} from '@capacitor/local-notifications';
import {firstValueFrom,timeout} from 'rxjs';
import {AuthService} from './auth.service';
import {ApiEndpointService} from './api-endpoint.service';
import type {Routine} from './routine.service';
import {alarmId,nextReminder,planReminders} from './alarm-planning';
export type AlarmKind='reminder'|'work'|'rest';
interface Settings {reminder:boolean;work:boolean;rest:boolean;}
export interface TimerAlarm {key:string;kind:'work'|'rest';deadline:number;name:string;}
// Android conserva la configuración de cada canal: v2 aplica los sonidos extendidos.
const CHANNELS={reminder:'gymbro-reminders-v2',work:'gymbro-series-v2',rest:'gymbro-rest-v2'};
const SOUNDS={reminder:'gymbro_reminder_3s.wav',work:'gymbro_series_3s.wav',rest:'gymbro_rest_3s.wav'};

@Injectable({providedIn:'root'})
export class AlarmService implements OnDestroy {
  private readonly auth=inject(AuthService);
  private readonly endpoint=inject(ApiEndpointService);
  private readonly http=inject(HttpClient);
  readonly native=Capacitor.isNativePlatform();
  readonly android=Capacitor.getPlatform()==='android';
  readonly permission=signal('prompt');
  readonly exact=signal(false);
  readonly message=signal('');
  readonly notice=signal('');
  readonly settings=signal<Settings>({reminder:true,work:true,rest:true});
  private readonly scope=computed(()=>{
    const id=this.auth.user()?.id;
    return id?`${this.endpoint.native?this.endpoint.server():window.location.origin}:${id}`:null;
  });
  private owner:string|null=null;
  private routines:Routine[]=[];
  private timer:TimerAlarm|null=null;
  private scheduledTimer:TimerAlarm|null=null;
  private chain=Promise.resolve();
  private signature='';
  private readonly fired=new Set<string>();
  private audio:AudioContext|null=null;
  private readonly handles:PluginListenerHandle[]=[];
  private readonly ticker=window.setInterval(()=>this.checkWeb(),250);
  private readonly resume=()=>{if(document.visibilityState==='visible')void this.refresh();};

  constructor() {
    effect(() => {
      const scope = this.scope();
      untracked(() => { void this.switchOwner(scope); });
    });

    document.addEventListener('visibilitychange',this.resume);
    if(this.native) {
      void App.addListener('appStateChange',state=>{if(state.isActive)void this.refresh();}).then(handle=>this.handles.push(handle));
      void LocalNotifications.addListener('localNotificationReceived',notification=>{
        if(notification.extra?.gymbro&&notification.extra.owner===this.owner) {
          this.remember(notification.extra.key);this.notice.set(notification.body);
        }
      }).then(handle=>this.handles.push(handle));
    }
  }
  private key(suffix:string):string {return `gymbro.alarms.v1:${this.owner}:${suffix}`;}
  private read<T>(suffix:string,fallback:T):T {try {return JSON.parse(localStorage.getItem(this.key(suffix))||'null')??fallback;}catch{return fallback;}}
  private save(suffix:string,value:unknown):void {try {localStorage.setItem(this.key(suffix),JSON.stringify(value));}catch {this.message.set('No pudimos guardar la configuración de alarmas.');}}
  private queue(action:()=>Promise<void>):void {this.chain=this.chain.then(action).catch(()=>{this.message.set('No pudimos programar un aviso. Revisá los permisos de notificaciones.');});}

  private async switchOwner(scope:string|null):Promise<void> {
    // Cambiar de cuenta cancela avisos anteriores antes de programar los nuevos.
    this.owner=scope;this.timer=null;this.signature='';this.scheduledTimer=null;this.fired.clear();this.notice.set('');this.message.set('');
    this.settings.set(scope?{reminder:true,work:true,rest:true,...this.read<Partial<Settings>>('settings',{})}:{reminder:true,work:true,rest:true});
    this.routines=scope?this.read<Routine[]>('plan',[]):[];
    if(!Array.isArray(this.routines))this.routines=[];
    this.timer=scope?this.read<TimerAlarm|null>('timer',null):null;
    this.scheduledTimer=this.timer;
    if(this.timer&&this.timer.deadline<Date.now()-5000){this.remember(this.timer.key);this.notice.set('El tiempo terminó mientras la app estaba cerrada.');}
    if(scope)for(const key of this.read<string[]>('fired',[]))this.fired.add(key);
    this.queue(async()=>{
      if(this.native) {
        const pending=await LocalNotifications.getPending();
        const previous=pending.notifications.filter(notification=>notification.extra?.gymbro&&notification.extra.owner!==scope);
        if(previous.length)await LocalNotifications.cancel({notifications:previous.map(({id})=>({id}))});
      }
      if(this.owner===scope&&scope)await this.refreshPermissions();
    });
    if(scope) {this.reconcile();void this.refreshPlan(scope);}
  }
  private async refreshPlan(scope=this.owner):Promise<void> {
    if(!scope||!this.auth.token)return;
    try {
      const routines=await firstValueFrom(this.http.get<Routine[]>('/api/routines').pipe(timeout(15000)));
      if(this.owner===scope)this.updatePlan(routines);
    }catch { /* Mantiene el último calendario descargado para avisar sin conexión. */ }
  }
  async refresh():Promise<void> {
    if(!this.owner)return;
    try {await this.refreshPermissions();this.signature='';this.reconcile();void this.refreshPlan();}catch {this.message.set('No pudimos comprobar los permisos de avisos.');}
  }
  private async refreshPermissions():Promise<void> {
    if(this.native) {
      this.permission.set((await LocalNotifications.checkPermissions()).display);
      if(this.android)this.exact.set((await LocalNotifications.checkExactNotificationSetting()).exact_alarm==='granted');
      if(this.permission()==='granted')await this.createChannels();
    } else this.permission.set(typeof Notification==='undefined'?'unavailable':Notification.permission);
  }
  /** Solo un botón explícito abre el diálogo del sistema. */
  async enable():Promise<void> {
    this.unlockAudio();
    try {
      if(this.native)this.permission.set((await LocalNotifications.requestPermissions()).display);
      else if(typeof Notification!=='undefined')this.permission.set(await Notification.requestPermission());
      await this.refreshPermissions();
      this.message.set(this.permission()==='granted'?'Avisos habilitados. Podés probar el sonido.':'Activá las notificaciones desde los ajustes del dispositivo. El sonido dentro de la página sigue disponible.');
      this.signature='';this.reconcile();
    }catch {this.message.set('No pudimos habilitar los avisos. Revisá los permisos del dispositivo.');}
  }
  async requestExact():Promise<void> {
    try {if(this.android)await LocalNotifications.changeExactNotificationSetting();}catch {this.message.set('Abrí los ajustes de Gymbro para permitir avisos exactos.');}
  }
  setEnabled(kind:AlarmKind,enabled:boolean):void {
    this.settings.set({...this.settings(),[kind]:enabled});this.save('settings',this.settings());this.signature='';this.reconcile();
  }
  updatePlan(routines:Routine[]):void {
    if(!this.owner)return;
    this.routines=routines;this.save('plan',routines);this.reconcile();
  }
  /** Se usa tras una asignación confirmada, incluso si la biblioteca aún no recargó todo. */
  updateSchedule(dayId:string,schedule:Routine['days'][number]['schedule']):void {
    this.updatePlan(this.routines.map(routine=>({...routine,days:routine.days.map(day=>day.id===dayId?{...day,schedule}:day)})));
    void this.refreshPlan();
  }
  trackTimer(timer:TimerAlarm|null):void {
    if(!this.owner)return;
    const previous=this.timer;
    this.timer=timer;
    if(JSON.stringify(previous)===JSON.stringify(timer))return;
    this.save('timer',timer);
    this.reconcile();
  }
  private async createChannels():Promise<void> {
    if(!this.android)return;
    for(const kind of ['reminder','work','rest'] as const)await LocalNotifications.createChannel({id:CHANNELS[kind],name:kind==='reminder'?'Preparación para entrenar':kind==='work'?'Fin de serie':'Fin de descanso',importance:5,visibility:1,sound:SOUNDS[kind],vibration:true});
  }
  private reconcile():void {
    const owner=this.owner;if(!owner)return;
    const desired=this.timer&&this.settings()[this.timer.kind]?this.timer:null;
    const signature=JSON.stringify({owner,permission:this.permission(),plan:this.settings().reminder?planReminders(this.routines):[],timer:desired});
    if(signature===this.signature)return;this.signature=signature;
    this.queue(async()=>{
      if(this.owner!==owner||!this.native||this.permission()!=='granted')return;
      const reminders=this.settings().reminder?planReminders(this.routines):[];
      const pending=await LocalNotifications.getPending();
      const notifications:LocalNotificationSchema[]=[];
      const used=new Set<number>();
      for(const reminder of reminders) {
        let id=alarmId('reminder:'+owner+':'+reminder.key);while(used.has(id))id++;used.add(id);
        notifications.push({id,title:'En 15 minutos entrenás',body:`Preparáte para ${reminder.name} a las ${reminder.start}.`,channelId:CHANNELS.reminder,sound:SOUNDS.reminder,
          schedule:{on:{weekday:reminder.weekday+1,hour:reminder.hour,minute:reminder.minute,second:0},repeats:true,allowWhileIdle:true},
          extra:{gymbro:true,owner,key:'reminder:'+reminder.key,kind:'reminder'}});
      }
      const timer=this.timer&&this.settings()[this.timer.kind]?this.timer:null;
      if(timer&&timer.deadline>Date.now()&&!this.fired.has(timer.key)) {
        let id=alarmId('timer:'+owner+':'+timer.key);while(used.has(id))id++;
        notifications.push({id,title:timer.kind==='work'?'Tiempo de serie cumplido':'Descanso terminado',body:timer.kind==='work'?`${timer.name}: registrá la serie cuando termines.`:'Ya podés preparar la próxima serie.',channelId:CHANNELS[timer.kind],sound:SOUNDS[timer.kind],
          schedule:{at:new Date(timer.deadline),allowWhileIdle:true},extra:{gymbro:true,owner,key:timer.key,kind:timer.kind}});
      }
      // Una alarma que vence justo al pasar a idle debe poder entregarse; pausar antes sí la cancela.
      const dueKey=this.scheduledTimer&&this.scheduledTimer.deadline<=Date.now()&&Date.now()-this.scheduledTimer.deadline<5000?this.scheduledTimer.key:null;
      const cancel=pending.notifications.filter(notification=>notification.extra?.gymbro&&notification.extra.owner===owner&&notification.extra.key!==dueKey);
      if(cancel.length)await LocalNotifications.cancel({notifications:cancel.map(({id})=>({id}))});
      if(this.owner!==owner)return;
      if(notifications.length)await LocalNotifications.schedule({notifications});
      this.scheduledTimer=timer;
    });
  }
  timerExpired(key:string):void {if(this.timer?.key===key)this.checkWeb();}
  private remember(key:string):void {this.fired.add(key);this.save('fired',[...this.fired].slice(-300));}
  private checkWeb():void {
    if(!this.owner||this.native&&this.permission()==='granted')return;
    const now=Date.now(),timer=this.timer;
    if(timer&&timer.deadline<=now&&this.settings()[timer.kind]&&!this.fired.has(timer.key)) {
      this.remember(timer.key);this.announce(timer.kind,timer.kind==='work'?'Tiempo de serie cumplido':'Descanso terminado',timer.kind==='work'?`${timer.name}: registrá la serie cuando termines.`:'Ya podés preparar la próxima serie.');
    }
    if(this.settings().reminder)for(const reminder of planReminders(this.routines)) {
      // Incluye el instante actual; nunca reproduce recordatorios antiguos al volver de horas de suspensión.
      const occurrence=nextReminder(reminder,new Date(now-60000));
      const key=`reminder:${reminder.key}:${occurrence.getTime()}`;
      if(occurrence.getTime()<=now&&now-occurrence.getTime()<60000&&!this.fired.has(key)) {
        this.remember(key);this.announce('reminder','En 15 minutos entrenás',`Preparáte para ${reminder.name} a las ${reminder.start}.`);
      }
    }
  }
  private announce(kind:AlarmKind,title:string,body:string):void {
    this.notice.set(body);this.beep(kind);
    if(!this.native&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.visibilityState!=='visible') {
      try {new Notification(title,{body,tag:`gymbro-${kind}`});}catch { /* Conserva el aviso dentro de la app. */ }
    }
  }
  unlockAudio():void {
    try {this.audio??=new AudioContext();if(this.audio.state==='suspended')void this.audio.resume();}catch { /* Android puede usar el sonido nativo aun sin Web Audio. */ }
  }
  private beep(kind:AlarmKind):void {
    if(!this.audio||this.audio.state!=='running')return;
    const frequencies=kind==='work'?[880,880,880]:kind==='rest'?[1320,1320]:[660,880,1100];
    const segment=3/frequencies.length;
    frequencies.forEach((frequency,index)=>{
      const oscillator=this.audio!.createOscillator(),gain=this.audio!.createGain(),start=this.audio!.currentTime+index*segment;
      const end=start+segment-(index===frequencies.length-1?0:.12);
      oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.18,start+.015);gain.gain.setValueAtTime(.18,end-.04);gain.gain.linearRampToValueAtTime(0,end);
      oscillator.connect(gain);gain.connect(this.audio!.destination);oscillator.start(start);oscillator.stop(end);
    });
  }
  async testSound():Promise<void> {
    this.unlockAudio();
    try {
      if(this.native&&this.permission()==='granted'){await this.createChannels();await LocalNotifications.schedule({notifications:[{id:2000000001,title:'Prueba de sonido',body:'Así te avisará Gymbro.',channelId:CHANNELS.rest,sound:SOUNDS.rest,extra:{gymbro:true,owner:this.owner,key:'test',kind:'rest'}}]});}
      else this.beep('rest');
    }catch {this.message.set('No pudimos reproducir el aviso. Revisá los permisos y el volumen.');}
  }
  ngOnDestroy():void {window.clearInterval(this.ticker);document.removeEventListener('visibilitychange',this.resume);for(const handle of this.handles)void handle.remove();void this.audio?.close();}
}
