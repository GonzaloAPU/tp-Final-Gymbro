/** Configuración técnica opcional; el APK ya incluye el servidor de producción. */
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiEndpointService } from '../services/api-endpoint.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page connection">
      <p class="eyebrow">GYMBRO ANDROID</p><h1>Conectá tu gimnasio</h1>
      <p>Gymbro ya incluye su servidor. Esta pantalla permite comprobar la conexión o configurar otro servidor de pruebas.</p>
      <label for="server">Dirección del servidor</label>
      <input id="server" #server type="url" [value]="endpoint.server()" placeholder="http://192.168.1.20:3000" autocomplete="url" autocapitalize="off">
      <p>La conexión pública usa HTTPS. Para cambiar de servidor, cerrá sesión primero.</p>
      <button class="button primary" [disabled]="checking()" (click)="save(server.value)">{{ checking() ? 'Comprobando…' : 'Guardar y comprobar conexión' }}</button>
      <p role="status">{{ message() }}</p>
      <a class="button ghost" routerLink="/login">Volver a ingresar</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`.connection{max-width:520px;padding-block:40px}.eyebrow{color:var(--lime);font-weight:800}.connection p{color:var(--muted);line-height:1.6}.connection label{display:block;margin-top:28px}.connection input{width:100%;padding:16px;margin-top:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text)}.connection button{width:100%}`],
})
export class ConnectionComponent {
  readonly endpoint = inject(ApiEndpointService);
  readonly checking = signal(false);
  readonly message = signal('');
  /** Comprueba salud sin enviar el token del usuario; no modifica datos del servidor. */
  async save(value: string): Promise<void> {
    this.checking.set(true);
    try {
      this.endpoint.save(value);
      const response = await fetch(`${this.endpoint.server()}/api/health`, { signal: AbortSignal.timeout(10000) });
      const health = await response.json();
      if (!response.ok || health.service !== 'smartgymbro-api' || health.status !== 'ok') throw new Error('La dirección no responde como backend de Gymbro.');
      this.message.set('Conexión lista. Ya podés ingresar con tu cuenta.');
    } catch (error) {
      this.message.set(`No se pudo conectar: ${error instanceof Error ? error.message : 'revisá la dirección y el Wi-Fi'}`);
    } finally { this.checking.set(false); }
  }
}
