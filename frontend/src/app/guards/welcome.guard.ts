/** Solo propone la bienvenida a cuentas sin rutinas que todavía no la aceptaron/omitieron. */
import {inject} from '@angular/core';
import {CanActivateFn,Router} from '@angular/router';
import {catchError,map,of,timeout} from 'rxjs';
import {WelcomeService} from '../services/welcome.service';
import {AuthService} from '../services/auth.service';
export const welcomeGuard:CanActivateFn=()=>{
  if(!inject(AuthService).isAuthenticated())return true;
  const router=inject(Router);
  return inject(WelcomeService).status().pipe(timeout(8000),map(status=>status.needed?router.createUrlTree(['/bienvenida']):true),catchError(()=>of(true)));
};
