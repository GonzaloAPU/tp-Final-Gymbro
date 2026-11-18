# Migración de Angular 19 a 22

Versiones finales: Angular 22.2.4, Angular CLI / @angular/build 22.2.5 y TypeScript 6.0.3. El frontend declara los requisitos de Node del framework; el entorno local Node 24.18.0 es compatible.

Se ejecutaron las migraciones oficiales por etapas 19 → 20 → 21 → 22. El migrador de CLI 21 interpretaba como texto un objeto devuelto por npm al consultar el nombre del workspace. Para la última etapa se corrigió temporalmente esa lectura en node_modules, haciendo que consultara package.json cuando la respuesta no fuera una cadena. No es un parche del producto y no se distribuye. Las instalaciones normales usan package-lock.json.

## Conservación del DOM

- provideZoneChangeDetection() mantiene Zone.js; los componentes conservan la estrategia anterior mediante ChangeDetectionStrategy.Eager, agregada por el migrador oficial.
- withXhr() conserva el transporte HTTP anterior. Se mantienen los interceptores de autenticación y persistencia.
- No se cambió la estructura persistente del carrusel, sus claves track ni sus manejadores de gestos. La instancia del entrenamiento continúa montada al cambiar de pestaña.
- Los selectores con opciones creadas por @for tienen una selección explícita por opción. En el navegador se detectó que el selector de sesiones mostraba la primera opción (2) aunque el modelo y los días indicaban 3. Se corrigió tanto en sesiones/duración como en los selectores dinámicos del entrenamiento.
- Se conservaron las adaptaciones oficiales de navegación opcional de plantillas en el perfil, para preservar el tratamiento de valores nulos.

## Herramientas

El builder application se ejecuta ahora mediante @angular/build, sin depender del paquete antiguo @angular-devkit/build-angular. Se retiró baseUrl, obsoleto en TypeScript 6 y sin uso por alias en el proyecto. Continúan activados strict y strictTemplates.

Los simuladores de las pruebas reconocen ChangeDetectionStrategy.Eager. No se sustituyeron las pruebas de estado y gestos por comprobaciones de texto.

## Verificación

- Compilación de producción y comprobación de tipos aprobadas.
- Suite completa del frontend aprobada, incluidas navegación, recuperación del entrenamiento y persistencia.
- 222 pruebas backend y 23 pruebas PostgreSQL embebido aprobadas.
- Navegador con backend ficticio local: ng-version=22.2.4; descripciones desplegables; reloj que avanza sin intervención; peso editado que se conserva al navegar; gesto horizontal; ausencia de errores y advertencias de consola durante el recorrido.
- Formulario real: inicialmente muestra 3 sesiones con 3 días; cambiar a 4 sesiones genera 4 días; 60 minutos actualiza las horas finales a 19:00. Desplazamiento vertical comprobado con viewport de 390×844.

Las comprobaciones visuales usaron datos ficticios y no generaron consultas a Gemini. No se compiló ni probó una APK en un teléfono físico. Este cambio no modifica el esquema de PostgreSQL ni despliega a producción.

Referencias: https://angular.dev/update y https://angular.dev/guide/zoneless.
