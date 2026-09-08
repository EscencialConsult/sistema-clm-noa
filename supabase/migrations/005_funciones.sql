-- =====================================================================
--  005 · FUNCIONES
--  La lógica de varios pasos vive acá y no en la pantalla, porque tiene
--  que ser atómica: si falla un paso, no puede quedar una orden a medio
--  crear con el número ya consumido.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  calcular_presupuesto · RF14
--  Recorre los conceptos de la orden contando cada uno UNA sola vez.
--  Un concepto se cuenta solo si TODOS sus estudios están pedidos y
--  ninguno fue ya cubierto por un concepto anterior — así el perfil
--  lipídico no se cobra cuatro veces por sus cuatro determinaciones.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_presupuesto(p_orden bigint)
RETURNS numeric AS $$
DECLARE
  v_total    numeric(12,2) := 0;
  v_cubierto bigint[]      := '{}';
  r          record;
BEGIN
  FOR r IN
    SELECT c.id, c.precio, array_agg(ce.estudio_id) AS estudios
      FROM concepto c
      JOIN concepto_estudio ce ON ce.concepto_id = c.id
     WHERE c.activo
     GROUP BY c.id, c.precio
     ORDER BY c.precio DESC          -- primero el paquete grande (el básico)
  LOOP
    -- ¿están todos los estudios del concepto pedidos en esta orden?
    IF NOT EXISTS (
      SELECT 1 FROM unnest(r.estudios) e
       WHERE e <> ALL (v_cubierto)
         AND NOT EXISTS (SELECT 1 FROM orden_estudio oe
                          WHERE oe.orden_id = p_orden AND oe.estudio_id = e)
    )
    -- ...y queda al menos uno sin cubrir por un concepto anterior
    AND EXISTS (SELECT 1 FROM unnest(r.estudios) e WHERE e <> ALL (v_cubierto))
    THEN
      v_total    := v_total + r.precio;
      v_cubierto := v_cubierto || r.estudios;
    END IF;
  END LOOP;

  RETURN v_total;
END $$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calcular_presupuesto IS
  'RF14. Con la batería de conductor da 140.000 al varón y 160.000 a la mujer (CP-08)';


-- ---------------------------------------------------------------------
--  crear_orden · RF11, RF12, RF14
--  Saca el número de la serie, copia los estudios de la batería SEGÚN EL
--  SEXO de la persona, calcula el vencimiento y congela el importe.
--  Reemplaza el «Gómez Pardo H / Gómez Pardo M» de hoy: una empresa,
--  una batería, y el sistema resuelve la diferencia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_orden(
  p_persona     bigint,
  p_empresa     bigint,
  p_plantilla   bigint,
  p_tarea       text        DEFAULT NULL,
  p_tipo_examen varchar(12) DEFAULT 'PRELABORAL',
  p_usuario     bigint      DEFAULT NULL
) RETURNS bigint AS $$
DECLARE
  v_numero bigint;
  v_sexo   char(1);
  v_orden  bigint;
BEGIN
  -- el UPDATE bloquea la fila: dos puestos a la vez no sacan el mismo número (CP-12)
  UPDATE numerador
     SET proximo_valor = proximo_valor + 1
   WHERE codigo = 'ORDEN'
  RETURNING proximo_valor - 1 INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'No existe el numerador ORDEN';
  END IF;

  SELECT sexo INTO v_sexo FROM persona WHERE id = p_persona;
  IF v_sexo IS NULL THEN
    RAISE EXCEPTION 'La persona % no existe', p_persona;
  END IF;

  INSERT INTO orden (numero, persona_id, empresa_id, plantilla_id,
                     tipo_examen, tarea, fecha_vencimiento, creado_por)
  VALUES (v_numero, p_persona, p_empresa, p_plantilla,
          p_tipo_examen, p_tarea,
          current_date + interval '12 months', p_usuario)
  RETURNING id INTO v_orden;

  -- los estudios de la batería que aplican a este sexo (RF12)
  INSERT INTO orden_estudio (orden_id, estudio_id)
  SELECT v_orden, pi.estudio_id
    FROM plantilla_item pi
    JOIN estudio e ON e.id = pi.estudio_id AND e.activo
   WHERE pi.plantilla_id = p_plantilla
     AND pi.sexo_aplica IN ('A', v_sexo);

  -- una fila por categoría involucrada, para poder despachar de a bloques (RF16)
  INSERT INTO orden_categoria (orden_id, categoria_id)
  SELECT DISTINCT v_orden, e.categoria_id
    FROM orden_estudio oe
    JOIN estudio e ON e.id = oe.estudio_id
   WHERE oe.orden_id = v_orden;

  -- el importe se congela: un cambio de precio no reescribe lo ya facturado
  UPDATE orden SET importe = calcular_presupuesto(v_orden) WHERE id = v_orden;

  RETURN v_orden;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION crear_orden IS
  'RF11/RF12/RF14. Atómica: si falla un paso no queda una orden a medio crear con el número consumido';


-- ---------------------------------------------------------------------
--  emitir_protocolo · RF22, RF23
--  Verifica que no quede nada sin cargar, fija la aptitud y deja la
--  orden INFORMADA. A partir de ahí los resultados quedan bloqueados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION emitir_protocolo(
  p_orden          bigint,
  p_aptitud        varchar(12),
  p_medico         bigint,
  p_preexistencias text    DEFAULT NULL,
  p_incapacidad    numeric DEFAULT NULL
) RETURNS void AS $$
DECLARE v_faltan int;
BEGIN
  IF p_aptitud NOT IN ('APTO','NO_APTO') THEN
    RAISE EXCEPTION 'La aptitud debe ser APTO o NO_APTO';
  END IF;

  SELECT count(*) INTO v_faltan
    FROM orden_estudio
   WHERE orden_id = p_orden AND estado <> 'CARGADO';

  -- un estudio derivado tampoco deja cerrar: primero tiene que volver (RF19)
  IF v_faltan > 0 THEN
    RAISE EXCEPTION 'Quedan % estudios sin cargar', v_faltan;   -- CP-19
  END IF;

  UPDATE orden
     SET aptitud           = p_aptitud,
         preexistencias    = p_preexistencias,
         incapacidad_pct   = p_incapacidad,
         medico_laboral_id = p_medico,
         estado            = 'INFORMADA',
         informado_at      = now()
   WHERE id = p_orden;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION emitir_protocolo IS
  'RF22/RF23. Con un estudio pendiente o derivado, no deja informar (CP-19)';

COMMIT;
