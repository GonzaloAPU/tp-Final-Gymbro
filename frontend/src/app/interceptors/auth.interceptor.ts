/**
 * Añade el token Bearer a las peticiones /api mediante una copia inmutable de la solicitud. Las demás direcciones siguen su curso sin recibir el token.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { ApiEndpointService } from '../services/api-endpoint.service';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // Solo las rutas propias reciben el token; una URL externa nunca lo hereda.
  if (!/^\/api(?:\/|\?|$)/.test(request.url)) return next(request);
  const endpoint = inject(ApiEndpointService);
  if (endpoint.native && !endpoint.server()) return throwError(() => new Error('Configurá la conexión al servidor antes de ingresar.'));
  const token = inject(AuthService).token;
  return next(request.clone({ url: endpoint.url(request.url), ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}) }));
};
