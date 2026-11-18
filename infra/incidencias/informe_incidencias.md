# Informe de Configuración y Gestión de Incidencias: SmartGymBro
**Responsable:** Rodrigo (Seguridad, QA y Soporte)
**Código de Tarea:** [US-11B]

## 1. Configuración de Estructura en MantisBT
Para el correcto ciclo de vida de QA en la aplicación SmartGymBro, se estructuró el espacio de trabajo definiendo dominios funcionales clave:

### Categorías de Incidencias
* **Backend:** Errores de API (Node.js), middlewares de autenticación, controladores y lógica de negocio.
* **Frontend:** Errores de renderizado en componentes de Angular 19, layouts, navegación y manejo de estados locales.
* **Database:** Problemas de persistencia, restricciones de claves foráneas, índices ausentes y optimización en PostgreSQL.
* **Infra / CI-CD:** Fallas en contenedores de Docker, configuraciones de red, volúmenes corruptos y pipelines de GitHub Actions.

### Matriz de Usuarios y Roles de QA
Se crearon cuentas específicas con niveles de acceso granulares para reflejar el equipo de ingeniería:
1. **Rodrigo (QA / Administrador):** Encargado de la auditoría inicial de seguridad, análisis de riesgos y catalogación.
2. **Gonzalo (Líder / Gestor):** Asignación estratégica de prioridades y control del workflow de integración.
3. **Sonia (Desarrollador / Monitoreo):** Resolución de incidencias de infraestructura, n8n y Prometheus.
4. **Facundo (Desarrollador / DB):** Resolución de cuellos de botella en la base de datos y optimización de índices.
5. **Aldo (Desarrollador / Frontend):** Reparación de interfaces de usuario y componentes visuales.

## 2. Auditoría Estática de Vulnerabilidades (Pruebas de Seguridad - Punto 14)
Se ejecutaron escaneos estáticos complementarios de dependencias (`npm audit`) sobre el repositorio del Backend para robustecer el análisis de la Matriz de Amenazas:

* **Vulnerabilidad Hallada:** Gravedad Alta en el paquete `jsonwebtoken` (versiones críticas desactualizadas).
* **Impacto:** Permite la falsificación de firmas JWT (Bypass de autenticación) si no se restringen algoritmos débiles.
* **Acción de Erradicación:** Actualización forzada a la versión segura mediante `npm audit fix`, documentada bajo el ciclo de vida de la incidencia #0000001.
