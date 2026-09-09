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

# ---------------------------------------------------------------------
# Anotar en el registro qué se aplicó.
#
# Va DESPUÉS del bucle y no adentro, porque la tabla la crea una de las
# migraciones: hasta que esa no corre, no hay dónde anotar.
#
# El hash se calcula sacando los \r antes de resumir, igual que
# scripts/migrar.js. Tiene que dar idéntico: si no, una instalación
# limpia quedaría con hashes que el actualizador leería como archivos
# editados, y se negaría a actualizar acusando algo que no pasó.
# ---------------------------------------------------------------------
echo "--> anotando las migraciones aplicadas"
for f in "$DIR"/*.sql; do
  n=$(basename "$f")
  h=$(tr -d '\r' < "$f" | sha256sum | cut -d' ' -f1)
  psql -v ON_ERROR_STOP=1 --username "supabase_admin" --dbname "postgres" -c \
    "INSERT INTO migracion (nombre, hash, aplicada_por) VALUES ('$n', '$h', 'instalacion')
       ON CONFLICT (nombre) DO UPDATE SET hash = EXCLUDED.hash;" > /dev/null
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
DECLARE t int; c int; e int; emp int; pl int; sinrls int; ce int; huerf int; nocobra int;
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

  -- Los enganches concepto-estudio se cargan con INSERT ... SELECT ... WHERE
  -- nombre = '...'. Si el nombre no coincide, no inserta nada y NO da error:
  -- el concepto queda con precio y sin ningun estudio, o sea que no se cobra
  -- nunca. Asi se descubrio que 'Opiaceos' y 'Extasis' apuntaban a estudios
  -- que no existen en el toxicologico.
  SELECT count(*) INTO ce FROM concepto_estudio;

  SELECT count(*) INTO huerf FROM concepto c2
   WHERE c2.activo AND NOT EXISTS (SELECT 1 FROM concepto_estudio ce2 WHERE ce2.concepto_id = c2.id);

  SELECT count(*) INTO nocobra FROM estudio e2
   WHERE e2.activo AND NOT EXISTS (SELECT 1 FROM concepto_estudio ce2 WHERE ce2.estudio_id = e2.id);

  RAISE NOTICE 'conceptos=% enganches=%',
    (SELECT count(*) FROM concepto), ce;

  IF huerf > 0 THEN
    RAISE WARNING 'ATENCION: % conceptos tienen precio y ningun estudio: nunca se van a cobrar.', huerf;
    RAISE WARNING '  Son: %', (SELECT string_agg(c3.nombre, ', ') FROM concepto c3
      WHERE c3.activo AND NOT EXISTS (SELECT 1 FROM concepto_estudio ce3 WHERE ce3.concepto_id = c3.id));
  END IF;

  IF nocobra > 0 THEN
    RAISE WARNING 'ATENCION: % estudios activos no estan en ningun concepto: suman 0 al importe.', nocobra;
  END IF;

  -- No corta la instalacion a proposito: son datos del cliente por revisar,
  -- no un error del sistema. Pero tiene que verse.
  RAISE NOTICE 'Control OK: todo cargado y con RLS activo.';
END $$;
SQL
