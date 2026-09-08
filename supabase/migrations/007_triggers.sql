-- =====================================================================
--  006 · TRIGGERS
--  Van como triggers y no como llamadas desde la pantalla porque así no
--  se pueden saltear. La auditoría sobre todo: como método dependía de
--  que alguien se acordara de llamarla; como trigger es una garantía.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  marcar_fuera_de_rango · RF17
--  Compara el valor cargado contra la referencia DEL SEXO de la persona.
--  Sin esto, el hematocrito de 38 de una mujer se marcaría mal usando la
--  referencia de varón — son cinco determinaciones que difieren (CP-05).
--  Advierte, no bloquea: el resultado se guarda igual (CP-06).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_marcar_fuera_de_rango()
RETURNS trigger AS $$
DECLARE
  v_sexo char(1);
  v_ref  text;
  v_val  numeric;
  v_min  numeric;
  v_max  numeric;
BEGIN
  NEW.fuera_de_rango := false;

  IF NEW.detalle IS NULL OR btrim(NEW.detalle) = '' THEN
    RETURN NEW;
  END IF;

  -- el detalle tiene que ser un número para poder compararlo
  BEGIN
    v_val := replace(btrim(NEW.detalle), ',', '.')::numeric;
  EXCEPTION WHEN others THEN
    RETURN NEW;                      -- texto libre: no se evalúa
  END;

  SELECT p.sexo INTO v_sexo
    FROM orden o JOIN persona p ON p.id = o.persona_id
   WHERE o.id = NEW.orden_id;

  SELECT CASE WHEN v_sexo = 'F' THEN coalesce(e.ref_m, e.ref_h)
                                ELSE coalesce(e.ref_h, e.ref_m) END
    INTO v_ref
    FROM estudio e WHERE e.id = NEW.estudio_id;

  IF v_ref IS NULL THEN
    RETURN NEW;                      -- sin referencia cargada, no se evalúa
  END IF;

  -- formato "43-53" · lo demás (texto, "menor a 1,40") no se evalúa todavía
  IF v_ref ~ '^\s*\d+([.,]\d+)?\s*-\s*\d+([.,]\d+)?\s*$' THEN
    v_min := replace(split_part(v_ref, '-', 1), ',', '.')::numeric;
    v_max := replace(split_part(v_ref, '-', 2), ',', '.')::numeric;
    NEW.fuera_de_rango := v_val < v_min OR v_val > v_max;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER tg_fuera_de_rango
  BEFORE INSERT OR UPDATE OF detalle ON orden_estudio
  FOR EACH ROW EXECUTE FUNCTION fn_marcar_fuera_de_rango();


-- ---------------------------------------------------------------------
--  avanzar_estado_orden
--  ABIERTA → EN_CURSO al primer estudio cargado.
--  EN_CURSO → COMPLETA cuando no queda ninguno pendiente ni derivado.
--  Un estudio derivado NO cuenta como pendiente del centro, pero impide
--  cerrar la orden hasta que vuelva (RF19).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_avanzar_estado_orden()
RETURNS trigger AS $$
DECLARE
  v_faltan int;
  v_estado varchar(12);
BEGIN
  SELECT estado INTO v_estado FROM orden WHERE id = NEW.orden_id;

  -- una orden informada no se toca sin reabrirla con motivo (RNF-14)
  IF v_estado = 'INFORMADA' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_faltan
    FROM orden_estudio
   WHERE orden_id = NEW.orden_id AND estado <> 'CARGADO';

  IF v_faltan = 0 THEN
    UPDATE orden SET estado = 'COMPLETA' WHERE id = NEW.orden_id;   -- CP-17
  ELSIF v_estado = 'ABIERTA' AND NEW.estado = 'CARGADO' THEN
    UPDATE orden SET estado = 'EN_CURSO' WHERE id = NEW.orden_id;
  ELSIF v_estado = 'COMPLETA' THEN
    UPDATE orden SET estado = 'EN_CURSO' WHERE id = NEW.orden_id;   -- volvió a faltar algo
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER tg_avanzar_estado
  AFTER INSERT OR UPDATE OF estado ON orden_estudio
  FOR EACH ROW EXECUTE FUNCTION fn_avanzar_estado_orden();


-- ---------------------------------------------------------------------
--  registrar_auditoria · RF27, RNF-11
--  Los cuatro datos que pidió el cliente: quién, cuándo, qué cambió, y
--  el valor anterior y el nuevo. Ningún rol puede editar este registro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS trigger AS $$
DECLARE
  v_usuario bigint;
  v_campo   text;
  v_ant     text;
  v_nue     text;
BEGIN
  -- el id del usuario lo pone la aplicación en la sesión de la conexión
  BEGIN
    v_usuario := nullif(current_setting('app.usuario_id', true), '')::bigint;
  EXCEPTION WHEN others THEN
    v_usuario := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_campo IN ARRAY TG_ARGV LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_campo, v_campo)
        INTO v_ant, v_nue USING OLD, NEW;
      IF v_ant IS DISTINCT FROM v_nue THEN
        INSERT INTO auditoria (usuario_id, tabla, registro_id, campo,
                               valor_anterior, valor_nuevo)
        VALUES (v_usuario, TG_TABLE_NAME, NEW.id, v_campo, v_ant, v_nue);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria (usuario_id, tabla, registro_id, campo, valor_nuevo)
    VALUES (v_usuario, TG_TABLE_NAME, NEW.id, '(alta)', 'creado');
  END IF;

  RETURN NEW;
END $ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER es imprescindible acá: un trigger corre con los permisos
-- de QUIEN LO DISPARA, no del dueño. Sin esto, y como auditoria no tiene
-- política de escritura (a propósito, RNF-11), cada INSERT de un usuario
-- normal muere con «42501 violates row-level security policy for table
-- auditoria». O sea: la auditoría bloquearía TODO el sistema.

CREATE TRIGGER tg_auditoria_orden
  AFTER INSERT OR UPDATE ON orden
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'aptitud', 'preexistencias', 'incapacidad_pct', 'estado', 'importe');

CREATE TRIGGER tg_auditoria_orden_estudio
  AFTER INSERT OR UPDATE ON orden_estudio
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'resultado', 'detalle', 'observacion', 'estado');

CREATE TRIGGER tg_auditoria_persona
  AFTER INSERT OR UPDATE ON persona
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'apellido', 'nombre', 'sexo', 'fecha_nac', 'nro_doc');

CREATE TRIGGER tg_auditoria_estudio
  AFTER INSERT OR UPDATE ON estudio
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria(
    'nombre', 'unidad', 'ref_h', 'ref_m', 'activo');

COMMIT;
