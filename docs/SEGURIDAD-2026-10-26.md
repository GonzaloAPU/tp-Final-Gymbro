# Revisión de seguridad — 26 de octubre de 2026

## Dictamen

No recomendar el lanzamiento público todavía. La revisión encontró dependencias vulnerables y controles pendientes. Las pruebas funcionales aprobadas no certifican ausencia de vulnerabilidades. Esta revisión cubre código local, dependencias npm, pruebas con modelos simulados y PostgreSQL embebido; no es un pentest del entorno productivo ni una auditoría completa del APK.

Base revisada: commit `0d239ef` más las correcciones locales de esta revisión. No se enviaron ataques a Render, Supabase, Google o EmailJS, ni se modificaron cuentas reales.

## Dependencias: antes y después de los parches compatibles

| Alcance | Antes | Después |
| --- | --- | --- |
| Backend instalado sin desarrollo | 7: 1 crítica, 2 altas, 4 moderadas | 4: 0 críticas, 1 alta, 3 moderadas |
| Proyecto completo, incluyendo herramientas | 59: 4 críticas, 32 altas, 21 moderadas, 2 bajas | 56: 3 críticas, 31 altas, 20 moderadas, 2 bajas |

Son entradas de paquetes afectadas informadas por npm, no cantidades de ataques exitosos ni CVE únicos. Los efectos transitivos pueden contabilizar tanto la biblioteca vulnerable como su dependiente. Las alertas de herramientas no implican necesariamente código incluido en la app distribuida.

Se actualizaron versiones compatibles en `package-lock.json`: `body-parser` del backend 2.3.0 → 2.4.0, `proxy-addr` 2.0.7 → 2.0.8 y `moment` 2.30.1 → 2.31.0; también se actualizaron copias compatibles de `qs` y `body-parser` de desarrollo. No se cambiaron versiones principales de Angular, Zod o Sequelize.

### Pendientes que bloquean la salida

1. **Angular 19.2.15:** tiene avisos de XSS/sanitización y otras fallas; Angular 19 ya no tiene soporte oficial. Migrar de forma escalonada a una versión soportada y repetir compilación, pruebas de navegador y Android. La auditoría incluye avisos de SSR e hidratación; este proyecto no configura SSR, por lo que esos avisos no prueban exposición de esa función.
2. **Zod 3.25.76:** aviso alto por agotamiento de memoria al validar colecciones. El parche informado está en 4.6.6 o posterior y requiere revisar la migración a Zod 4. Hay límite JSON de 1 MB, pero no sustituye el parche. Revisar también máximos de colecciones en creación de rutinas.
3. **Login y registro sin limitador de intentos:** `auth.js` no limita solicitudes antes de ejecutar bcrypt. Implementar límites de abuso, contemplando el proxy de Render, sin confiar arbitrariamente en `X-Forwarded-For`. Probar con cuentas ficticias; no aplicar pruebas de fuerza bruta contra usuarios reales. Los límites de recuperación y Gemini no protegen el login.
4. **`qs` 6.15.3 usado por Express:** queda un aviso moderado; otras copias ya usan 6.16.1. Resolver esa dependencia con una versión de Express corregida o una resolución transitiva revisada y probada.
5. **`uuid` 8.3.2 vía Sequelize 6.37.8:** queda el aviso moderado sobre v3/v5/v6 con buffer. En el código inspeccionado de Sequelize se observaron llamadas v1/v4, no las APIs indicadas por el aviso. Esto reduce la exposición observada, no certifica ausencia de riesgo. No bajar Sequelize a 3.30.0 siguiendo automáticamente el remedio sugerido por npm; revisar una actualización/resolución compatible.
6. **Herramientas de desarrollo:** quedan alertas críticas en el árbol completo, incluidas bibliotecas de compilación/extracción/ejecución de comandos. Revisar Angular CLI/build, `concurrently` y transitivas. Mantener los servidores de desarrollo fuera de Internet.

## Problemas reproducidos y corregidos localmente

### Filtración de errores

Una prueba con un error ficticio de base de datos confirmó que el manejador devolvía su mensaje interno y entregaba el objeto completo a `console.error`, incluyendo potencialmente SQL y parámetros. Ahora los errores 5xx conservan su código HTTP pero devuelven un mensaje genérico. Los registros contienen solo estado y categoría. La validación SQL no devuelve instancia ni valor; los errores Zod se limitan a 20 campos y no incluyen el objeto de entrada. JSON mal formado y cuerpos excesivos tienen mensajes controlados.

