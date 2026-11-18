# Bienvenida y plan inicial

La ruta `/bienvenida` ofrece tres pasos: datos básicos y experiencia, lugar/equipamiento y disponibilidad, y propuesta semanal. El registro lleva a esta pantalla. Una cuenta sin rutinas que todavía no la aceptó ni omitió también llega desde Inicio. Las cuentas con rutinas conservan su navegación habitual.

## Dos modos, identificados en pantalla

- **LOCAL:** biblioteca de candidatos incluida en `backend/src/services/welcome-planner.js`. Resuelve IDs del catálogo oficial, adapta series/repeticiones/descansos y distribuye sesiones. No consulta proveedores ni genera claves. «Local» significa sin servicio de IA: el registro y la persistencia siguen requiriendo el backend de Gymbro.
- **GEMINI:** solicita una propuesta al proveedor con formato JSON y valida sus IDs, equipamiento, series, repeticiones, duración, distribución y límites iniciales. Los horarios los calcula Gymbro. No se guarda ni se presenta como válida una respuesta que no supera las comprobaciones. El usuario puede elegir el plan local si hay errores o se agotó la cuota.

Se envían a Gemini objetivo, experiencia, lugar, equipamiento, cantidad de sesiones y minutos. No se envían edad, altura, peso, restricciones, nombre, correo, foto, identificador del usuario ni horarios exactos. La pantalla solicita consentimiento explícito. Las propuestas de Gemini usan tres series por ejercicio, sin compartir la edad. Gymbro vuelve a validar el resultado. Esto minimiza datos, pero no promete anonimato ni sustituye las condiciones del proveedor.

## Configurar Gemini

En `backend/.env`, configurar `GEMINI_ENABLED=true`, `GEMINI_API_KEY` y, opcionalmente, `GEMINI_MODEL` (por defecto `gemini-2.5-flash`). Reiniciar el backend después de cambiar variables de entorno. Sin clave o sin habilitación explícita, el selector IA está deshabilitado y el modo local funciona normalmente. Nunca colocar la clave en Angular, Capacitor ni Git.

No se configuró ni consumió una clave real durante esta implementación. La integración externa se verificó con respuestas simuladas. Revisar disponibilidad/cuotas y condiciones de tratamiento de datos antes de habilitar perfiles reales. En particular, no enviar información personal/sensible al servicio gratuito si sus términos lo prohíben. Referencias: https://ai.google.dev/gemini-api/terms y https://ai.google.dev/gemini-api/docs/structured-output.

El prototipo limita la generación con IA a tres intentos por cuenta cada diez minutos y una generación activa a la vez. El límite vive en memoria del proceso; para varias instancias hace falta un limitador compartido. No hay regeneración automática al abrir la app.

## Reglas y alcance

Cada sesión generada contiene cuatro ejercicios distintos como mínimo (el límite actual también es cuatro). Gemini recibe ese requisito y se rechazan respuestas con menos ejercicios. Cada ejercicio tiene tres series como mínimo (el límite actual también es tres). Si el tiempo no alcanza, se solicita aumentar la duración sin reducir ejercicios ni series. La interfaz ofrece duraciones desde 45 minutos.

Un plan nuevo reemplaza las rutinas y el calendario anteriores al aceptarlo, dentro de una transacción. Generar, cancelar o fallar una propuesta no modifica la semana vigente. Las rutinas anteriores se archivan mediante borrado lógico: el historial de entrenamientos se conserva. Los descansos se recalculan desde la semana nueva, sin heredar bloqueos anteriores.

Se permiten de dos a siete sesiones. Se prioriza separar sesiones de cuerpo completo; si los días elegidos son consecutivos, se distribuyen bloques de tren superior, inferior y zona media según la cantidad de sesiones. Gemini recibe esta distribución y el backend la valida. Elegir siete sesiones no obliga a inventar un día de descanso.

Entrenamiento general para adultos de 18 a 85 años, con objetivos de condición física, fuerza o desarrollo muscular. La edad y experiencia limitan el volumen inicial; peso y altura se registran y se incluyen en la propuesta IA, pero no se usan para inventar una carga en kilos. No se prescriben tratamientos, diagnóstico, fisioterapia o rehabilitación. Dolor, lesión o restricciones derivan a creación manual con indicaciones profesionales.

Los planes locales son propuestas iniciales de software, no programas clínicos ni plantillas con una certificación profesional atribuida. Requieren revisión de contenido por un profesional antes de una distribución pública amplia.

Se ofrecen dos o tres sesiones de cuerpo completo con separación semanal, o cuatro sesiones alternando tren superior/inferior. El cálculo considera domingo-lunes, ventanas completas, reservas existentes y máximo de tres bloques por día. Si no hay una combinación compatible, pide cambiar disponibilidad o número de sesiones. Las duraciones incluyen un margen estimado de preparación/recuperación; no son mediciones exactas.

## Persistencia y reintentos

Ejecutar `npm run db:migrate`. La versión `20261021_welcome` agrega `welcome_plans`: una propuesta por usuario, con entrada y salida como documentos históricos, fuente y confirmación. Sus JSONB representan una propuesta, no reemplazan las tablas normalizadas de la aplicación.

La vista previa todavía no crea rutinas, pesajes ni asignaciones. La propuesta se recupera al volver a abrir la bienvenida. Una propuesta nueva invalida el ID anterior. Al aceptar, una transacción con bloqueo del usuario vuelve a comprobar catálogo/calendario y guarda rutina, días, ejercicios, horarios, descansos, perfil e historial de peso. Un fallo revierte todo. Repetir la aceptación del mismo ID devuelve la rutina ya creada sin duplicarla. Solo se accede a propuestas de la cuenta autenticada.

Las rutinas anteriores no se borran. Al aceptar se cambia la bandera de rutina activa, pero Entrenar sigue usando las asignaciones semanales existentes. Los nuevos descansos no cubren días donde ya había entrenamientos. Los avisos se actualizan al recargar las rutinas confirmadas.

## Verificación

- `npm test`: incluye pruebas unitarias del generador, respuestas IA simuladas y recorrido de la interfaz.
- `npm run db:verify:welcome --workspace backend`: prueba con PostgreSQL en `gymbro_normalization_test`. Crea una cuenta ficticia, verifica rollback por fallo de calendario, aislamiento, persistencia y reintento; elimina su cuenta al finalizar. Nunca escribe en `smartgymbro`.
- `npm run typecheck` y `npm run android:apk`: tipos y paquete instalable.

La base principal local recibió únicamente la nueva tabla y el registro de migración, después de crear un dump en `backups/`. No se aplicaron planes a cuentas reales ni se desplegó nada en servicios externos.
