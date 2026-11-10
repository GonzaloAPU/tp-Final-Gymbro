# Imagen propia de n8n con cliente PostgreSQL instalado.
#
# Motivo: el Workflow 2 (Backups) necesita pg_dump / pg_restore, que la
# imagen oficial n8nio/n8n:2.44.6 no trae (Alpine Hardened sin package manager).
# Se copian desde postgres:17-alpine SOLO los binarios y sonames que faltan en
# la imagen oficial (los que ya existen en n8n se respetan).
#
# IMPORTANTE: la version del cliente debe ser >= a la del servidor destino
# (PostgreSQL 17.x): pg_dump no acepta un cliente mas viejo que el servidor.

FROM postgres:17-alpine AS pgcli

FROM n8nio/n8n:2.44.6

# Binarios de cliente Postgres
COPY --from=pgcli /usr/local/bin/pg_dump    /usr/local/bin/pg_dump
COPY --from=pgcli /usr/local/bin/pg_restore /usr/local/bin/pg_restore
COPY --from=pgcli /usr/local/bin/psql       /usr/local/bin/psql

# libpq (conectividad a PostgreSQL) - nombre + objetivo del soname
COPY --from=pgcli /usr/local/lib/libpq.so.5    /usr/local/lib/libpq.so.5
COPY --from=pgcli /usr/local/lib/libpq.so.5.17 /usr/local/lib/libpq.so.5.17

# krb5 / LDAP chain (dependencias de libpq), cada nombre + su objetivo versionado
COPY --from=pgcli /usr/lib/libcom_err.so.2       /usr/lib/libcom_err.so.2
COPY --from=pgcli /usr/lib/libcom_err.so.2.1     /usr/lib/libcom_err.so.2.1
COPY --from=pgcli /usr/lib/libgssapi_krb5.so.2   /usr/lib/libgssapi_krb5.so.2
COPY --from=pgcli /usr/lib/libgssapi_krb5.so.2.2 /usr/lib/libgssapi_krb5.so.2.2
COPY --from=pgcli /usr/lib/libkeyutils.so.1      /usr/lib/libkeyutils.so.1
COPY --from=pgcli /usr/lib/libkeyutils.so.1.10   /usr/lib/libkeyutils.so.1.10
COPY --from=pgcli /usr/lib/libk5crypto.so.3      /usr/lib/libk5crypto.so.3
COPY --from=pgcli /usr/lib/libk5crypto.so.3.1    /usr/lib/libk5crypto.so.3.1
COPY --from=pgcli /usr/lib/libkrb5.so.3          /usr/lib/libkrb5.so.3
COPY --from=pgcli /usr/lib/libkrb5.so.3.3        /usr/lib/libkrb5.so.3.3
COPY --from=pgcli /usr/lib/libkrb5support.so.0   /usr/lib/libkrb5support.so.0
COPY --from=pgcli /usr/lib/libkrb5support.so.0.1 /usr/lib/libkrb5support.so.0.1
COPY --from=pgcli /usr/lib/liblber.so.2          /usr/lib/liblber.so.2
COPY --from=pgcli /usr/lib/liblber.so.2.0.200    /usr/lib/liblber.so.2.0.200
COPY --from=pgcli /usr/lib/libldap.so.2          /usr/lib/libldap.so.2
COPY --from=pgcli /usr/lib/libldap.so.2.0.200    /usr/lib/libldap.so.2.0.200

ENV LD_LIBRARY_PATH=/usr/local/lib

RUN pg_dump --version && pg_restore --version && psql --version
