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


## Registro de imágenes: GHCR

El equipo usará GitHub Container Registry. No hacen falta DOCKER_USERNAME, DOCKER_PASSWORD ni un token personal: GitHub Actions proporciona GITHUB_TOKEN automáticamente a cada ejecución.

Aldo debe incorporar esta autenticación al job que publique las imágenes:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Autenticar en GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # Agregar los pasos de build y push cuando estén los Dockerfiles.
```

Este fragmento configura la autenticación; no es un pipeline completo. Los permisos packages: write se declaran en el workflow, no mediante un secreto creado manualmente. Mantener los permisos predeterminados del repositorio en lectura y dar escritura únicamente al job que publica.

Usar nombres en minúsculas, por ejemplo:

- ghcr.io/gonzaloapu/tp-final-gymbro-backend
- ghcr.io/gonzaloapu/tp-final-gymbro-frontend

Publicar desde código integrado y revisado, preferentemente después del merge a main. Los pull requests deben validar y compilar, sin publicar imágenes. No ejecutar código no revisado de un PR con tokens de escritura.

La implementación de Dockerfiles, build, push y disparadores corresponde a la entrega de Aldo. Si una imagen GHCR ya existiera y el push fuera rechazado, revisar en la configuración de ese paquete que este repositorio tenga acceso de Actions. Esta preparación no crea ni publica paquetes.

Referencia: https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
