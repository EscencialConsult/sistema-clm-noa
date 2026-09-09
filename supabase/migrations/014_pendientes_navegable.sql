-- =====================================================================
--  014 · v_pendientes tiene que decir a QUÉ orden pertenece cada estudio
--
--  La vista traía el número de orden pero no su id. Sirve para mirar,
--  no para trabajar: la bioquímica ve «falta el hemograma de la orden
--  37946» y no puede tocar la fila para ir a cargarlo — habría que
--  buscar la orden por número en otra consulta.
--
--  Se agregan tres columnas al final:
--
--    orden_id      para poder abrir la orden de un clic
--    estudio_id    para identificar el estudio sin depender del nombre
--    categoria_id  para filtrar por área sin comparar textos
--
--  Se agregan AL FINAL a propósito: CREATE OR REPLACE VIEW sólo deja
--  sumar columnas al final, y así ninguna consulta que ya use la vista
--  se rompe.
--
--  Y se vuelve a declarar security_invoker: sin eso la vista correría
--  con los permisos de quien la creó y cualquiera vería los pendientes
--  de todos. Ya pasó una vez, con estas mismas vistas, y por eso está
--  escrito acá y no dado por sentado.
-- =====================================================================

BEGIN;

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
       c.id                                               AS categoria_id
  FROM orden_estudio oe
  JOIN orden    o  ON o.id  = oe.orden_id
  JOIN persona  p  ON p.id  = o.persona_id
  JOIN empresa  e  ON e.id  = o.empresa_id
  JOIN estudio  es ON es.id = oe.estudio_id
  JOIN categoria c ON c.id  = es.categoria_id
 WHERE oe.estado = 'PENDIENTE'
   AND o.estado <> 'INFORMADA';

ALTER VIEW v_pendientes SET (security_invoker = true);

COMMENT ON VIEW v_pendientes IS
  'RF16/RF19. Lo que falta cargar y de quién es. orden_id permite abrir la orden desde la lista';

DO $$
DECLARE v_opt text;
BEGIN
  SELECT unnest(reloptions) INTO v_opt FROM pg_class WHERE relname = 'v_pendientes';
  IF v_opt IS DISTINCT FROM 'security_invoker=true' THEN
    RAISE EXCEPTION 'v_pendientes quedó sin security_invoker: mostraría los pendientes de todos';
  END IF;
END $$;

COMMIT;
