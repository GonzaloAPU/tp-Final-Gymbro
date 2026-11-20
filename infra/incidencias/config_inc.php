<?php
$g_hostname = 'mantis-db';
$g_db_type = 'mysqli';
$g_database_name = 'bugtracker';
$g_db_username = 'mantis_user';
$g_db_password = 'mantis_password_seguro';
$g_default_timezone = 'America/Argentina/Buenos_Aires';
$g_crypto_master_salt = 'smartgymbro_mantis_salt_2026';

# --- Visibilidad estricta de incidencias (SmartGymBro) ---
# Las nuevas incidencias se crean privadas por defecto.
# Solo supervisores (MANAGER = 70, ej. gonzalo_dev) y administradores ven todas las incidencias.
# Los desarrolladores solo ven las incidencias asignadas a ellos (o reportadas por ellos).
$g_default_bug_view_status = VS_PRIVATE;
$g_private_bug_threshold = MANAGER;
$g_limit_developers_to_assigned = ON;

