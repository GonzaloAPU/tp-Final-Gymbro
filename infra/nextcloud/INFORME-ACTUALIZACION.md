# Informe de actualización de Nextcloud

**Proyecto:** SmartGymBro

**Responsable:** Gonzalo, administrador del proyecto

**Fecha:** 12 de noviembre de 2026

**Alcance:** Punto 12 de gestión documental

## Objetivo

Completar la instancia existente de Nextcloud con la documentación del equipo,
permisos por responsabilidad y evidencias que permitan comprobar las ocho
actividades solicitadas.

## Actualización aplicada

Se ejecutó `hooks/post-installation/01-setup-smartgymbro.sh`, que utiliza
`setup-smartgymbro.php` y `sincronizar-cierre.php`. El proceso trabaja con las APIs
de Nextcloud y conserva el volumen existente.

- Se crearon las cuentas `gonzalo`, `facundo`, `aldo`, `rodrigo` y `sonia`, sus grupos
  y seis áreas bajo `SmartGymBro-TP-Final`.
- Gonzalo quedó como propietario y administrador. Los demás integrantes pueden leer
  todas las áreas, editar la propia y el registro de entregables, sin volver a compartir.
- Se cargaron los diez informes del equipo y el informe de administración de Gonzalo,
  junto con su versión editable, la evidencia de Trello y los registros de comprobación.
- Se habilitó el historial y se registraron las revisiones mediante SHA-256. Se conservaron
  las versiones 1.0 y 1.1 del informe de administración.
- Se bloquearon los enlaces públicos, la subida pública y la redistribución de documentos.
- Se revisaron 56 páginas y se redactaron dos copias documentales con credenciales
  explícitas o predeterminadas. Se retiraron sus revisiones inseguras de Nextcloud;
  los originales de Descargas no se modificaron.

## Resultado de la verificación

La instancia real superó **30 combinaciones de usuario y carpeta**, con lectura,
escritura autorizada y rechazo fuera del área asignada. El acceso anónimo y una
contraseña incorrecta recibieron **HTTP 401**. La ejecución repetida reutilizó las
cuentas y comparticiones existentes.

Las evidencias están en `evidencias/verificacion-instancia-real.json` y en el área
`06-Registro-Versiones-Entregables` de Nextcloud. La revisión de seguridad está
registrada en `informes/REVISION-SEGURIDAD.json`.

## Estado y mantenimiento

Las ocho actividades quedaron implementadas y comprobadas en el alcance de esta
práctica local. Las claves iniciales de las cinco cuentas se guardaron en un archivo
privado, con permisos `0600`, fuera de Git y Nextcloud. La contraseña de `admin` no
se modificó. Cada integrante debe cambiar su clave inicial.

Para actualizar documentos o repetir la preparación, seguir la
[guía del repositorio](GUIA-REPOSITORIO.md). La actualización de contenido y configuración
no cambia la versión de la imagen de Nextcloud ni actualiza automáticamente sus aplicaciones.
