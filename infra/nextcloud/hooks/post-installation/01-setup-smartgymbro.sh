#!/bin/sh
# Instalación inicial y ejecución manual: no copia datos al almacenamiento por fuera de Nextcloud.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$(id -u)" = 0 ]; then
    exec runuser -u www-data -- php "$script_dir/setup-smartgymbro.php" "$@"
fi
exec php "$script_dir/setup-smartgymbro.php" "$@"
