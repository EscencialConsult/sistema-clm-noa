-- =====================================================================
-- Qué conceptos cobró realmente una orden.
--
-- La pantalla de Conceptos necesita responder «si subo este precio, a
-- cuántas órdenes les pega». Contar las órdenes que contienen todos sus
-- estudios NO alcanza: calcular_presupuesto() cobra de mayor a menor
-- precio y va marcando los estudios ya cubiertos, así que un concepto
-- puede tener todos sus estudios en la orden y aun así no cobrarse
-- porque otro más caro se los llevó.
--
-- Pasa de verdad y no en un caso raro: el «Básico de ley» ($55.000, 52
-- estudios) se lleva los del perfil lipídico y los del hepatograma. Si
-- la pantalla dijera que el perfil lipídico se cobra en 286 órdenes
-- cuando en realidad se cobra en 3, el precio se cambiaría mirando un
-- número inventado.
--
-- Esta función repite EXACTAMENTE el recorrido de calcular_presupuesto,
-- pero devuelve qué conceptos se cobraron en vez de la suma. El bloque
-- de control del final comprueba que las dos coincidan en todas las
-- órdenes que hay: si alguien toca una y no la otra, la migración no
-- pasa.
-- =====================================================================

CREATE OR REPLACE FUNCTION conceptos_cobrados(p_orden bigint)
RETURNS TABLE (concepto_id bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cubierto bigint[] := '{}';
  r          record;
BEGIN
  FOR r IN
    SELECT c.id, c.precio, array_agg(ce.estudio_id) AS estudios
      FROM concepto c
      JOIN concepto_estudio ce ON ce.concepto_id = c.id
     WHERE c.activo
     GROUP BY c.id, c.precio
     ORDER BY c.precio DESC          -- igual que calcular_presupuesto
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM unnest(r.estudios) e
       WHERE e <> ALL (v_cubierto)
         AND NOT EXISTS (SELECT 1 FROM orden_estudio oe
                          WHERE oe.orden_id = p_orden AND oe.estudio_id = e)
    )
    AND EXISTS (SELECT 1 FROM unnest(r.estudios) e WHERE e <> ALL (v_cubierto))
    THEN
      concepto_id := r.id;
      RETURN NEXT;
      v_cubierto := v_cubierto || r.estudios;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION conceptos_cobrados(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION conceptos_cobrados(bigint) TO authenticated;

-- ---------------------------------------------------------------------
-- Cuántas veces se cobró cada concepto en un período.
--
-- Es lo que mira la pantalla para decir a cuántas órdenes les pega un
-- cambio de precio. Va como función y no como consulta suelta para que
-- la pantalla no tenga que replicar nada de esta lógica.
--
-- El período por defecto es el último mes, que es la unidad con la que
-- la administración piensa los precios.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION uso_de_conceptos(
  p_desde date DEFAULT (current_date - 30)
)
RETURNS TABLE (concepto_id bigint, veces bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cc.concepto_id, count(*)
    FROM orden o
    CROSS JOIN LATERAL conceptos_cobrados(o.id) cc
   WHERE o.fecha >= p_desde
   GROUP BY cc.concepto_id;
$$;

REVOKE ALL ON FUNCTION uso_de_conceptos(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION uso_de_conceptos(date) TO authenticated;

-- ---------------------------------------------------------------------
-- Control: las dos formas de calcular tienen que dar lo mismo.
--
-- No es una formalidad. Son dos copias del mismo recorrido, y el día que
-- alguien cambie una regla de facturación va a tocar una sola. Si eso
-- pasa, la pantalla muestra un impacto que no se corresponde con lo que
-- la clínica factura — y se cambian precios mirando un número falso.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  o        record;
  v_suma   numeric(12,2);
  v_oficial numeric(12,2);
BEGIN
  FOR o IN SELECT id, numero FROM orden LOOP
    SELECT coalesce(sum(c.precio), 0) INTO v_suma
      FROM conceptos_cobrados(o.id) cc
      JOIN concepto c ON c.id = cc.concepto_id;

    v_oficial := calcular_presupuesto(o.id);

    IF v_suma IS DISTINCT FROM v_oficial THEN
      RAISE EXCEPTION
        'La orden % daría % sumando conceptos_cobrados y % con calcular_presupuesto',
        o.numero, v_suma, v_oficial;
    END IF;
  END LOOP;
END $$;
