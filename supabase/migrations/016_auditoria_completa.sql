-- =====================================================================
--  016 · LA AUDITORÍA LLEGA A TODO LO QUE RF27 DICE
--
--  RF27: «Alcanza a resultados, aptitud, preexistencias, incapacidad,
--  datos de persona y empresa, catálogo, baterías y usuarios.»
--
--  Había triggers en orden, orden_estudio, persona y estudio. Faltaban
--  empresa, categoría, baterías, conceptos y usuarios — justo las tablas
--  que acaban de recibir pantalla. Alguien podía cambiar el precio del
--  básico de ley, o sacarle un estudio a una batería, y no quedaba rastro.
--
--  Y faltaba algo más de fondo: la función original sólo mira INSERT y
--  UPDATE. En las tablas de vínculo —qué estudios cubre un concepto, qué
--  estudios trae una batería, qué rol tiene un usuario— la operación que
--  importa es el DELETE. Sacarle un estudio a un concepto cambia lo que
--  se factura y no dejaba ninguna huella.
--
--  Por eso van dos cosas:
--
--    1. Triggers normales en las tablas que tienen id propio.
--    2. fn_auditar_vinculo() para las tablas de vínculo, que no tienen
--       id —concepto_estudio y usuario_rol son (padre, hijo)— y donde el
--       borrado es el evento principal.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  Vínculos: sin id propio, y el DELETE es lo que interesa.
--  TG_ARGV[0] = columna del padre · TG_ARGV[1] = columna del hijo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auditar_vinculo()
RETURNS trigger AS $fn$
DECLARE
  v_usuario bigint;
  v_padre   bigint;
  v_hijo    bigint;
BEGIN
  BEGIN
    v_usuario := mi_usuario_id();
  EXCEPTION WHEN others THEN
    v_usuario := NULL;
  END;
  IF v_usuario IS NULL THEN
    BEGIN
      v_usuario := nullif(current_setting('app.usuario_id', true), '')::bigint;
    EXCEPTION WHEN others THEN
      v_usuario := NULL;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    EXECUTE format('SELECT ($1).%I::bigint, ($1).%I::bigint', TG_ARGV[0], TG_ARGV[1])
      INTO v_padre, v_hijo USING OLD;
    INSERT INTO auditoria (usuario_id, tabla, registro_id, campo, valor_anterior)
    VALUES (v_usuario, TG_TABLE_NAME, v_padre, TG_ARGV[1], v_hijo::text);
    RETURN OLD;
  ELSE
    EXECUTE format('SELECT ($1).%I::bigint, ($1).%I::bigint', TG_ARGV[0], TG_ARGV[1])
      INTO v_padre, v_hijo USING NEW;
    INSERT INTO auditoria (usuario_id, tabla, registro_id, campo, valor_nuevo)
    VALUES (v_usuario, TG_TABLE_NAME, v_padre, TG_ARGV[1], v_hijo::text);
    RETURN NEW;
  END IF;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_auditar_vinculo IS
  'RF27. Para tablas de vínculo sin id propio. Registra el alta y la baja: en un vínculo, sacar es tan sensible como poner';


-- ---------------------------------------------------------------------
--  Empresa · catálogo · baterías · usuarios
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS tg_auditoria_empresa ON empresa;
CREATE TRIGGER tg_auditoria_empresa AFTER INSERT OR UPDATE ON empresa
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'razon_social', 'cuit', 'codigo', 'activo');

DROP TRIGGER IF EXISTS tg_auditoria_categoria ON categoria;
CREATE TRIGGER tg_auditoria_categoria AFTER INSERT OR UPDATE ON categoria
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'nombre', 'rol_carga', 'valor_defecto', 'activo');

DROP TRIGGER IF EXISTS tg_auditoria_plantilla ON plantilla;
CREATE TRIGGER tg_auditoria_plantilla AFTER INSERT OR UPDATE ON plantilla
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'nombre', 'empresa_id', 'activo');

-- el precio es lo más sensible del catálogo: cambia lo que se factura
DROP TRIGGER IF EXISTS tg_auditoria_concepto ON concepto;
CREATE TRIGGER tg_auditoria_concepto AFTER INSERT OR UPDATE ON concepto
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'nombre', 'precio', 'activo');

DROP TRIGGER IF EXISTS tg_auditoria_usuario ON usuario;
CREATE TRIGGER tg_auditoria_usuario AFTER INSERT OR UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'usuario', 'nombre', 'profesional_id', 'activo');


-- ---------------------------------------------------------------------
--  Los vínculos, con sus bajas
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS tg_auditoria_plantilla_item ON plantilla_item;
CREATE TRIGGER tg_auditoria_plantilla_item
  AFTER INSERT OR UPDATE OR DELETE ON plantilla_item
  FOR EACH ROW EXECUTE FUNCTION fn_auditar_vinculo('plantilla_id', 'estudio_id');

DROP TRIGGER IF EXISTS tg_auditoria_concepto_estudio ON concepto_estudio;
CREATE TRIGGER tg_auditoria_concepto_estudio
  AFTER INSERT OR DELETE ON concepto_estudio
  FOR EACH ROW EXECUTE FUNCTION fn_auditar_vinculo('concepto_id', 'estudio_id');

DROP TRIGGER IF EXISTS tg_auditoria_usuario_rol ON usuario_rol;
CREATE TRIGGER tg_auditoria_usuario_rol
  AFTER INSERT OR DELETE ON usuario_rol
  FOR EACH ROW EXECUTE FUNCTION fn_auditar_vinculo('usuario_id', 'usuario_id');


-- ---------------------------------------------------------------------
--  Control: que estén todos los que RF27 nombra
-- ---------------------------------------------------------------------
DO $$
DECLARE v_faltan text;
BEGIN
  SELECT string_agg(t, ', ') INTO v_faltan
    FROM unnest(ARRAY['orden','orden_estudio','persona','estudio','empresa',
                      'categoria','plantilla','plantilla_item','concepto',
                      'concepto_estudio','usuario','usuario_rol']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger g
      JOIN pg_class c ON c.oid = g.tgrelid
      WHERE c.relname = t AND g.tgname LIKE 'tg_auditoria%' AND NOT g.tgisinternal);

  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Sin auditoría: %', v_faltan;
  END IF;
  RAISE NOTICE 'Auditoría en las 12 tablas que nombra RF27.';
END $$;

COMMIT;
