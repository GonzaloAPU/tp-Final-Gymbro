/**
 * Pantalla Angular para pedir el correo, no para cambiar la contraseña.
 * No crea tokens ni llama directamente a EmailJS: eso corresponde al backend.
 * El enlace recibido abre el formulario independiente incluido en la API.
 */
import {Component, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AuthService} from '../services/auth.service';
@Component({standalone:true,imports:[RouterLink],template:`
  <section class="recovery-page"><form (submit)="submit($event,emailDraft())">
    <span class="kicker">RECUPERAR ACCESO</span><h1>¿Olvidaste tu contraseña?</h1>
    <p>Ingresá el correo de tu cuenta. Te enviaremos un enlace para elegir una nueva contraseña.</p>
    @if(!sent()){
      <label>Email<input type="email" (input)="emailDraft.set($any($event.target).value)" autocomplete="email" maxlength="254" placeholder="vos@email.com" [value]="emailDraft()" [disabled]="loading()" required></label>
      @if(error()){<p class="error" role="alert">{{error()}}</p>}
      <button class="button primary" type="submit" [disabled]="loading()">{{loading()?'Enviando…':'Enviar enlace de recuperación'}}</button>
    }@else{<p class="success" role="status">{{message()}}</p><p>El enlace dura 15 minutos. Abrilo desde tu correo y después volvé a Gymbro.</p><button type="button" class="change-email" (click)="sent.set(false)">Usar otro correo</button>}
    <a routerLink="/login">← Volver a iniciar sesión</a>
  </form></section>`,changeDetection: ChangeDetectionStrategy.Eager,
styles:[`
  .recovery-page{width:min(500px,calc(100% - 28px));margin:auto;padding:40px 0;min-height:calc(100dvh - 72px);display:flex;align-items:center}form{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:clamp(24px,5vw,40px)}h1{font-size:30px;line-height:1.2;margin:14px 0}.kicker{font-size:11px;letter-spacing:.12em;font-weight:800;color:var(--lime)}p{color:var(--muted);line-height:1.7;font-size:14px}label{display:flex;flex-direction:column;gap:8px;margin:24px 0;font-size:13px;font-weight:700}input{width:100%;min-width:0;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text);font:inherit}input:focus-visible{outline:2px solid var(--lime)}.primary{width:100%;justify-content:center}.primary:disabled{opacity:.5;cursor:wait}a{display:block;color:var(--lime);margin-top:26px;font-size:14px}.error{color:#fca5a5}.success{padding:16px;background:#a3e63510;border:1px solid #a3e63540;border-radius:12px}.change-email{border:0;background:transparent;color:var(--lime);padding:10px 0;font:inherit;cursor:pointer}
  `]})
export class ForgotPasswordComponent {
  // inject obtiene el cliente compartido que hace las peticiones HTTP.
  private readonly auth=inject(AuthService);

  // signal mantiene estado que Angular usa para actualizar la plantilla:
  // loading: espera; sent: confirmación genérica; error/message: textos;
  // emailDraft: conserva el correo si hace falta corregirlo o reintentar.
  readonly loading=signal(false);readonly sent=signal(false);readonly error=signal('');readonly message=signal('');readonly emailDraft=signal('');

  submit(event:Event,email:string){
    event.preventDefault();
    if(this.loading()||this.sent())return;
    const value=email.trim();
    this.emailDraft.set(value);

    // Validación de comodidad para el usuario. La API vuelve a validar el JSON:
    // la comprobación del navegador nunca sustituye la del servidor.
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){this.error.set('Ingresá un correo válido.');return;}
    this.loading.set(true);
    this.error.set('');

    // subscribe inicia la petición. finalize quita la espera tanto en éxito
    // como en error. No cerramos ni reemplazamos una sesión existente.
    this.auth.forgotPassword(value).pipe(
      finalize(()=>this.loading.set(false)),
    ).subscribe({
      next:result=>{
        // "sent" muestra la confirmación de solicitud; no prueba que exista
        // la cuenta ni que el proveedor ya haya entregado el correo.
        this.message.set(result.message);
        this.sent.set(true);
      },
      error:error=>{
        this.error.set(error.error?.message||'No pudimos enviar la solicitud. Revisá tu conexión e intentá de nuevo.');
      },
    });
  }
}
