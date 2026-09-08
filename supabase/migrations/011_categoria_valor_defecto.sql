-- =====================================================================
--  011 · cargar_categoria_normal usa el valor por defecto de la
--  categoría, no 'NORMAL' fijo.
--
--  Encontrado al auditar ClickUp 06 (etapa 2) contra lo que la función
--  hace de verdad: categoria.valor_defecto ya distingue NORMAL de
--  NEGATIVO (comentario en 001_esquema.sql: "NORMAL en todas, salvo
--  TOXICOLOGICO que arranca en NEGATIVO"), pero 008_politicas_faltantes
--  dejó el UPDATE con 'NORMAL' escrito fijo. Con esto, cargar el
--  toxicológico completo de un clic lo hubiera dejado en NORMAL en vez
--  de NEGATIVO — el mismo tipo de agujero silencioso que ya pasó con
--  los estados en minúscula de la maqueta (dominio.ts).
--
--  Mismo nombre y firma que la versión anterior (bigint, bigint): los
--  permisos ya otorgados en 010 (REVOKE de PUBLIC/anon, GRANT a
--  authenticated/service_role) siguen valiendo, no hace falta repetirlos.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION cargar_categoria_normal(
  p_orden     bigint,
  p_categoria bigint
) RETURNS int AS $fn$
DECLARE
  v_estado         varchar(12);
  v_rol            varchar(4);
  v_valor_defecto  varchar(40);
  v_n              int;
BEGIN
  SELECT estado INTO v_estado FROM orden WHERE id = p_orden;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'No existe la orden %', p_orden;
  END IF;
  IF v_estado = 'INFORMADA' THEN
    RAISE EXCEPTION 'La orden ya está informada: para cambiar algo hay que reabrirla';
  END IF;

  SELECT rol_carga, coalesce(valor_defecto, 'NORMAL')
    INTO v_rol, v_valor_defecto
    FROM categoria WHERE id = p_categoria;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'No existe la categoría %', p_categoria;
  END IF;
  IF NOT (soy_admin() OR tengo_rol('R2') OR v_rol = ANY (mis_roles())) THEN
    RAISE EXCEPTION 'La categoría % no es de tu área', p_categoria;
  END IF;

  UPDATE orden_estudio oe
     SET estado      = 'CARGADO',
         resultado   = v_valor_defecto,
         cargado_por = mi_usuario_id(),
         cargado_at  = now()
    FROM estudio e
   WHERE e.id = oe.estudio_id
     AND oe.orden_id    = p_orden
     AND e.categoria_id = p_categoria
     AND oe.estado      = 'PENDIENTE';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $fn$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cargar_categoria_normal IS
  'RF16 / CP-13. Deja una categoría entera en su valor por defecto (NORMAL o, en toxicológico, NEGATIVO) de una sola vez. Invoker: RLS decide quién puede';

COMMIT;
