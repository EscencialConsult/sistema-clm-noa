-- =====================================================================
--  008 · POLÍTICAS QUE FALTABAN
--
--  Aparecieron al revisar los requerimientos contra lo que la base
--  realmente permite. Ninguna se ve leyendo las políticas existentes:
--  se descubren cuando alguien intenta hacer algo que el requisito dice
--  que puede hacer, y la base lo rechaza.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  RF11 regla (c): «se pueden agregar o quitar estudios tipeando el
--  código o tildando»
--
--  orden_estudio tenía UPDATE pero no INSERT ni DELETE. La pantalla de
--  alta de orden necesita las dos: sumar un estudio suelto que la
--  batería no trae, o sacar uno que esta vez no corresponde.
--
--  Solo mientras la orden no esté informada: después queda bloqueada
--  (RNF-14), y para cambiar algo hay que reabrirla con motivo.
-- ---------------------------------------------------------------------
CREATE POLICY agregar_estudio ON orden_estudio FOR INSERT
  WITH CHECK (
    (soy_admin() OR tengo_rol('R2'))
    AND EXISTS (SELECT 1 FROM orden o
                 WHERE o.id = orden_estudio.orden_id
                   AND o.estado <> 'INFORMADA')
  );

CREATE POLICY quitar_estudio ON orden_estudio FOR DELETE
  USING (
    (soy_admin() OR tengo_rol('R2'))
    AND EXISTS (SELECT 1 FROM orden o
                 WHERE o.id = orden_estudio.orden_id
                   AND o.estado <> 'INFORMADA')
    -- un estudio ya cargado no se borra: se corrige. Borrarlo se llevaría
    -- el resultado sin dejar rastro de que existió.
    AND orden_estudio.estado = 'PENDIENTE'
  );

-- Al agregar un estudio de una categoría que la orden no tenía, hay que
-- poder crear su fila de categoría.
CREATE POLICY agregar_categoria ON orden_categoria FOR INSERT
  WITH CHECK (
    (soy_admin() OR tengo_rol('R2'))
    AND EXISTS (SELECT 1 FROM orden o
                 WHERE o.id = orden_categoria.orden_id
                   AND o.estado <> 'INFORMADA')
  );

-- ---------------------------------------------------------------------
--  RF19: derivar un estudio a un proveedor
--  Lo marca el profesional del área o Recepción. La política de UPDATE
--  ya lo cubre, pero conviene dejar dicho que DERIVADO es un estado
--  válido de esa transición y no un error.
-- ---------------------------------------------------------------------
COMMENT ON POLICY cargar_orden_estudio ON orden_estudio IS
  'Cubre cargar el resultado y también marcarlo DERIVADO (RF19). Un estudio derivado no cuenta como pendiente del centro pero impide cerrar la orden';

COMMIT;
