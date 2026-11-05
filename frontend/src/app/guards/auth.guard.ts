/**
 * Control de navegación del frontend: permite entrar si existe una sesión local o devuelve una redirección al login. La autorización real también se verifica en el backend.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};
