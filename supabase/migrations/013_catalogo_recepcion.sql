-- =====================================================================
--  013 · RECEPCIÓN TAMBIÉN MANTIENE EL CATÁLOGO
--
--  RF07, textual: «El Administrador y Recepción crean y mantienen las
--  categorías y los estudios que el centro ofrece, con su código, su
--  unidad y su valor por defecto.»
--
--  La política escrita en 005 dejaba solamente al Administrador:
--
--      CREATE POLICY admin_categoria ON categoria FOR ALL
--        USING (soy_admin()) WITH CHECK (soy_admin());
--
--  Comprobado contra el sistema andando, con sesión de recepción:
--      POST /rest/v1/categoria  → 42501
--      POST /rest/v1/estudio    → 42501
--      POST /rest/v1/plantilla  → creada  (esta sí estaba bien, RF09)
--
--  O sea: recepción podía armar una batería pero no crear el estudio que
--  iba adentro. Un requisito de prioridad crítica que la base rechazaba
--  en silencio, y que no se veía porque todavía no existe la pantalla.
--
--  Lo que NO cambia: los conceptos facturables siguen siendo del
--  Administrador. Es una separación a propósito, no un olvido —
--  recepción define QUÉ estudios existen; cuánto se cobra es otra
--  decisión y otra persona (catálogo de actores, A1).
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS admin_categoria ON categoria;
DROP POLICY IF EXISTS admin_estudio   ON estudio;

CREATE POLICY mant_categoria ON categoria FOR ALL
  USING (soy_admin() OR tengo_rol('R2'))
  WITH CHECK (soy_admin() OR tengo_rol('R2'));

CREATE POLICY mant_estudio ON estudio FOR ALL
  USING (soy_admin() OR tengo_rol('R2'))
  WITH CHECK (soy_admin() OR tengo_rol('R2'));

COMMENT ON POLICY mant_categoria ON categoria IS
  'RF07. Administrador y Recepción mantienen el catálogo. Los conceptos facturables no: esos son del Administrador';
COMMENT ON POLICY mant_estudio ON estudio IS
  'RF07 y RF08. Incluye los valores de referencia por sexo, que son parte del estudio';

COMMIT;
