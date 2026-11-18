/**
 * Asocia cada URL con una pantalla. canActivate comprueba la sesión antes de entrar; ** captura direcciones desconocidas y redirige al inicio.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { Routes } from '@angular/router';
import {TabRouteComponent} from './components/tab-route.component';
import { WorkoutRouteComponent } from './components/workout-route.component';
import { LoginComponent } from './components/login.component';
import { RegisterComponent } from './components/register.component';
import { ProfileComponent } from './components/profile.component';
import { authGuard } from './guards/auth.guard';
import { RoutineBuilderComponent } from './components/routine-builder.component';
import { ConnectionComponent } from './components/connection.component';
import {welcomeGuard} from './guards/welcome.guard';
import {legalGuard} from './guards/legal.guard';

export const routes: Routes = [
  {path:'recuperar-contrasena',loadComponent:()=>import('./components/forgot-password.component').then(m=>m.ForgotPasswordComponent)},
  {path:'privacidad/ajustes',loadComponent:()=>import('./components/privacy-settings.component').then(m=>m.PrivacySettingsComponent),canActivate:[authGuard,legalGuard]},
  {path:'terminos',loadComponent:()=>import('./components/legal.component').then(m=>m.LegalComponent)},
  {path:'privacidad',data:{kind:'privacy'},loadComponent:()=>import('./components/legal.component').then(m=>m.LegalComponent)},
  {path:'consentimiento',loadComponent:()=>import('./components/consent.component').then(m=>m.ConsentComponent),canActivate:[authGuard]},
  { path: 'conexion', component: ConnectionComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegisterComponent },
  { path: 'bienvenida',data:{sports:true}, loadComponent:()=>import('./components/welcome.component').then(module=>module.WelcomeComponent),canActivate:[authGuard,legalGuard] },
  { path: '',data:{tab:0}, component: TabRouteComponent, canActivate: [authGuard,legalGuard,welcomeGuard] },
  { path: 'entrenamiento',data:{sports:true}, component: WorkoutRouteComponent, canActivate: [authGuard,legalGuard] },
  { path: 'progreso',data:{tab:2}, component: TabRouteComponent, canActivate: [authGuard,legalGuard] },
  { path: 'perfil',data:{tab:3}, component: TabRouteComponent, canActivate: [authGuard,legalGuard] },
  { path: 'perfil/editar', component: ProfileComponent, canActivate: [authGuard,legalGuard] },
  { path: 'rutinas/nueva', component: RoutineBuilderComponent, canActivate: [authGuard,legalGuard] },
  { path: '**', redirectTo: '' },
];
