-- =====================================================================
--  004 · POLÍTICAS RLS — la seguridad real
--
--  La aplicación corre en el navegador y lleva una clave pública que
--  cualquiera puede leer abriendo las herramientas de desarrollo. Por
--  eso ocultar botones NO es una defensa: oculta opciones, que es lo que
--  hace usable la pantalla, pero no impide nada.
--
--  Estas reglas viven DENTRO de la base y se evalúan en cada consulta,
--  venga de nuestra pantalla o de alguien armando el pedido a mano.
--
--  Regla de oro: toda tabla nace con RLS activo. Una tabla sin política
--  no devuelve nada — falla cerrada, no abierta.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  Quién es quien consulta
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mi_usuario_id()
RETURNS bigint AS $$
  SELECT u.id FROM usuario u
   WHERE u.auth_id = auth.uid() AND u.activo
   LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mis_roles()
RETURNS varchar[] AS $$
  SELECT coalesce(array_agg(ur.rol_codigo), '{}')
    FROM usuario_rol ur
   WHERE ur.usuario_id = mi_usuario_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION tengo_rol(p_rol varchar)
RETURNS boolean AS $$
  SELECT p_rol = ANY (mis_roles());
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION soy_admin()
RETURNS boolean AS $$
  SELECT tengo_rol('R1');
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION mis_roles IS 'R1 admin · R2 recepción · R3 médico laboral · R4 clínico · R5 laboratorio · R6 rayos · R7 audiometría · R8 psicología';


-- ---------------------------------------------------------------------
--  RLS activo en todas las tablas
-- ---------------------------------------------------------------------
ALTER TABLE rol              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesional      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_rol      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona          ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudio          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantilla        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantilla_item   ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepto         ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepto_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE numerador        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_categoria  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_estudio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjunto          ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
--  Catálogo y maestros: todos los que entraron pueden LEER.
--  Modificarlos es cosa del Administrador (RF07, RF08, RF09, RF10).
-- ---------------------------------------------------------------------
CREATE POLICY leer_rol           ON rol              FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_profesional   ON profesional      FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_categoria     ON categoria        FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_estudio       ON estudio          FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_plantilla     ON plantilla        FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_plantilla_it  ON plantilla_item   FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_concepto      ON concepto         FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_concepto_est  ON concepto_estudio FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_empresa       ON empresa          FOR SELECT USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY leer_numerador     ON numerador        FOR SELECT USING (mi_usuario_id() IS NOT NULL);

CREATE POLICY admin_profesional  ON profesional      FOR ALL USING (soy_admin()) WITH CHECK (soy_admin());
CREATE POLICY admin_categoria    ON categoria        FOR ALL USING (soy_admin()) WITH CHECK (soy_admin());
CREATE POLICY admin_estudio      ON estudio          FOR ALL USING (soy_admin()) WITH CHECK (soy_admin());
CREATE POLICY admin_concepto     ON concepto         FOR ALL USING (soy_admin()) WITH CHECK (soy_admin());
CREATE POLICY admin_concepto_est ON concepto_estudio FOR ALL USING (soy_admin()) WITH CHECK (soy_admin());

-- las baterías las mantienen Administrador y Recepción (RF09)
CREATE POLICY mant_plantilla     ON plantilla      FOR ALL
  USING (soy_admin() OR tengo_rol('R2')) WITH CHECK (soy_admin() OR tengo_rol('R2'));
CREATE POLICY mant_plantilla_it  ON plantilla_item FOR ALL
  USING (soy_admin() OR tengo_rol('R2')) WITH CHECK (soy_admin() OR tengo_rol('R2'));


-- ---------------------------------------------------------------------
--  Usuarios y roles: solo el Administrador (RF01)
-- ---------------------------------------------------------------------
CREATE POLICY ver_mi_usuario ON usuario FOR SELECT
  USING (auth_id = auth.uid() OR soy_admin());
CREATE POLICY admin_usuario  ON usuario FOR ALL
  USING (soy_admin()) WITH CHECK (soy_admin());

CREATE POLICY ver_mis_roles  ON usuario_rol FOR SELECT
  USING (usuario_id = mi_usuario_id() OR soy_admin());
CREATE POLICY admin_roles    ON usuario_rol FOR ALL
  USING (soy_admin()) WITH CHECK (soy_admin());


-- ---------------------------------------------------------------------
--  Auditoría: se lee, no se toca. Ni el Administrador (RNF-11).
--  No hay política de INSERT/UPDATE/DELETE a propósito: las escrituras
--  las hace el trigger, que corre con los permisos del dueño.
-- ---------------------------------------------------------------------
CREATE POLICY leer_auditoria ON auditoria FOR SELECT USING (soy_admin());


