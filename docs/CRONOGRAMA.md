# Cronograma del TP — 03/11 al 16/11

La planificación se toma del PDF adjunto. Se adapta el destino de integración a develop, por pedido de Gonzalo.

| Etapa | Fechas | Trabajo y dependencias |
|---|---|---|
| Configuración aislada | 03–06/11 | Gonzalo: repo, Jira y Nextcloud. Facundo: PostgreSQL/pgAdmin y generador 6M. Aldo: Dockerfiles de app. Rodrigo: Mantis y auditoría estática. Sonia: monitoreo y n8n. |
| Desarrollo y conexiones | 07–10/11 | Facundo: replicación y EXPLAIN tras la carga. Aldo: CI/CD tras Dockerfiles. Rodrigo: pruebas locales e incidencias con app y Mantis disponibles. Sonia: Grafana y tres flujos con BD y Mantis. |
| Ensamble y pruebas | 11–14/11 | Gonzalo: PR a develop y Compose maestro. Todos: prueba cruzada el 12/11. Aldo: túnel el 13/11. Facundo: failover y evidencias 13–14/11. Gonzalo: informes finales en Nextcloud. |
| Ensayo y defensa | 15–16/11 | Ensayo de 20 minutos el 15/11; defensa formal el 16/11 con stack, dashboards y flujos funcionando. |

Dependencias: repositorio → Dockerfiles → CI; app/BD → monitoreo y auditoría dinámica; Mantis → flujos de incidencias; entregas de todos → documentación e integración final. Registrar bloqueos en la daily.

El PDF original está en docs/referencias/. Las actividades se documentan como pendientes hasta tener implementación y evidencia.
