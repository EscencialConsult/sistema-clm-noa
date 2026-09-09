-- =====================================================================
--  018 · DEVOLVER UN ESTUDIO AL PROFESIONAL · RF21, CP-18
--
--  «El Médico laboral devuelve un estudio con el que no acuerda,
--  indicando el motivo, y el estudio vuelve a la bandeja del profesional
--  que lo cargó. La orden no puede cerrarse con un estudio devuelto.»
--
--  Apareció al revisar los requisitos contra el código: no estaba hecho
--  en ninguna parte. Y la base tampoco podía distinguir un estudio
--  devuelto de uno que nunca se cargó — por eso la alerta de
--  «devueltos» de la maqueta se había sacado, no había de dónde leerla.
--
--  Con DEVUELTO como estado propio:
--
--  · El trigger de avance ya hace lo suyo sin tocarlo: cuenta como
--    faltante todo lo que no esté CARGADO, así que una orden COMPLETA
--    retrocede sola a EN_CURSO (CP-18).
--  · emitir_protocolo() tampoco necesita cambios: rechaza mientras
--    quede algo distinto de CARGADO.
--  · El profesional lo ve en sus pendientes, y ahora sabe POR QUÉ
--    volvió, que es lo que hace útil la devolución.
-- =====================================================================

BEGIN;

ALTER TABLE orden_estudio
  ADD COLUMN IF NOT EXISTS motivo_devolucion text,
  ADD COLUMN IF NOT EXISTS devuelto_por      bigint REFERENCES usuario(id),
  ADD COLUMN IF NOT EXISTS devuelto_at       timestamptz;

COMMENT ON COLUMN orden_estudio.motivo_devolucion IS
  'RF21. Por qué el médico laboral lo devolvió. Sin motivo no se puede devolver';

ALTER TABLE orden_estudio DROP CONSTRAINT IF EXISTS orden_estudio_estado_check;
ALTER TABLE orden_estudio ADD CONSTRAINT orden_estudio_estado_check
  CHECK (estado IN ('PENDIENTE', 'DERIVADO', 'CARGADO', 'DEVUELTO'));


-- ---------------------------------------------------------------------
--  devolver_estudio
--
--  Va SECURITY DEFINER: el médico laboral sólo puede tocar por RLS los
--  estudios de SU área (cardiología), y devolver es justamente algo que
--  hace sobre estudios de otros — un hemograma, una radiografía. El
--  control de rol va adentro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION devolver_estudio(
  p_item   bigint,
  p_motivo text
) RETURNS void AS $fn$
DECLARE
  v_estado_orden varchar(12);
  v_estado_item  varchar(12);
  v_orden        bigint;
BEGIN
  IF NOT tengo_rol('R3') THEN
    RAISE EXCEPTION 'Sólo el Médico laboral devuelve un estudio (RF21)';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Hay que decir por qué se devuelve: el profesional necesita saber qué corregir';
  END IF;

  SELECT oe.estado, oe.orden_id, o.estado
    INTO v_estado_item, v_orden, v_estado_orden
    FROM orden_estudio oe JOIN orden o ON o.id = oe.orden_id
   WHERE oe.id = p_item;

  IF v_estado_item IS NULL THEN
    RAISE EXCEPTION 'No existe ese estudio en la orden';
  END IF;
  IF v_estado_orden = 'INFORMADA' THEN
    RAISE EXCEPTION 'La orden ya está informada: para corregir algo hay que reabrirla';
  END IF;
  IF v_estado_item <> 'CARGADO' THEN
    RAISE EXCEPTION 'Sólo se devuelve un estudio cargado; este está %', v_estado_item;
  END IF;

  UPDATE orden_estudio
     SET estado            = 'DEVUELTO',
         motivo_devolucion = btrim(p_motivo),
         devuelto_por      = mi_usuario_id(),
         devuelto_at       = now()
   WHERE id = p_item;

  -- El estado de la orden lo corrige solo el trigger de avance: con algo
  -- distinto de CARGADO, una orden COMPLETA vuelve a EN_CURSO.
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION devolver_estudio IS
  'RF21 / CP-18. El médico laboral devuelve con motivo; la orden retrocede sola y no se puede informar';

REVOKE ALL ON FUNCTION devolver_estudio(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION devolver_estudio(bigint, text) TO authenticated, service_role;


-- ---------------------------------------------------------------------
--  v_pendientes tiene que mostrarlos: un devuelto es trabajo pendiente
--  del profesional, y con el motivo a la vista.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pendientes AS
SELECT o.numero,
       o.fecha,
       (p.apellido::text || ', '::text) || p.nombre::text AS paciente,
       e.razon_social                                     AS empresa,
       c.nombre                                           AS categoria,
       es.nombre                                          AS estudio,
       c.rol_carga                                        AS rol_responsable,
       o.id                                               AS orden_id,
       es.id                                              AS estudio_id,
       c.id                                               AS categoria_id,
       oe.estado                                          AS estado_estudio,
       oe.motivo_devolucion
  FROM orden_estudio oe
  JOIN orden    o  ON o.id  = oe.orden_id
  JOIN persona  p  ON p.id  = o.persona_id
  JOIN empresa  e  ON e.id  = o.empresa_id
  JOIN estudio  es ON es.id = oe.estudio_id
  JOIN categoria c ON c.id  = es.categoria_id
 WHERE oe.estado IN ('PENDIENTE', 'DEVUELTO')
   AND o.estado <> 'INFORMADA';

ALTER VIEW v_pendientes SET (security_invoker = true);

COMMENT ON VIEW v_pendientes IS
  'RF16/RF19/RF21. Lo que falta cargar, incluidos los devueltos con su motivo';

DO $$
DECLARE v_opt text;
BEGIN
  SELECT unnest(reloptions) INTO v_opt FROM pg_class WHERE relname = 'v_pendientes';
  IF v_opt IS DISTINCT FROM 'security_invoker=true' THEN
    RAISE EXCEPTION 'v_pendientes quedó sin security_invoker';
  END IF;
END $$;

COMMIT;
