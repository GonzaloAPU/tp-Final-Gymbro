/** Configuración del servidor: el navegador usa el proxy y Android una dirección accesible desde el teléfono. */
import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
export const DEFAULT_API_SERVER='http://localhost:3100';

export function normalizeServer(value: string): string {
  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Ingresá solamente la dirección del servidor, por ejemplo https://api.tudominio.com');
  }
  // HTTP sirve para probar en la red local; la versión pública debe usar HTTPS.
  return url.origin;
}

@Injectable({ providedIn: 'root' })
export class ApiEndpointService {
  readonly native = Capacitor.isNativePlatform();
  readonly server = signal(this.initialServer());
  /** Primera instalación/actualización: usa Render y no mezcla credenciales del servidor anterior. */
  private initialServer():string {
    const saved=localStorage.getItem('gymbro.api-server')||'';
    if(!this.native)return saved;
    if(localStorage.getItem('gymbro.default-api-version')!==DEFAULT_API_SERVER){
      if(saved!==DEFAULT_API_SERVER){
        localStorage.removeItem('smartgymbro_token');
        localStorage.removeItem('smartgymbro_user');
      }
      localStorage.setItem('gymbro.api-server',DEFAULT_API_SERVER);
      localStorage.setItem('gymbro.default-api-version',DEFAULT_API_SERVER);
      return DEFAULT_API_SERVER;
    }
    return saved||DEFAULT_API_SERVER;
  }
  /** Guarda únicamente la dirección pública del backend, nunca credenciales de PostgreSQL. */
  save(value: string): void {
    const server = normalizeServer(value);
    if (server !== this.server()) {
      // Un token emitido por otro servidor no debe enviarse a la nueva dirección.
      if (localStorage.getItem('smartgymbro_token')) throw new Error('Cerrá sesión antes de cambiar el servidor.');
      localStorage.setItem('gymbro.api-server', server);
      this.server.set(server);
    }
  }
  url(path: string): string { return this.native ? `${this.server()}${path}` : path; }
}