-- ---------------------------------------------------------------------
--  Padrón: Recepción y Administrador dan de alta; el resto solo lee
--  a las personas que tienen una orden en curso (RF02 regla b: el
--  profesional accede a la orden abierta, no al legajo histórico).
-- ---------------------------------------------------------------------
CREATE POLICY leer_persona ON persona FOR SELECT
  USING (
    soy_admin() OR tengo_rol('R2') OR tengo_rol('R3')
    OR EXISTS (SELECT 1 FROM orden o
                WHERE o.persona_id = persona.id
                  AND o.estado <> 'INFORMADA')
  );
CREATE POLICY mant_persona ON persona FOR ALL
  USING (soy_admin() OR tengo_rol('R2')) WITH CHECK (soy_admin() OR tengo_rol('R2'));

CREATE POLICY mant_empresa ON empresa FOR ALL
  USING (soy_admin() OR tengo_rol('R2')) WITH CHECK (soy_admin() OR tengo_rol('R2'));


-- ---------------------------------------------------------------------
--  Órdenes
--  Todos los que cargan ven las órdenes abiertas; la aptitud es
--  exclusiva del Médico laboral — ni el Administrador (RF22 regla a).
-- ---------------------------------------------------------------------
CREATE POLICY leer_orden ON orden FOR SELECT
  USING (mi_usuario_id() IS NOT NULL);

CREATE POLICY crear_orden_pol ON orden FOR INSERT
  WITH CHECK (soy_admin() OR tengo_rol('R2'));

-- Recepción y Administrador corrigen datos de cabecera mientras no esté informada
CREATE POLICY editar_orden ON orden FOR UPDATE
  USING ((soy_admin() OR tengo_rol('R2')) AND estado <> 'INFORMADA')
  WITH CHECK (aptitud = 'PENDIENTE');          -- no pueden fijar la aptitud

-- el Médico laboral es el único que dictamina
CREATE POLICY aptitud_medico_laboral ON orden FOR UPDATE
  USING (tengo_rol('R3')) WITH CHECK (tengo_rol('R3'));


-- ---------------------------------------------------------------------
--  Carga de resultados · RF02 regla a, RF16
--  Cada profesional carga SOLO las categorías de su rol. Recepción y
--  Administrador pueden corregir cualquiera mientras la orden no esté
--  informada (RF16 regla d).
-- ---------------------------------------------------------------------
CREATE POLICY leer_orden_estudio ON orden_estudio FOR SELECT
  USING (mi_usuario_id() IS NOT NULL);

CREATE POLICY cargar_orden_estudio ON orden_estudio FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM orden o WHERE o.id = orden_estudio.orden_id
                                    AND o.estado <> 'INFORMADA')
    AND (
      soy_admin() OR tengo_rol('R2')
      OR EXISTS (SELECT 1 FROM estudio e
                   JOIN categoria c ON c.id = e.categoria_id
                  WHERE e.id = orden_estudio.estudio_id
                    AND c.rol_carga = ANY (mis_roles()))
    )
  );

CREATE POLICY leer_orden_categoria ON orden_categoria FOR SELECT
  USING (mi_usuario_id() IS NOT NULL);

CREATE POLICY cargar_orden_categoria ON orden_categoria FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM orden o WHERE o.id = orden_categoria.orden_id
                                    AND o.estado <> 'INFORMADA')
    AND (
      soy_admin() OR tengo_rol('R2')
      OR EXISTS (SELECT 1 FROM categoria c
                  WHERE c.id = orden_categoria.categoria_id
                    AND c.rol_carga = ANY (mis_roles()))
    )
  );


-- ---------------------------------------------------------------------
--  Adjuntos: los informes de terceros los sube Recepción o el
--  profesional del área (RF18). No se borran nunca.
-- ---------------------------------------------------------------------
CREATE POLICY leer_adjunto  ON adjunto FOR SELECT
  USING (mi_usuario_id() IS NOT NULL);
CREATE POLICY subir_adjunto ON adjunto FOR INSERT
  WITH CHECK (mi_usuario_id() IS NOT NULL);

COMMIT;

-- =====================================================================
--  CÓMO SE PRUEBA ESTO (CP-01)
--
--  Entrar con un usuario de cada rol e intentar, desde la consola del
--  navegador, leer y escribir lo que no le corresponde:
--
--    · El bioquímico (R5) intenta cargar un estudio de RADIOGRAFIAS
--      → 0 filas afectadas
--    · El Administrador (R1) intenta fijar la aptitud de una orden
--      → rechazado: es exclusivo de R3
--    · Cualquiera intenta un UPDATE sobre auditoria
--      → rechazado: no existe política de escritura
--    · Se agrega una tabla nueva sin política
--      → no devuelve nada. Falla cerrada, no abierta.
-- =====================================================================
