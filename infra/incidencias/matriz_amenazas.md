# Matriz de Amenazas de Seguridad - SmartGymBro
**Responsable:** Rodrigo (Seguridad, QA y Gestión de Incidencias)

Esta matriz identifica, evalúa y define las contramedidas para las amenazas críticas que afectan a la infraestructura y lógica de negocio de la aplicación.

| ID | Componente Afectado | Amenaza Identificada | Impacto | Prioridad | Mitigación / Contramedida Implementada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Base de Datos (PostgreSQL) | **Ransomware / Secuestro de datos:** Exposición del puerto 5432 que permite cifrado de tablas inyectadas con 6M de registros. | Crítico | Muy Alta | El puerto de la base de datos no se expone al exterior en el `compose.yml`. Copias de seguridad automáticas con `pg_dump` aisladas por Facundo. |
| **SEC-02** | API Backend (Node.js) | **Ataque de Denegación de Servicio (DDoS):** Consultas masivas y maliciosas a endpoints pesados de rutinas que saturan el servidor. | Alto | Alta | Implementación de Rate Limiting (`express-rate-limit`) en Node.js para limitar peticiones por IP y alertas automáticas mediante Prometheus y Grafana configuradas por Sonia. |
| **SEC-03** | Autenticación (JWT) | **Bypass de Autorización / Secuestro de sesión:** Tokens de sesión que no expiran o algoritmos débiles de firma. | Crítico | Alta | Validación estricta del parámetro `exp` en el middleware. Firmas robustas usando variables de entorno seguras alojadas en secretos de GitHub Actions (auditado en incidencia #000001). |
| **SEC-04** | Formulación de Consultas | **Inyección SQL (SQLi):** Manipulación de parámetros de filtrado en el historial de sets para extraer credenciales del sistema. | Crítico | Alta | Uso obligatorio del ORM Sequelize en Node.js, parametrizando de forma nativa todas las consultas y evitando sentencias SQL armadas mediante concatenación de strings. |
| **SEC-05** | Automatización (n8n) | **Abuso de Webhooks expuestos:** Inyección de datos sintéticos o falsificación de alertas de infraestructura para saturar Mantis. | Medio | Media | Implementación de firmas secretas y autenticación obligatoria (tokens) en los Webhooks receptores de n8n para validar el origen legítimo de Grafana. |
| **SEC-06** | Frontend (Angular 19) | **Cross-Site Scripting (XSS):** Inyección de scripts maliciosos en los campos de texto de comentarios de rutinas personalizadas. | Medio | Media | Uso de los mecanismos de sanitización nativos de Angular (`DomSanitizer`) y configuración de cabeceras de seguridad HTTP Content Security Policy (CSP) en el contenedor Nginx de Aldo. |


## Plan de Respuesta ante Incidentes de Seguridad

Este protocolo define las acciones inmediatas que el equipo de SmartGymBro debe ejecutar ante la confirmación de un compromiso de seguridad o falla crítica reportada en Mantis.

### Fase 1: Identificación y Registro
* **Detección:** El incidente puede ser detectado por alertas automatizadas de Prometheus (configuradas por Sonia) o por reportes manuales en Mantis Bug Tracker.
* **Clasificación:** Rodrigo evaluará la gravedad. Si compromete datos de usuarios o disponibilidad total del sistema, se clasificará como **Severidad: Mayor/Crítica**.

### Fase 2: Contención Inmediata
* **Ataque DDoS o API saturada:** Rodrigo activará de inmediato reglas de bloqueo por IP mediante el Rate Limiting del backend y coordinará con Aldo para filtrar el tráfico en el contenedor Nginx.
* **Compromiso de Credenciales / JWT:** Se procederá a invalidar la clave secreta de firma actual de la API modificando las variables de entorno en los secretos de GitHub Actions, forzando la expiración de todas las sesiones activas de manera inmediata.

### Fase 3: Erradicación y Recuperación
* **Inyección SQL o Vulnerabilidad de Código:** Se aislará el endpoint afectado, se desarrollará el parche de código correspondiente utilizando ORM Sequelize y se subirá un commit de Git urgente a producción.
* **Secuestro de Datos / Ransomware:** Facundo procederá a dar de baja el contenedor de PostgreSQL afectado, aislará la red interna de Docker y restaurará la base de datos a su último estado estable utilizando las copias de seguridad automáticas (`pg_dump`).

### Fase 4: Post-Incidente (Lecciones Aprendidas)
* **Trazabilidad:** Rodrigo cerrará formalmente el ticket en Mantis Bug Tracker, adjuntando obligatoriamente el reporte de daños y el **ID/hash del commit de Git** que solucionó la vulnerabilidad para la revisión del profesor.
