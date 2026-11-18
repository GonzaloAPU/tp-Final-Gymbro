/** Integra el arranque y el botón Atrás de Android sin desmontar la sesión al cambiar de pestaña. */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ApplicationRef } from '@angular/core';
import { Router } from '@angular/router';

export async function initializeMobile(application: ApplicationRef): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('native-app');
  const router = application.injector.get(Router);
  if (!localStorage.getItem('gymbro.api-server')) await router.navigateByUrl('/conexion');
  // En las pantallas principales minimizamos: salir con Atrás no destruye el entrenamiento.
  await App.addListener('backButton', () => {
    if (router.url.startsWith('/perfil/editar')) void router.navigateByUrl('/perfil');
    else if (['/', '/login', '/conexion'].includes(router.url)) void App.minimizeApp();
    else void router.navigateByUrl('/');
  });
}
