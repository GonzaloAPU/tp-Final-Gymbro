/**
 * Entrada de Angular en el navegador. Arranca AppComponent y registra el cliente HTTP, el interceptor de autenticación y las rutas.
 * Guía de estudio general: docs/GUIA-DE-ESTUDIO.md.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import {readCacheInterceptor} from './app/interceptors/read-cache.interceptor';
import { initializeMobile } from './app/mobile';
import {inject, provideAppInitializer, provideZoneChangeDetection} from '@angular/core';
import {ApiEndpointService} from './app/services/api-endpoint.service';

bootstrapApplication(AppComponent, {
  // Conserva Zone.js y XHR tras migrar a Angular 22: temporizadores, formularios y
  // respuestas HTTP actualizan el DOM como antes. Configura la API antes de navegar.
  providers: [provideZoneChangeDetection(),provideAppInitializer(()=>{inject(ApiEndpointService);}),provideHttpClient(withXhr(), withInterceptors([readCacheInterceptor,authInterceptor])), provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }))],
}).then(initializeMobile).catch(console.error);
