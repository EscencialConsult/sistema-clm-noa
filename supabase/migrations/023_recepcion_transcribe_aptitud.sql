-- =====================================================================
--  023 · Recepción puede transcribir la aptitud, eligiendo quién firma
--
--  Hasta acá sólo el médico laboral (R3) podía emitir el protocolo. Eso
--  parecía correcto —RF22 dice "el Médico laboral dictamina"— pero
--  confundía dos cosas distintas: quién DECIDE y quién TIPEA.
--
--  En la clínica lo dice la propia operadora, en el relevamiento:
--
--      "Y acá nosotros cargamos la aptitud. Una vez que el doctor lo
--       informa, yo pongo si ella está apta o no apta."
--
--  El médico dictamina en la planilla de papel y la secretaria lo
--  transcribe al sistema. Con la versión anterior el circuito se cortaba
--  en el último paso: la orden quedaba COMPLETA y nadie podía cerrarla
--  hasta que el médico se sentara a hacerlo él mismo.
--
--  Lo que NO cambia: quién figura como firmante. La matrícula que sale
--  impresa en el protocolo es la del médico, no la de quien tipeó. Por
--  eso cuando no lo emite un R3 hay que decir explícitamente qué
--  profesional firma: si saliera de la sesión, el protocolo llevaría la
--  matrícula de la recepcionista —o ninguna— y ese papel no sirve.
--
--  Quién tipeó queda igual en la auditoría: el disparador de `orden`
--  guarda mi_usuario_id(), que es el de la sesión real aunque la función
--  corra con los permisos de su dueño.
-- =====================================================================

CREATE OR REPLACE FUNCTION emitir_protocolo(
  p_orden          bigint,
  p_aptitud        varchar,
  p_medico         bigint  DEFAULT NULL,
  p_preexistencias text    DEFAULT NULL,
  p_incapacidad    numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faltan   int;
  v_prof     bigint;
  v_es_medico boolean;
BEGIN
  v_es_medico := tengo_rol('R3');

  IF NOT (v_es_medico OR tengo_rol('R2') OR soy_admin()) THEN
    RAISE EXCEPTION 'La aptitud la carga el Médico laboral o Recepción';
  END IF;

  IF p_aptitud NOT IN ('APTO','NO_APTO') THEN
    RAISE EXCEPTION 'La aptitud debe ser APTO o NO_APTO';
  END IF;

  -- ------------------------------------------------------------------
  -- Quién firma
  -- ------------------------------------------------------------------
  IF v_es_medico THEN
    -- El médico firma con SU matrícula, siempre. Sale de la sesión y no
    -- de un parámetro: nadie informa a nombre de otro.
    SELECT profesional_id INTO v_prof FROM usuario WHERE id = mi_usuario_id();
    IF v_prof IS NULL THEN
      RAISE EXCEPTION 'Este usuario no tiene profesional asociado: sin matrícula no se firma';
    END IF;
    IF p_medico IS NOT NULL AND p_medico <> v_prof THEN
      RAISE EXCEPTION 'No se puede informar a nombre de otro profesional';
    END IF;
  ELSE
    -- Recepción transcribe: tiene que decir de quién es la firma, porque
    -- su propia sesión no tiene matrícula que poner en el protocolo.
    IF p_medico IS NULL THEN
      RAISE EXCEPTION 'Hay que indicar qué médico laboral firma el protocolo';
    END IF;
    SELECT id INTO v_prof FROM profesional WHERE id = p_medico AND activo;
    IF v_prof IS NULL THEN
      RAISE EXCEPTION 'El profesional % no existe o está dado de baja', p_medico;
    END IF;
  END IF;

  -- ------------------------------------------------------------------
  -- Que no falte nada. Un DEVUELTO o un DERIVADO también cuentan.
  -- ------------------------------------------------------------------
  SELECT count(*) INTO v_faltan
    FROM orden_estudio
   WHERE orden_id = p_orden AND estado <> 'CARGADO';

  IF v_faltan > 0 THEN
    RAISE EXCEPTION 'Quedan % estudios sin cargar', v_faltan;   -- CP-19
  END IF;

  UPDATE orden
     SET aptitud           = p_aptitud,
         preexistencias    = p_preexistencias,
         incapacidad_pct   = p_incapacidad,
         medico_laboral_id = v_prof,
         estado            = 'INFORMADA',
         informado_at      = now()
   WHERE id = p_orden;
END $$;

REVOKE ALL ON FUNCTION emitir_protocolo(bigint, varchar, bigint, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emitir_protocolo(bigint, varchar, bigint, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------
-- Control: la aptitud tiene que seguir siendo intocable por fuera de la
-- función. Esto es lo que se rompió una vez (migración 019) y lo que
-- este cambio podría reabrir sin querer.
-- ---------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, with_check
      FROM pg_policies
     WHERE tablename = 'orden' AND cmd = 'UPDATE'
  LOOP
    IF p.with_check IS NULL OR position('aptitud' in p.with_check) = 0 THEN
      RAISE EXCEPTION
        'La política % permite modificar la orden sin controlar la aptitud', p.policyname;
    END IF;
  END LOOP;
END $$;
