# ==============================================================================
# SMARTGYMBRO - DOCKERFILE NODO POSTGRESQL + PATRONI (ALTA DISPONIBILIDAD)
# ==============================================================================
FROM postgres:17-bookworm

USER root

# Instalacion de utilidades de sistema, Python 3, pip y Patroni con soporte etcd3 y psycopg3
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    procps && \
    pip3 install --break-system-packages --no-cache-dir \
    "patroni[psycopg3,etcd3]" && \
    rm -rf /var/lib/apt/lists/*

# Crear directorios de configuracion y tunel de backups
RUN mkdir -p /etc/patroni /backups && \
    chown -R postgres:postgres /etc/patroni /backups

# Copiar configuracion base y script de inicializacion post-bootstrap
COPY patroni.yml /etc/patroni/patroni.yml
COPY post_init.sh /etc/patroni/post_init.sh

RUN chmod +x /etc/patroni/post_init.sh && \
    chown postgres:postgres /etc/patroni/patroni.yml /etc/patroni/post_init.sh

USER postgres

ENTRYPOINT ["patroni", "/etc/patroni/patroni.yml"]
