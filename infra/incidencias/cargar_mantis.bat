@echo off
title Cargador de Base de Datos - Mantis SmartGymBro
echo ========================================================
echo  Cargando usuarios, categorias e incidencias de Mantis...
echo ========================================================
echo.

docker exec -i mantis-mysql-db mysql -u mantis_user -pmantis_password_seguro bugtracker < mantis_backup.sql

echo.
echo [OK] Base de datos actualizada con exito.
echo Ya podes ingresar a http://localhost:8089 con usuario: administrator / clave: admin1234
echo.
pause
