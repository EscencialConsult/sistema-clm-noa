#!/bin/bash
# =====================================================================
#  Aplica las migraciones al crear la base por primera vez.
#
#  Dos motivos para que esto exista:
#
#  1. Postgres recorre SOLO los archivos del primer nivel de
#     /docker-entrypoint-initdb.d/ — una subcarpeta la omite en silencio
#     y la base queda vacía sin que nadie se entere. Este script sí es
#     del primer nivel, y desde acá se recorre la carpeta.
#
#  2. Las migraciones se montan en /cmlnoa/migrations y no en
#     /docker-entrypoint-initdb.d/migrations, porque esa última es la
#     carpeta propia de la imagen: montar ahí tapa las suyas, y sin
#     ellas no se crea el esquema auth que necesita auth.uid().
#
#  El nombre zz- es a propósito: Postgres ejecuta por orden alfabético
#  y este tiene que correr DESPUÉS de migrate.sh, el de la imagen.
# =====================================================================
set -e

DIR=/cmlnoa/migrations

echo ""
echo "=== CML NOA · aplicando migraciones ==="

for f in "$DIR"/*.sql; do
  [ -e "$f" ] || { echo "!! No hay migraciones en $DIR"; exit 1; }
  echo "--> $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-supabase_admin}" --dbname "${POSTGRES_DB:-postgres}" -f "$f"
done

echo "--> contraseñas de los roles internos"
# La imagen crea authenticator, supabase_auth_admin y supabase_storage_admin
# sin contraseña utilizable. Sin esto, PostgREST y Storage no conectan:
# «password authentication failed for user authenticator».
psql -v ON_ERROR_STOP=1 --username "supabase_admin" --dbname "postgres" <<EOSQL
ALTER USER authenticator            WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER USER supabase_auth_admin      WITH PASSWORD '$POSTGRES_PASSWORD';
ALTER USER supabase_storage_admin   WITH PASSWORD '$POSTGRES_PASSWORD';
EOSQL

echo "=== migraciones aplicadas ==="

# Control rápido: si algo de esto no cuadra, conviene saberlo ahora y no
# el jueves con la operadora mirando.
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-supabase_admin}" --dbname "${POSTGRES_DB:-postgres}" <<'SQL'
DO $$
DECLARE t int; c int; e int; emp int; pl int; sinrls int;
BEGIN
  SELECT count(*) INTO t   FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';
  SELECT count(*) INTO c   FROM categoria;
  SELECT count(*) INTO e   FROM estudio;
  SELECT count(*) INTO emp FROM empresa;
  SELECT count(*) INTO pl  FROM plantilla;
  SELECT count(*) INTO sinrls FROM pg_tables
   WHERE schemaname='public' AND NOT rowsecurity;

  RAISE NOTICE 'tablas=% categorias=% estudios=% empresas=% baterias=%', t, c, e, emp, pl;

  IF t < 18            THEN RAISE EXCEPTION 'Faltan tablas: hay %', t; END IF;
  IF c <> 9            THEN RAISE EXCEPTION 'Categorias: esperaba 9, hay %', c; END IF;
  IF e < 120           THEN RAISE EXCEPTION 'Estudios: esperaba 122, hay %', e; END IF;
  IF emp <> 38         THEN RAISE EXCEPTION 'Empresas: esperaba 38, hay %', emp; END IF;
  IF pl <> 8           THEN RAISE EXCEPTION 'Baterias: esperaba 8, hay %', pl; END IF;
  IF sinrls > 0        THEN RAISE EXCEPTION '% tablas sin RLS activo', sinrls; END IF;

  RAISE NOTICE 'Control OK: todo cargado y con RLS activo.';
END $$;
SQL
