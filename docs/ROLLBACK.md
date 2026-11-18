# Procedimiento de Rollback — SmartGymBro

**Responsable:** Aldo Dante (DevOps)  
**Alcance:** Procedimiento operativo ante fallos en despliegues para restaurar el servicio en menos de 2 minutos sin pérdida de datos.

---

## 1. Rollback a Nivel Contenedores (Docker)

Si una nueva versión del Frontend o Backend presenta errores críticos en ejecución:

### Opción A: Despliegue con versión SHA anterior (Inmediato)
En el `docker-compose.yml`, sustituir la etiqueta `:latest` por el SHA del commit anterior generado por el pipeline de CI/CD:

```yaml
services:
  backend:
    image: ghcr.io/gonzaloapu/tp-final-gymbro-backend:<SHA_ANTERIOR>
    # O desde Docker Hub:
    # image: aldodante/smartgymbro-backend:<SHA_ANTERIOR>

  frontend:
    image: ghcr.io/gonzaloapu/tp-final-gymbro-frontend:<SHA_ANTERIOR>
```

Reiniciar únicamente los servicios web sin tocar la base de datos:
```bash
docker compose up -d --no-deps backend frontend
```

---

## 2. Rollback a Nivel Código (Git Flow)

Si el error requiere revertir los cambios en la rama `develop` o `main`:

1. Identificar el commit que introdujo la falla:
   ```bash
   git log --oneline -n 5
   ```
2. Crear un commit de reversión limpio:
   ```bash
   git revert <COMMIT_HASH> -m 1
   git push origin develop
   ```
3. El pipeline de GitHub Actions se disparará automáticamente, validará el código estable y publicará las nuevas imágenes corregidas.

---

## 3. Preservación de Datos (PostgreSQL)

En cualquier escenario de marcha atrás:
* **Nunca ejecutar:** `docker compose down -v` (el flag `-v` borra volúmenes).
* Los datos de usuarios, rutinas y mediciones se encuentran resguardados en el volumen nominal `smartgymbro_tp_postgres_data`, el cual sobrevive a cualquier reinicio de contenedores.
