/**
 * Formulario de ingreso. Evita la recarga del navegador, muestra el estado de espera y navega al inicio cuando AuthService guarda la sesión.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { finalize } from 'rxjs';
import { ApiEndpointService } from '../services/api-endpoint.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  // HTML Angular: {{ }} muestra datos, [propiedad] enlaza valores y (evento) llama métodos.
  // @if y @for controlan bloques visibles y listas; #nombre referencia un elemento del formulario.
  template: `
    <section class="auth-page">
      <form class="auth-card" (submit)="submit($event, email.value, password.value)">
        <span class="kicker">INICIAR SESIÓN</span>
        <h2>Iniciá sesión</h2>
        <p>Si ya tenés una cuenta de Gymbro, ingresá tus datos.</p>
        <label>Email<input #email type="email" autocomplete="email" placeholder="vos@email.com" required></label>
        <label>Contraseña<input #password type="password" autocomplete="current-password" placeholder="Mínimo 8 caracteres" minlength="8" required></label>
        <a class="forgot-password" routerLink="/recuperar-contrasena">Olvidé mi contraseña</a>
        @if (error()) { <div class="form-error">{{ error() }}</div> }
        <button class="button primary" type="submit" [disabled]="loading()">{{ loading() ? 'Ingresando…' : 'Iniciar sesión' }} <span>→</span></button>
        <div class="switch">¿Es tu primera vez? <a class="button ghost" routerLink="/registro">Crear una cuenta nueva</a></div>
        <p class="switch"><a routerLink="/terminos">Términos</a> · <a routerLink="/privacidad">Privacidad</a></p>
        @if (endpoint.native) { <a class="connection-link" routerLink="/conexion">Configurar conexión al servidor</a> }
      </form>
    </section>
  `,
  // CSS de este componente: disposición, colores y estados; @media adapta la vista a pantallas pequeñas.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [loginStyles()],
})
export class LoginComponent {
  readonly endpoint = inject(ApiEndpointService);
  // Dependencias y estado de la clase: inject obtiene servicios; signal conserva valores reactivos.
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  /** Valida el formulario, solicita ingresar y navega al inicio; finalize libera el estado de espera tanto al acertar como al fallar. */
  submit(event: Event, email: string, password: string): void {
    event.preventDefault();
    if (this.loading()) return;
    if (!email || password.length < 8) { this.error.set('Completá email y contraseña'); return; }
    this.loading.set(true); this.error.set('');
    this.auth.login({ email, password }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (error: HttpErrorResponse | Error) => { this.error.set(error instanceof HttpErrorResponse ? error.error?.message || 'No pudimos conectar con el servidor. Intentá nuevamente.' : error.message); },
    });
  }
}

function loginStyles(): string {
  return `
  .forgot-password{color:var(--lime);align-self:flex-end;font-size:13px;margin:0 0 16px;padding:4px 0}.auth-page{min-height:calc(100dvh - 72px);display:flex;align-items:center;width:min(500px,calc(100% - 28px));margin:auto;padding:28px 0}.kicker{color:var(--lime);font-size:11px;letter-spacing:.18em;font-weight:800}.auth-card{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:clamp(26px,4vw,44px);display:flex;flex-direction:column;width:100%}.auth-card h2{font-size:34px;margin:10px 0 4px}.auth-card>p{color:var(--muted);margin:0 0 28px;font-size:14px}.auth-card label{display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:700;margin-bottom:17px}.auth-card input{background:var(--surface-2);border:1px solid var(--line);color:var(--text);border-radius:12px;padding:14px 15px;outline:none}.auth-card input:focus{border-color:var(--lime)}.auth-card .button{margin-top:8px;width:100%;justify-content:space-between}.auth-card .button:disabled{opacity:.55}.form-error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#fca5a5;border-radius:10px;padding:11px;font-size:12px;margin-bottom:8px}.connection-link{border:0;background:transparent;color:var(--muted);font-size:12px;padding:15px;cursor:pointer}.connection-link:hover{color:var(--text)}.switch{text-align:center;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:19px}.switch a{color:var(--lime);font-weight:700}@media(max-width:760px){.auth-page{min-height:calc(100dvh - 72px);display:flex;align-items:center;width:min(500px,calc(100% - 28px));margin:auto;padding:28px 0}.auth-card{max-width:500px;width:100%;margin:auto;width:100%}}
`;
}
