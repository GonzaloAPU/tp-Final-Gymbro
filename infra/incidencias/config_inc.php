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
# --- Notificaciones por correo (Gmail SMTP) ---
$g_enable_email_notification = ON;
$g_email_send_using_cronjob  = OFF;
$g_email_receive_own         = ON;
$g_phpMailer_method          = PHPMAILER_METHOD_SMTP;
$g_smtp_host                 = 'smtp.gmail.com';
$g_smtp_port                 = 587;
$g_smtp_connection_mode      = 'tls';
$g_smtp_username             = 'facundogaspar897@gmail.com';
$g_smtp_password             = 'aopihtzifhqanuux';
$g_administrator_email       = 'facundogaspar897@gmail.com';
$g_webmaster_email           = 'facundogaspar897@gmail.com';
$g_from_email                = 'facundogaspar897@gmail.com';
$g_from_name                 = 'MantisBT SmartGymBro';
$g_return_path_email         = 'facundogaspar897@gmail.com';
# Notificar siempre al asignado y a los supervisores (MANAGER)
$g_default_notify_flags['threshold_min'] = MANAGER;
$g_default_notify_flags['threshold_max'] = ADMINISTRATOR;

