#!/bin/sh
set -eu

echo "==> [SmartGymBro] Iniciando autoconfiguración documental en Nextcloud (Punto 12 TP)..."

OCC="php /var/www/html/occ"

# 1. Configuración regional en español y directorio skeleton
$OCC config:system:set default_language --value="es"
$OCC config:system:set default_locale --value="es_AR"
$OCC config:system:set default_phone_region --value="AR"
$OCC config:system:set skeletondirectory --value="/opt/nextcloud-skeleton"

# 2. Habilitar control de versiones de entregables y endurecer políticas de acceso (Actividades 6, 7 y 8)
$OCC app:enable files_versions || true
$OCC config:app:set core shareapi_only_share_with_group_members --value="yes"
$OCC config:app:set core shareapi_allow_public_upload --value="no"
$OCC config:app:set core shareapi_enforce_links_password --value="yes"

# 3. Crear grupos RBAC según la Matriz de Permisos (Actividad 3)
for grp in \
    "SmartGymBro-Equipo" \
    "Rol-Admin-Arquitectura" \
    "Rol-DBA-Datos" \
    "Rol-DevOps-CI-CD" \
    "Rol-SecOps-Calidad" \
    "Rol-Observabilidad-SRE"
do
    $OCC group:add "$grp" || true
done

# 4. Crear únicamente los 5 usuarios autorizados del equipo (Actividad 8)
export OC_PASS="${NEXTCLOUD_TEAM_PASSWORD:-SmartGym2026!}"

create_member() {
    user_id="$1"
    display_name="$2"
    role_group="$3"
    email="$4"

    if ! $OCC user:info "$user_id" >/dev/null 2>&1; then
        $OCC user:add --password-from-env \
            --display-name="$display_name" \
            --group="SmartGymBro-Equipo" \
            --group="$role_group" \
            "$user_id"
    fi
    $OCC user:setting "$user_id" settings email "$email" || true
    $OCC user:setting "$user_id" files quota "5 GB" || true
}

create_member "gonzalo" "Gonzalo (Project Lead & Arquitectura)" "Rol-Admin-Arquitectura" "gonzalo@smartgymbro.local"
$OCC group:adduser "admin" "gonzalo" || true

create_member "facundo" "Facundo (DBA & PostgreSQL)" "Rol-DBA-Datos" "facundo@smartgymbro.local"
create_member "aldo" "Aldo (DevOps & CI/CD)" "Rol-DevOps-CI-CD" "aldo@smartgymbro.local"
create_member "rodrigo" "Rodrigo (SecOps & Incidencias)" "Rol-SecOps-Calidad" "rodrigo@smartgymbro.local"
create_member "sonia" "Sonia (SRE, Monitoreo & n8n)" "Rol-Observabilidad-SRE" "sonia@smartgymbro.local"

# 5. Poblar la estructura documental y centralizar informes del proyecto (Actividades 2, 4 y 5)
populate_user_docs() {
    target_user="$1"
    base_dir="/var/www/html/data/${target_user}/files/SmartGymBro-TP-Final"

    mkdir -p \
        "$base_dir/01-Arquitectura-y-Gestion-Agil" \
        "$base_dir/02-Base-de-Datos-y-Replicacion" \
        "$base_dir/03-Docker-CI-CD-y-Rollback" \
        "$base_dir/04-Seguridad-e-Incidencias" \
        "$base_dir/05-Monitoreo-y-Automatizacion" \
        "$base_dir/06-Registro-Versiones-Entregables"

    # Copiar estructura base desde /opt/nextcloud-skeleton
    if [ -d "/opt/nextcloud-skeleton/SmartGymBro-TP-Final" ]; then
        cp -rf /opt/nextcloud-skeleton/SmartGymBro-TP-Final/* "$base_dir/" 2>/dev/null || true
    fi

    # Copiar documentación técnica real del repositorio montado en /opt/project-docs
    if [ -d "/opt/project-docs" ]; then
        for f in ASIGNACION.md BIENVENIDA.md CRONOGRAMA.md FLUJO-GIT.md INTEGRACION.md; do
            [ -f "/opt/project-docs/$f" ] && cp -f "/opt/project-docs/$f" "$base_dir/01-Arquitectura-y-Gestion-Agil/$f"
        done
        for f in DIAGRAMA-BASE-DE-DATOS-ES.md DIAGRAMA-BASE-DE-DATOS.md MARCAS-PERSONALES.md NOMBRES-BASE-ESPANOL.md; do
            [ -f "/opt/project-docs/$f" ] && cp -f "/opt/project-docs/$f" "$base_dir/02-Base-de-Datos-y-Replicacion/$f"
        done
        for f in ANGULAR-22.md CONFIGURACION-GITHUB.md ROLLBACK.md VALIDACION-INICIAL.md; do
            [ -f "/opt/project-docs/$f" ] && cp -f "/opt/project-docs/$f" "$base_dir/03-Docker-CI-CD-y-Rollback/$f"
        done
        for f in SEGURIDAD-2026-10-26.md; do
            [ -f "/opt/project-docs/$f" ] && cp -f "/opt/project-docs/$f" "$base_dir/04-Seguridad-e-Incidencias/$f"
        done
    fi

    # Copiar informes específicos de módulos (MantisBT / Amenazas y Monitoreo)
    if [ -f "/opt/project-extra/matriz_amenazas.md" ]; then
        cp -f "/opt/project-extra/matriz_amenazas.md" "$base_dir/04-Seguridad-e-Incidencias/MATRIZ-AMENAZAS-MANTIS.md"
    fi
    if [ -f "/opt/project-extra/INFORME-MONITOREO.md" ]; then
        cp -f "/opt/project-extra/INFORME-MONITOREO.md" "$base_dir/05-Monitoreo-y-Automatizacion/INFORME-MONITOREO-GRAFANA-PROMETHEUS.md"
    fi
}

for u in admin gonzalo facundo aldo rodrigo sonia; do
    populate_user_docs "$u"
done

# 6. Indexar todos los archivos en el catálogo de Nextcloud
$OCC files:scan --all

echo "==> [SmartGymBro] Autoconfiguración de Nextcloud finalizada con éxito."
