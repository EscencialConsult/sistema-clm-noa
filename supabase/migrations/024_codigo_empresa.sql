-- =====================================================================
-- El código de empresa se asigna solo.
--
-- Hasta acá era un campo de texto que alguien tenía que llenar mirando
-- cuál fue el último. Las 38 cargadas son 1..38, o sea que en los
-- hechos ya es un correlativo — pero hecho a mano.
--
-- Dos problemas con eso. La columna es UNIQUE, así que dos altas a la
-- vez chocan y la segunda recibe un error que no tenía por qué existir.
-- Y si alguien se saltea un número, nadie se entera hasta mucho después.
--
-- Se resuelve igual que el número de orden: con el contador de la tabla
-- `numerador`, que es el mecanismo que ya usa el sistema para esto.
--
-- Se sigue pudiendo escribir a mano. Si la clínica tiene un código
-- propio para una empresa, se respeta; el automático es sólo para
-- cuando el campo queda vacío.
-- =====================================================================

-- ---------------------------------------------------------------------
-- El contador arranca después del último que ya existe.
--
-- Se leen sólo los que son números: si mañana hay uno como «MUNI-01»
-- no tiene que arrastrar el correlativo ni romper el arranque.
-- ---------------------------------------------------------------------
INSERT INTO numerador (codigo, proximo_valor)
SELECT 'EMPRESA', coalesce(max(codigo::bigint), 0) + 1
  FROM empresa
 WHERE codigo ~ '^[0-9]+$'
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- SECURITY DEFINER no es una comodidad: `numerador` tiene RLS con una
-- sola política, la de lectura. Un trigger común corre con los permisos
-- de quien inserta, así que el UPDATE del contador afectaría cero filas
-- y la empresa se guardaría sin código.
--
-- El search_path fijo es obligatorio en una función así: sin él, quien
-- pueda crear un esquema propio puede hacer que la función llame a otra
-- tabla con el mismo nombre.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asignar_codigo_empresa() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_num bigint;
BEGIN
  -- Lo escribieron a mano: se respeta tal cual.
  IF NEW.codigo IS NOT NULL AND btrim(NEW.codigo) <> '' THEN
    -- Pero si es un número igual o mayor al que va a salir, el contador
    -- se corre. Sin esto, cargar la «40» a mano hace que la siguiente
    -- automática salga 39, y la de después 40 — que ya existe, y ahí
    -- falla por la restricción de unicidad.
    IF NEW.codigo ~ '^[0-9]+$' THEN
      UPDATE numerador
         SET proximo_valor = NEW.codigo::bigint + 1
       WHERE codigo = 'EMPRESA'
         AND proximo_valor <= NEW.codigo::bigint;
    END IF;
    RETURN NEW;
  END IF;

  UPDATE numerador
     SET proximo_valor = proximo_valor + 1
   WHERE codigo = 'EMPRESA'
  RETURNING proximo_valor - 1 INTO v_num;

  IF v_num IS NULL THEN
    RAISE EXCEPTION 'No existe el numerador EMPRESA';
  END IF;

  NEW.codigo := v_num::text;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION asignar_codigo_empresa() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_codigo_empresa ON empresa;
CREATE TRIGGER trg_codigo_empresa
  BEFORE INSERT ON empresa
  FOR EACH ROW EXECUTE FUNCTION asignar_codigo_empresa();

-- ---------------------------------------------------------------------
-- Control: que el contador quede parado donde corresponde.
--
-- Si arranca en un número que ya está usado, la primera empresa que se
-- cargue después de instalar falla por unicidad — y falla en el
-- mostrador, no acá.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_proximo bigint;
  v_ultimo  bigint;
BEGIN
  SELECT proximo_valor INTO v_proximo FROM numerador WHERE codigo = 'EMPRESA';
  IF v_proximo IS NULL THEN
    RAISE EXCEPTION 'No quedó creado el numerador EMPRESA';
  END IF;

  SELECT coalesce(max(codigo::bigint), 0) INTO v_ultimo
    FROM empresa WHERE codigo ~ '^[0-9]+$';

  IF v_proximo <= v_ultimo THEN
    RAISE EXCEPTION
      'El numerador EMPRESA arranca en % y ya existe la empresa %', v_proximo, v_ultimo;
  END IF;
END $$;
