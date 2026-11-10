@echo off
setlocal enabledelayedexpansion
title SmartGymBro - Preparacion Automatica de Entorno
color 0B

echo =====================================================================
echo       SMARTGYMBRO - CONFIGURACION AUTOMATICA DE ENTORNO (.ENV)
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. .env en la raiz
if not exist ".env" (
    echo [1/5] Creando .env maestro en la raiz...
    copy ".env.example" ".env" >nul
    echo [OK] .env maestro creado.
) else (
    echo [1/5] .env maestro ya existe. Omitiendo.
)

:: 2. backend/.env
if not exist "backend\.env" (
    echo [2/5] Creando backend\.env...
    copy "backend\.env.example" "backend\.env" >nul
    echo [OK] backend\.env creado.
) else (
    echo [2/5] backend\.env ya existe. Omitiendo.
)

:: 3. postgres/.env
if not exist "postgres\.env" (
    echo [3/5] Creando postgres\.env...
    copy "postgres\.env.example" "postgres\.env" >nul
    echo [OK] postgres\.env creado.
) else (
    echo [3/5] postgres\.env ya existe. Omitiendo.
)

:: 4. infra/monitoring/.env
if not exist "infra\monitoring\.env" (
    echo [4/5] Creando infra\monitoring\.env...
    (
        echo POSTGRES_DATA_SOURCE="postgresql://smartgymbro_tp:admin123@host.docker.internal:55433/smartgymbro_tp?sslmode=disable"
        echo GRAFANA_ADMIN_PASSWORD=admin
    ) > "infra\monitoring\.env"
    echo [OK] infra\monitoring\.env creado.
) else (
    echo [4/5] infra\monitoring\.env ya existe. Omitiendo.
)

:: 5. infra/n8n/.env
if not exist "infra\n8n\.env" (
    echo [5/5] Creando infra\n8n\.env...
    if exist "infra\n8n\.env.example" (
        copy "infra\n8n\.env.example" "infra\n8n\.env" >nul
        echo [OK] infra\n8n\.env creado a partir de .env.example.
    )
) else (
    echo [5/5] infra\n8n\.env ya existe. Omitiendo.
)

color 0A
echo.
echo =====================================================================
echo [EXITO] Todos los archivos .env fueron generados y sincronizados.
echo.
echo Proximos pasos para levantar la aplicacion en esta maquina:
echo  1. Iniciar Docker Desktop.
echo  2. Correr: docker compose up -d
echo  3. Para poblar los 6M de datos: postgres\01_poblar_base_datos.bat
echo  4. Para aplicar indices SQL: postgres\02_aplicar_indices_optimizacion.bat
echo  5. Para restaurar Mantis: infra\incidencias\01_restaurar_mantis.bat
echo  6. Para levantar Monitoreo: docker compose -f infra\monitoring\compose.yaml up -d
echo  7. Para levantar n8n: cd infra\n8n y ejecutar .\sembrar-n8n.ps1
echo =====================================================================
echo.
pause
