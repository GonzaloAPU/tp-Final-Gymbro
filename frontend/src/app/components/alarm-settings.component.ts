/** Permisos y preferencias de avisos en este dispositivo. */
import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import {AlarmService} from '../services/alarm.service';
@Component({
  selector:'app-alarm-settings',standalone:true,
  template:`<section class="alarms" aria-labelledby="alarm-title"><h2 id="alarm-title">Mis alarmas</h2><p>Prepará tu entrenamiento y controlá los tiempos con avisos sonoros.</p>
    <label><input type="checkbox" [checked]="alarms.settings().reminder" (change)="alarms.setEnabled('reminder',$any($event.target).checked)">15 minutos antes de cada entrenamiento</label>
    <label><input type="checkbox" [checked]="alarms.settings().work" (change)="alarms.setEnabled('work',$any($event.target).checked)">Cuando termine el tiempo de la serie</label>
    <label><input type="checkbox" [checked]="alarms.settings().rest" (change)="alarms.setEnabled('rest',$any($event.target).checked)">Cuando termine el descanso</label>
    <div class="buttons"><button type="button" class="button primary" (click)="alarms.enable()">{{alarms.permission()==='granted'?'Revisar permisos':'Activar avisos'}}</button><button type="button" class="button ghost" (click)="alarms.testSound()">Probar sonido</button></div>
    @if(alarms.android&&!alarms.exact()) {<p>Para mejorar la puntualidad, permití las alarmas exactas de Gymbro.</p><button class="button ghost" type="button" (click)="alarms.requestExact()">Permitir avisos exactos</button>}
    @if(!alarms.native) {<p class="help">En la web, mantené la página abierta. Android puede programar los avisos del dispositivo.</p>}
    @if(alarms.message()) {<p class="help" role="status">{{alarms.message()}}</p>}
  </section>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles:[`.alarms{margin-top:22px;padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--surface)}h2{font-size:23px;margin:0 0 12px}p{font-size:13px;color:var(--muted);line-height:1.6}label{display:flex;align-items:center;gap:12px;font-size:14px;line-height:1.5;margin:18px 0}input{accent-color:var(--lime);width:22px;height:22px;flex-shrink:0}.buttons{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}.help{margin-bottom:0}.button{font-size:13px}`],
})
export class AlarmSettingsComponent {readonly alarms=inject(AlarmService);}
