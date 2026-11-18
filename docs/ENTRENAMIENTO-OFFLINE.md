# Recuperación del entrenamiento y cola local

La pantalla Entrenar guarda un respaldo en localStorage, separado por usuario y servidor. Recupera ejercicios, borradores de kilos/repeticiones, series registradas, grupo encadenado, relojes y pausas después de recargar o cerrar la app.

Los relojes conservan sus marcas de tiempo: si estaban en marcha, cuentan también el tiempo con la app cerrada. Si estaban pausados, conservan el tiempo. Un descanso vencido pasa a espera; no inicia la serie siguiente. Una serie no se completa automáticamente por alcanzar su duración.

## Guardar en el dispositivo y sincronizar

1. Iniciar, agregar ejercicio, registrar/repetir serie y finalizar generan operaciones con UUID estable.
2. La operación se escribe en localStorage antes de confirmarla en la pantalla.
3. Una cola envía las operaciones en orden. El cierre espera detrás de las series anteriores.
4. Si falla la red o se pierde la respuesta, la operación conserva su UUID y se reintenta.
5. PostgreSQL guarda el recibo en `session_mutations` dentro de la misma transacción. Un reintento recupera esa respuesta; no vuelve a ejecutar la escritura.

El respaldo de pantalla y un diario de operaciones protegen también un cierre entre encolar una acción y reflejarla en la tarjeta. Las operaciones confirmadas por el servidor se retiran de la cola; el diario se limpia después de quedar reflejado en un checkpoint de pantalla.

La interfaz muestra cambios pendientes y permite reintentar manualmente. También reintenta cuando vuelve la red y cada 15 segundos. Una marca pendiente significa registrada en el dispositivo; la tilde indica que ya no tiene operaciones pendientes.

Un error de autenticación o validación no elimina la operación. Se conserva el respaldo y se muestra el motivo. La sincronización necesita la misma cuenta y el mismo servidor. No envía datos de la cuenta anterior al cambiar de usuario.

## Cierre seguro

Guardar series y finalizar bloquean la fila de la sesión en una transacción. Esto evita que un cierre lea totales anteriores a una serie que se está guardando simultáneamente.

- `COMPLETED`: devuelve fecha, duración y totales originales sin actualizarlos.
- `CANCELLED`: rechaza el cierre.
- Un reintento de una serie ya confirmada puede recuperar su recibo incluso después de finalizar.
- Una operación nueva no puede agregar ni modificar series de una sesión cerrada.
- Un reintento antiguo de PUT no sobrescribe una edición posterior.

## Alcance del prototipo

- El primer ingreso y la descarga inicial del catálogo/plan requieren conexión. El respaldo permite recuperar un entrenamiento que ya se preparó en ese dispositivo.
- No se borran pendientes al cerrar sesión: la misma cuenta puede recuperarlos al volver.
- Borrar los datos de la app, desinstalarla o limpiar el almacenamiento del navegador elimina los datos locales que todavía no llegaron al servidor.
- Si se agota el almacenamiento o el respaldo está dañado, se muestra el error. No se presenta la acción como guardada ni se reemplaza silenciosamente el archivo dañado.
- Se conserva una sesión local visible por cuenta/servidor. No se implementa edición colaborativa del mismo entrenamiento desde varios dispositivos.
- Web Locks serializa escrituras de cola y sincronización entre pestañas cuando está disponible. El fallback serializa dentro de la instancia de la app.
- La cola no resuelve automáticamente conflictos de validación o una sesión cerrada desde otro dispositivo: conserva los datos para revisión.
- No se guardan contraseñas ni tokens en el respaldo del entrenamiento. La autenticación continúa usando el mecanismo existente de la aplicación.

## Verificación

```bash
npm test
npm run test:recovery
npm run db:verify:sync --workspace backend
```

Las pruebas habituales del backend usan modelos simulados y no modifican PostgreSQL. `test:recovery` usa el componente, servicio de sesiones y cola reales del frontend con almacenamiento, HTTP y reloj simulados.

`db:verify:sync` es una integración contra la copia llamada `gymbro_normalization_test`. Requiere una copia previamente normalizada y un catálogo oficial. Crea sus propios datos de prueba y los elimina al terminar. No apunta a la base principal.

La migración local se ejecuta con `npm run db:migrate`. El backend desplegado y el APK instalado requieren su actualización por separado; compilar Angular no regenera el APK.