### Validación de JWT

Las pruebas previas confirmaron aceptación de un token sin esquema Bearer, HS384 y ausencia de `sub`, todos ellos **firmados con la clave de prueba del propio servidor**. No son una demostración de falsificación de tokens sin clave. Se reforzó el contrato: Bearer obligatorio, HS256 explícito e identificador de usuario no vacío. Las firmas incorrectas y enlaces vencidos continúan rechazándose.

### Cabeceras de la API

Se deshabilitó `X-Powered-By` y se agregaron `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store` a `/api`. La página de recuperación mantiene su CSP con nonce. El frontend alojado por separado necesita revisar sus propias cabeceras en su proveedor de hosting.

Las sondas locales posteriores confirman que ya no se reflejan mensajes internos ni objetos completos de error, se rechazan los tres casos JWT descritos y aparecen las cabeceras nuevas. El perfil sin token responde 401; un origen no autorizado no recibe permiso CORS. CORS no reemplaza la autenticación.

## Comprobaciones aprobadas

- Backend después de los cambios: **216 pruebas**, sin fallos, incluyendo permisos entre cuentas, propiedad de rutinas/ejercicios/sesiones, JWT, recuperación con vencimiento/uso único, errores y cabeceras.
- Suite completa del frontend aprobada antes de los parches compatibles; verificación de compilación repetida después de actualizar dependencias.
- PostgreSQL embebido: **17 pruebas**, sin fallos, incluyendo privilegios de roles, integridad, migraciones y conservación de datos.
- TLS de Supabase se configura con verificación de certificados; no se observó desactivación de esta protección en las opciones inspeccionadas.
- Búsqueda acotada en **227 archivos de texto versionados**: sin coincidencias de claves Google con formato conocido, tokens GitHub ni cabeceras PEM de clave privada. No se revisó todo el historial Git ni se certifica ausencia de otros formatos de secretos. Solo están versionados archivos `.env.example`, no los `.env` reales.

## Node, PHP y Java

El runtime usado por estas pruebas locales es Node **24.18.0**. Debe actualizarse a una versión corregida: Node publicó **24.22.1** con parches el 21 de octubre. Los logs de Render compartidos previamente por el usuario mostraban 24.22.1, pero esta revisión no confirmó el runtime vivo actual. `render.yaml` selecciona la línea 24 y no demuestra por sí mismo qué parche está desplegado.

La aplicación no tiene backend PHP. La fuente Java propia encontrada es el contenedor Android de Capacitor, no un servidor Java. Eso no exime de revisar el JDK, Gradle, Android SDK, WebView y dependencias nativas.

## Android y producción: sin certificar todavía

El manifiesto principal deshabilita backups y tráfico HTTP; el manifiesto debug permite tráfico HTTP y el script `android:apk` genera `assembleDebug`. La salida al mercado necesita APK/AAB release firmado, revisión del manifiesto fusionado final y pruebas en dispositivo. No se hizo análisis binario, revisión de dependencias Gradle, prueba de un APK release ni evaluación dinámica del almacenamiento de tokens. La app conserva token/perfil y datos offline en almacenamiento local; revisar el riesgo en dispositivos compartidos o comprometidos y el almacenamiento seguro nativo antes de distribuir.

También quedan pendientes comprobación del despliegue real, roles/credenciales efectivos de Supabase, copias y restauración, controles de abuso en el borde, configuración del hosting del frontend y pruebas externas acotadas con cuentas desechables. No se accedió a la configuración privada de Render o Supabase.

## Repetir las verificaciones

```text
npm audit --omit=dev --workspace backend --json
npm audit --json
npm run test --workspace backend
npm run test:frontend
npm run supabase:test
npm run build --workspace frontend
```

Los resultados JSON originales y las sondas locales están en la carpeta de artefactos de esta conversación (`npm-audit-all-before.json`, `npm-audit-all-after.json`, `npm-audit-backend-after.json`, `security-probes.json`). Las correcciones de esta revisión permanecen locales hasta su revisión y despliegue; el entorno productivo no está corregido por el mero hecho de pasar estas pruebas.

## Fuentes

- [Node: actualizaciones de seguridad del 21 de octubre de 2026](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
- [Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1).
- [Política de soporte y actualización de Angular](https://angular.dev/reference/releases).
- [Aviso de proxy-addr y parche 2.0.8](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- [Aviso de Zod y parche 4.6.6](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- [Aviso de uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- Los demás avisos, rangos y dependencias se conservan en la salida JSON de npm.
