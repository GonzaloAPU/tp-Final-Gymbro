@echo off
setlocal enabledelayedexpansion
title [01] SmartGymBro - Poblador de Base de Datos
color 0B

echo =====================================================================
echo       [01] SMARTGYMBRO - POBLAMIENTO COMPLETO DE BASE DE DATOS
echo            (20.000 Usuarios + 6.000.000 Series + Actividad)
echo =====================================================================
echo.

:: -----------------------------------------------------------------
:: 0. DETECCION DINAMICA DE RUTAS RELATIVAS (PORTABLE PARA CUALQUIER PC)
:: -----------------------------------------------------------------
:: SCRIPT_DIR: Carpeta donde reside este .bat (siempre <REPO>\postgres)
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: ROOT_DIR: Raiz del repositorio (directorio padre de postgres)
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT_DIR=%%~fI"

:: Asegurar que el directorio de trabajo sea la raiz del repositorio
cd /d "%ROOT_DIR%"

:: -----------------------------------------------------------------
:: 1. AUTO-CONFIGURACION DE ARCHIVOS .ENV (SI NO EXISTEN EN ESTA PC)
:: -----------------------------------------------------------------
if not exist "%ROOT_DIR%\backend\.env" (
    if exist "%ROOT_DIR%\backend\.env.example" (
        echo [INFO] Creando backend\.env a partir de .env.example...
        copy "%ROOT_DIR%\backend\.env.example" "%ROOT_DIR%\backend\.env" >nul
    )
)

if not exist "%SCRIPT_DIR%\.env" (
    if exist "%SCRIPT_DIR%\.env.example" (
        echo [INFO] Creando postgres\.env a partir de .env.example...
        copy "%SCRIPT_DIR%\.env.example" "%SCRIPT_DIR%\.env" >nul
    )
)

:: -----------------------------------------------------------------
:: 2. VERIFICACION DE DOCKER DESKTOP
:: -----------------------------------------------------------------
echo [1/5] Verificando estado de Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Docker Desktop no esta iniciado o no responde en esta PC.
    echo Por favor inicia Docker Desktop y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker esta en ejecucion.
echo.

:: -----------------------------------------------------------------
:: 3. LEVANTAR SERVICIOS POSTGRESQL EN DOCKER (SI NO ESTAN ACTIVOS)
:: -----------------------------------------------------------------
echo [2/5] Verificando contenedores de base de datos...
docker exec gymbro-postgres-primary pg_isready -U smartgymbro_tp -d smartgymbro_tp >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Iniciando servicios de PostgreSQL con Docker Compose...
    if exist "%SCRIPT_DIR%\compose.yaml" (
        docker compose -f "%SCRIPT_DIR%\compose.yaml" up -d
    ) else if exist "%ROOT_DIR%\docker-compose.yml" (
        docker compose -f "%ROOT_DIR%\docker-compose.yml" up -d postgres pgadmin
    ) else (
        echo [ERROR] No se encontro compose.yaml ni docker-compose.yml.
        pause
        exit /b 1
    )
    
    echo Esperando a que PostgreSQL acepte conexiones...
    :wait_pg
    timeout /t 2 /nobreak >nul
    docker exec gymbro-postgres-primary pg_isready -U smartgymbro_tp -d smartgymbro_tp >nul 2>&1
    if %errorlevel% neq 0 (
        echo ...esperando inicializacion de PostgreSQL...
        goto wait_pg
    )
)
echo [OK] PostgreSQL 17 esta listo y saludable en el puerto 55433.
echo.

:: -----------------------------------------------------------------
:: 4. VERIFICACION DE DEPENDENCIAS DE NODE.JS
:: -----------------------------------------------------------------
echo [3/5] Verificando dependencias de Node.js en backend...
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js (v20 o v22) para ejecutar los seeders.
    pause
    exit /b 1
)

if not exist "%ROOT_DIR%\backend\node_modules" (
    echo Instalando dependencias en backend...
    cd /d "%ROOT_DIR%\backend"
    call npm install
    cd /d "%ROOT_DIR%"
)
echo [OK] Dependencias de Node.js verificadas.
echo.

:: -----------------------------------------------------------------
:: 5. INYECCION MASIVA (20.000 USUARIOS + 6.000.000 SERIES)
:: -----------------------------------------------------------------
echo [4/5] Ejecutando seed masivo: 20.000 usuarios, 500.000 sesiones y 6.000.000 series...
echo (Este proceso toma aproximadamente 1 a 2 minutos)...
echo.
cd /d "%ROOT_DIR%"
node "%SCRIPT_DIR%\seed-6m.mjs"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo durante la ejecucion de seed-6m.mjs.
    pause
    exit /b 1
)
echo.

:: -----------------------------------------------------------------
:: 6. INYECCION DE ACTIVIDAD OPERATIVA
:: -----------------------------------------------------------------
echo [5/5] Ejecutando seed de actividad y entrenamientos para dar vida a la app...
node "%SCRIPT_DIR%\seed-actividad.mjs"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo durante la ejecucion de seed-actividad.mjs.
    pause
    exit /b 1
)
echo.

:: -----------------------------------------------------------------
:: 7. VERIFICACION FINAL
:: -----------------------------------------------------------------
echo =====================================================================
echo                VERIFICACION DEL ESTADO DE GYMBRO
echo =====================================================================
node "%SCRIPT_DIR%\verificar.mjs"
echo.

color 0A
echo =====================================================================
echo [EXITO] BASE DE DATOS DE SMARTGYMBRO POBLADA Y VIVA AL 100%%
echo.
echo - 20.000 usuarios activos (nombres reales, gimnasios y disciplinas)
echo - 500.000 sesiones de entrenamiento completadas
echo - 2.000.000 ejercicios realizados en sala
echo - 6.000.000 de registros en series_realizadas (tabla de movimiento)
echo - 2.000 rutinas y 6.000 dias de entrenamiento programados
echo - 10.000 marcas de fuerza 1RM para leaderboards
echo - 100.000 pesajes de control periodico en historial_peso_corporal
echo.
echo Siguiente paso recomendado:
echo Ejecutar [02_aplicar_indices_optimizacion.bat] para indexar la base.
echo =====================================================================
echo.
pause
