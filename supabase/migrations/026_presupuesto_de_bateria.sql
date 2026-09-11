-- =====================================================================
-- Cuánto saldría una batería, para cada sexo.
--
-- La pantalla de Baterías muestra cuántos estudios abre a un varón y a
-- una mujer, pero no cuánto se factura en cada caso. Y ahí está el
-- problema: el importe NO es proporcional a la cantidad. Los conceptos
-- se cobran enteros o no se cobran, así que un estudio de diferencia
-- puede valer $40.000.
--
-- Sin este número, esa diferencia sólo aparece cuando ya se facturó.
--
-- `presupuesto_de_estudios` es el núcleo: recibe un conjunto de estudios
-- y aplica el mismo recorrido que calcular_presupuesto. La de batería lo
-- usa armando el conjunto que le tocaría a ese sexo.
--
-- No se toca calcular_presupuesto, que está en producción y anda. Lo que
-- sí se hace es exigir que las dos den lo mismo en todas las órdenes que
-- existen: si alguien cambia una regla de facturación y toca una sola,
-- la migración no pasa.
-- =====================================================================

CREATE OR REPLACE FUNCTION presupuesto_de_estudios(p_estudios bigint[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
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
     ORDER BY c.precio DESC          -- igual que calcular_presupuesto
  LOOP
    -- ¿están todos los estudios del concepto en el conjunto?
    IF NOT EXISTS (
      SELECT 1 FROM unnest(r.estudios) e
       WHERE e <> ALL (v_cubierto)
         AND e <> ALL (p_estudios)
    )
    -- ...y queda al menos uno sin cubrir por un concepto anterior
    AND EXISTS (SELECT 1 FROM unnest(r.estudios) e WHERE e <> ALL (v_cubierto))
    THEN
      v_total    := v_total + r.precio;
      v_cubierto := v_cubierto || r.estudios;
    END IF;
  END LOOP;

  RETURN v_total;
END $$;

REVOKE ALL ON FUNCTION presupuesto_de_estudios(bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION presupuesto_de_estudios(bigint[]) TO authenticated;

-- ---------------------------------------------------------------------
-- Lo que mira la pantalla: qué sale esta batería para un varón y para
-- una mujer. Dos números, porque pueden ser muy distintos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION presupuesto_de_bateria(p_plantilla bigint)
RETURNS TABLE (sexo char(1), estudios bigint, importe numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.sexo,
         count(pi.estudio_id),
         presupuesto_de_estudios(coalesce(array_agg(pi.estudio_id), '{}'))
    FROM (VALUES ('M'::char(1)), ('F'::char(1))) AS s(sexo)
    LEFT JOIN plantilla_item pi
           ON pi.plantilla_id = p_plantilla
          AND pi.sexo_aplica IN ('A', s.sexo)
    LEFT JOIN estudio e ON e.id = pi.estudio_id AND e.activo
   GROUP BY s.sexo;
$$;

REVOKE ALL ON FUNCTION presupuesto_de_bateria(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION presupuesto_de_bateria(bigint) TO authenticated;

-- ---------------------------------------------------------------------
-- Control: el núcleo nuevo tiene que dar lo mismo que la función que
-- factura de verdad, en todas las órdenes que hay.
--
-- Es la única forma de saber que no se separaron. Son dos copias del
-- mismo recorrido, y el día que alguien cambie una regla va a tocar una
-- sola: si eso pasa, la pantalla muestra un precio que no se corresponde
-- con lo que la clínica cobra.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  o         record;
  v_nuevo   numeric(12,2);
  v_oficial numeric(12,2);
BEGIN
  FOR o IN SELECT id, numero FROM orden LOOP
    SELECT presupuesto_de_estudios(coalesce(array_agg(oe.estudio_id), '{}'))
      INTO v_nuevo
      FROM orden_estudio oe WHERE oe.orden_id = o.id;

    v_oficial := calcular_presupuesto(o.id);

    IF v_nuevo IS DISTINCT FROM v_oficial THEN
      RAISE EXCEPTION
        'La orden % daría % con presupuesto_de_estudios y % con calcular_presupuesto',
        o.numero, v_nuevo, v_oficial;
    END IF;
  END LOOP;
END $$;
