-- ---------------------------------------------------------------------
--  Devuelve los esquemas de servicio a su dueño · RNF-08
--
--  En Supabase, GoTrue y Storage no tienen permisos otorgados uno por uno:
--  llegan a sus tablas porque son los DUEÑOS de auth y de storage. Si una
--  restauración deja esos objetos a nombre de supabase_admin, los datos
--  quedan perfectos pero el login devuelve 500 («permission denied for
--  table users») y no entra nadie.
--
--  Lo corre solo scripts/restaurar.js después de cada restauración. Es
--  idempotente: si ya está bien, no cambia nada.
--
--  También sirve a mano, sobre copias hechas con el script viejo:
--    docker compose exec -T db psql -U supabase_admin -d postgres \
--      < supabase/reparar-duenios.sql
-- ---------------------------------------------------------------------
DO $$
DECLARE r record; esq text; duenio text;
BEGIN
  FOREACH esq IN ARRAY ARRAY['auth','storage'] LOOP
    duenio := CASE esq WHEN 'auth' THEN 'supabase_auth_admin'
                       ELSE 'supabase_storage_admin' END;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = duenio) THEN
      RAISE NOTICE 'no existe el rol %, salteo %', duenio, esq;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER SCHEMA %I OWNER TO %I', esq, duenio);

    -- tablas y vistas
    FOR r IN SELECT c.relname, c.relkind FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = esq AND c.relkind IN ('r','p','v') LOOP
      EXECUTE format('ALTER %s %I.%I OWNER TO %I',
        CASE r.relkind WHEN 'v' THEN 'VIEW' ELSE 'TABLE' END,
        esq, r.relname, duenio);
    END LOOP;

    -- secuencias sueltas; las de un serial siguen a su tabla y no se tocan
    FOR r IN SELECT c.relname FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = esq AND c.relkind = 'S'
               AND NOT EXISTS (SELECT 1 FROM pg_depend d
                     WHERE d.objid = c.oid AND d.deptype = 'a') LOOP
      EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', esq, r.relname, duenio);
    END LOOP;

    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = esq LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO %I', r.sig, duenio);
    END LOOP;
  END LOOP;
END $$;

-- Si esto no da «t t», el sistema NO va a dejar entrar a nadie.
SELECT has_table_privilege('supabase_auth_admin',   'auth.users',      'SELECT') AS auth_ok,
       has_table_privilege('supabase_storage_admin','storage.objects', 'SELECT') AS storage_ok;
