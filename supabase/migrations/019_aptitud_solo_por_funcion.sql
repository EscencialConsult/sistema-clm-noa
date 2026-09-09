-- =====================================================================
--  019 · LA APTITUD SÓLO SE FIJA POR emitir_protocolo()
--
--  Encontrado en la auditoría de seguridad, con una orden recién creada
--  y 52 estudios sin cargar:
--
--    vía emitir_protocolo()  → rechazado: «Quedan 52 estudios sin cargar»
--    vía PATCH /rest/v1/orden → el médico laboral FIJÓ EL APTO
--
--  O sea: se podía declarar apta a una persona sin un solo estudio
--  cargado. La regla de negocio vivía en la función, pero la tabla
--  también se podía escribir directo, y la política decía:
--
--      CREATE POLICY aptitud_medico_laboral ON orden FOR UPDATE
--        USING (tengo_rol('R3')) WITH CHECK (tengo_rol('R3'));
--
--  «El médico laboral puede modificar la orden» — sin decir QUÉ.
--
--  CP-19 pasaba igual, porque probaba emitir_protocolo(). Es la tercera
--  vez que aparece el mismo patrón en este sistema: la regla en la
--  función, la puerta abierta al lado. Antes fue crear_orden y
--  emitir_protocolo con permiso para anon (010), y antes la aptitud
--  probada con UPDATE directo en vez de por RPC.
--
--  La corrección es la misma que ya tenía Recepción: se puede editar la
--  orden, pero la aptitud tiene que quedar en PENDIENTE. Cambiarla es
--  potestad de emitir_protocolo(), que corre como dueño y no pasa por
--  estas políticas — así que la función sigue funcionando igual.
--
--  Qué necesita el médico laboral escribir de verdad en `orden`: las
--  observaciones, antes de dictaminar. Eso sigue permitido.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS aptitud_medico_laboral ON orden;

CREATE POLICY editar_orden_medico ON orden FOR UPDATE
  USING (tengo_rol('R3') AND estado <> 'INFORMADA')
  WITH CHECK (
    tengo_rol('R3')
    -- ni la aptitud ni el cierre se tocan a mano: los pone la función
    AND aptitud = 'PENDIENTE'
    AND estado <> 'INFORMADA'
  );

COMMENT ON POLICY editar_orden_medico ON orden IS
  'RF22. El médico laboral edita la orden (observaciones) pero NO fija la aptitud: eso lo hace emitir_protocolo(), que verifica que no quede nada sin cargar (CP-19)';

-- Control: que no quede ninguna política que deje escribir una aptitud
-- distinta de PENDIENTE. Si mañana alguien agrega una, esto lo frena.
DO $$
DECLARE v_mala text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO v_mala
    FROM pg_policies
   WHERE tablename = 'orden'
     AND cmd IN ('UPDATE', 'ALL')
     AND (with_check IS NULL OR with_check NOT LIKE '%aptitud%');

  IF v_mala IS NOT NULL THEN
    RAISE EXCEPTION 'Políticas que dejarían fijar la aptitud a mano: %', v_mala;
  END IF;
  RAISE NOTICE 'La aptitud sólo se puede fijar por emitir_protocolo().';
END $$;

COMMIT;
