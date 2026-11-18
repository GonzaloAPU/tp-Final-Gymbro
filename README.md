# Gymbro AI — TP Final

Repositorio del equipo para integrar el trabajo práctico. Las entregas locales están separadas por integrante; cada persona incorpora sus archivos y hace sus propios commits.

## Ramas y responsabilidades

| Rama | Responsable | Trabajo |
|---|---|---|
| main | Gonzalo y revisión del equipo | Entrega aprobada |
| develop | Gonzalo | Integración y pruebas del conjunto |
| feature/aldo | Aldo | Aplicación, contenedores, CI/CD y túnel |
| feature/facundo | Facundo | PostgreSQL, réplica, carga e índices |
| feature/sonia | Sonia | Monitoreo y automatización |
| feature/rodrigo | Rodrigo | Seguridad e incidencias |

## Trabajo de cada integrante

Clonar este repositorio, partir de develop y crear la rama propia. Ejemplo para Aldo:

```bash
git clone https://github.com/GonzaloAPU/tp-Final-Gymbro.git
cd tp-Final-Gymbro
git switch develop
git switch -c feature/aldo
```

Copiar aquí el contenido de la carpeta archivos/ de la entrega personal, conservando las rutas de destino. No subir la carpeta con el nombre del integrante, integracion-local/, dependencias, compilaciones, logs ni archivos .env. Revisar los archivos antes del primer commit y añadir una .gitignore adecuada.

```bash
git add RUTAS_DE_TU_PARTE
git commit -m "Describe el cambio realizado y probado"
git push -u origin feature/aldo
```

Usar el nombre correspondiente a cada integrante. Abrir los pull requests hacia develop. Tras integrar y probar todas las partes, abrir un pull request de develop hacia main.

main exige pull request y revisión antes del merge. Los compañeros crean sus propias ramas; Gonzalo administra las reglas y coordina la integración. Las validaciones obligatorias de CI se configurarán cuando exista el pipeline de Aldo.

Este commit inicial solo establece el punto de partida compartido; no incorpora ni presenta como terminadas las entregas de los compañeros.
