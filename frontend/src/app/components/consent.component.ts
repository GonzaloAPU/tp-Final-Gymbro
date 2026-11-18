/** Permite aceptar una versión nueva o retirar el permiso para futuras cargas deportivas. */
import {Component, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {AuthService} from '../services/auth.service';
import {LegalService,legalDocuments} from '../services/legal.service';
@Component({standalone:true,imports:[RouterLink],template:`
  <main class="page consent"><h1>Tus datos, tu decisión</h1>
  <p>Leé los documentos de {{documents.operator}} antes de continuar. Las casillas no se marcan automáticamente.</p>
  <details><summary>Términos de uso · {{documents.version}}</summary>@for(s of documents.terms;track s.title){<h2>{{s.title}}</h2><p>{{s.text}}</p>}</details>
  <details><summary>Política de privacidad</summary>@for(s of documents.privacy;track s.title){<h2>{{s.title}}</h2><p>{{s.text}}</p>}</details>
  <label><input type="checkbox" [checked]="terms()" (change)="terms.set($any($event.target).checked)"> Acepto los términos de uso.</label>
  <label><input type="checkbox" [checked]="privacy()" (change)="privacy.set($any($event.target).checked)"> Leí la política de privacidad.</label>
  <label><input type="checkbox" [checked]="adult()" (change)="adult.set($any($event.target).checked)"> Confirmo que tengo 18 años o más.</label>
  <label><input type="checkbox" [checked]="sports()" (change)="sports.set($any($event.target).checked)"> Autorizo guardar mis datos deportivos (peso, altura, objetivos y entrenamientos) para personalizar rutinas y seguir mi progreso. Es opcional y puedo retirar este permiso.</label>
  <p>Sin ese permiso podés usar tu cuenta y consultar tus datos, pero no cargar nuevos entrenamientos o medidas. La IA requiere una autorización adicional al solicitarla.</p>
  @if(currentSports()){<button class="button" (click)="withdraw()" [disabled]="saving()">Retirar permiso deportivo</button>}
  @if(message()){<p role="status">{{message()}}</p>}
  <button class="button primary" (click)="save()" [disabled]="saving()">Guardar mi decisión</button>
  <a routerLink="/perfil">Volver al perfil</a> · <button class="button" (click)="logout()">Salir de mi cuenta</button>
  <p>Para solicitar acceso, corrección o eliminación escribí a {{documents.email}}. No envíes tu contraseña.</p></main>
  `,changeDetection: ChangeDetectionStrategy.Eager,
styles:[`.consent{max-width:720px;padding-block:30px 70px}.consent p{line-height:1.7;color:var(--muted)}label{display:flex;gap:12px;align-items:flex-start;margin:22px 0;line-height:1.6}input{margin-top:6px;min-width:20px;min-height:20px}details{padding:18px;border:1px solid var(--line);border-radius:14px;margin:12px 0}summary{cursor:pointer;color:var(--lime)}h2{font-size:18px}.button{margin:8px}a{color:var(--lime)}`]})
export class ConsentComponent {
  private readonly legal=inject(LegalService);private readonly router=inject(Router);private readonly auth=inject(AuthService);
  readonly documents=legalDocuments;readonly terms=signal(false);readonly privacy=signal(false);readonly adult=signal(false);readonly sports=signal(false);
  readonly currentSports=signal(false);readonly saving=signal(false);readonly message=signal('');
  constructor(){this.legal.status().subscribe({next:s=>this.currentSports.set(s.sportsDataConsent),error:()=>this.message.set('No pudimos consultar tu decisión anterior. Intentá de nuevo con conexión.')});}
  async save(){
    if(this.saving())return;
    if(!this.terms()||!this.privacy()||!this.adult()){this.message.set('Revisá los documentos y confirmá las tres casillas obligatorias.');return;}
    this.saving.set(true);this.message.set('');
    try{await firstValueFrom(this.legal.accept({version:legalDocuments.version,termsAccepted:true,privacyAcknowledged:true,adultConfirmed:true,sportsDataConsent:this.sports()}));await this.router.navigateByUrl(this.sports()?'/':'/perfil');}
    catch{this.message.set('No pudimos guardar tu decisión. Intentá nuevamente con conexión.');}finally{this.saving.set(false);}
  }
  async withdraw(){
    if(this.saving())return;this.saving.set(true);
    try{await firstValueFrom(this.legal.withdraw());this.currentSports.set(false);this.sports.set(false);this.message.set('Permiso retirado. Tus datos anteriores se conservan; podés solicitar su eliminación por correo.');}
    catch{this.message.set('No pudimos retirar el permiso. Intentá de nuevo con conexión.');}finally{this.saving.set(false);}
  }
  logout(){this.auth.logout();void this.router.navigateByUrl('/login');}
}
