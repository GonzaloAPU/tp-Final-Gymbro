import {Component, OnInit, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {AuthService} from '../services/auth.service';
import {LegalService,LegalStatus,legalDocuments} from '../services/legal.service';
@Component({standalone:true,imports:[RouterLink],template:`
  <main class="page settings"><h1>Privacidad y permisos</h1>
  <p>Tu peso corporal y tu foto no se publican en el ranking. Si participás, otros usuarios verán tu nombre, kilos levantados, repeticiones y fecha de tu marca.</p>
  <label><input type="checkbox" [checked]="auth.user()?.leaderboardOptIn===true" [disabled]="saving() || permission()?.needsAcceptance || (consentRequired() && !auth.user()?.leaderboardOptIn)" (change)="toggle($any($event.target))"> Participar en el ranking público de fuerza</label>
  @if(consentRequired()){<p>Para participar, primero revisá y autorizá el uso de tus datos deportivos en <a routerLink="/consentimiento">Gestionar consentimiento</a>.</p>}
  @if(message()){<p role="status">{{message()}}</p>}
  <p><a routerLink="/consentimiento">Gestionar consentimiento para datos deportivos</a></p>
  <p><a routerLink="/privacidad">Leer política de privacidad</a> · <a routerLink="/terminos">Leer términos de uso</a></p>
  <p>Para solicitar una copia, corrección o eliminación de tus datos y de tu cuenta, escribí a {{email}} desde el correo de tu cuenta. Verificaremos tu identidad; nunca envíes contraseñas.</p>
  <a class="button" [href]="contact">Solicitar acceso o eliminación por correo</a>
  <p>Retirar el permiso deportivo bloquea futuras cargas y te retira del ranking. No borra automáticamente el historial ni las copias de seguridad.</p>
  <a routerLink="/perfil">Volver al perfil</a></main>`,changeDetection: ChangeDetectionStrategy.Eager,
styles:[`.settings{max-width:720px;padding-block:30px 70px}p,label{line-height:1.8;color:var(--muted)}label{display:flex;gap:14px;align-items:center;margin:24px 0}input{min-width:22px;min-height:22px}a{color:var(--lime)}`]})
export class PrivacySettingsComponent implements OnInit {
  readonly auth=inject(AuthService);readonly saving=signal(false);readonly message=signal('');
  private readonly legal=inject(LegalService);
  readonly permission=signal<LegalStatus|null>(this.legal.cachedStatus());
  readonly consentRequired=signal(Boolean(this.permission()?.needsAcceptance||(this.permission()&&!this.permission()?.sportsDataConsent)));
  ngOnInit(){this.legal.status().subscribe({next:status=>{this.permission.set(status);this.consentRequired.set(status.needsAcceptance||!status.sportsDataConsent);},error:()=>{}});}
  readonly email=legalDocuments.email;
  readonly contact='mailto:'+this.email+'?subject='+encodeURIComponent('Gymbro — solicitud sobre mis datos');
  async toggle(input:HTMLInputElement){
    const leaderboardOptIn=input.checked;
    if(this.saving())return;this.saving.set(true);this.message.set('');
    try{
      const status=this.permission()??await firstValueFrom(this.legal.status());
      this.permission.set(status);
      if(status.needsAcceptance||(leaderboardOptIn&&!status.sportsDataConsent)){this.consentRequired.set(true);this.message.set('Revisá los consentimientos antes de cambiar tu participación.');return;}
      await firstValueFrom(this.auth.updateProfile({leaderboardOptIn}));this.message.set(leaderboardOptIn?'Participación habilitada.':'Tus marcas ya no se muestran en el ranking.');
    }
    catch(error:unknown){
      const failure=error as {status?:number;error?:{code?:string;message?:string}};
      if(failure.status===428){this.permission.set({needsAcceptance:failure.error?.code==='LEGAL_ACCEPTANCE_REQUIRED',sportsDataConsent:false,version:legalDocuments.version});this.consentRequired.set(true);this.message.set(failure.error?.message||'Revisá los consentimientos para continuar.');}
      else this.message.set('No pudimos guardar el cambio. Intentá nuevamente.');
    }
    finally{input.checked=this.auth.user()?.leaderboardOptIn===true;this.saving.set(false);}
  }
}
