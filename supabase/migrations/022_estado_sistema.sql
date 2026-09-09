-- =====================================================================
--  022 · Dónde el servidor deja saber cómo está
--
--  Dos cosas que hoy sólo se pueden averiguar entrando al servidor:
--
--  a) En qué versión está el sistema. Cuando alguien llama desde
--     Tucumán diciendo "no me anda", la primera pregunta no debería ser
--     una adivinanza. Con esto se lee abajo en la pantalla.
--
--  b) Si hay una actualización esperando. Una tarea diaria consulta
--     GitHub y anota acá cuántos cambios hay sin aplicar. NO los aplica:
--     en una clínica, cuándo se actualiza es una decisión de quien sabe
--     si hay gente esperando, no del reloj.
--
--  Es una tabla de clave y valor a propósito. Lo que el servidor
--  necesite contarle a la pantalla más adelante entra acá sin otra
--  migración.
-- =====================================================================

CREATE TABLE IF NOT EXISTS estado_sistema (
  clave         varchar(40) PRIMARY KEY,
  valor         text,
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE estado_sistema IS
  'Lo que el servidor le cuenta a la pantalla: versión, actualizaciones pendientes.';

ALTER TABLE estado_sistema ENABLE ROW LEVEL SECURITY;

-- La escriben los scripts, que entran como dueños de la base y no pasan
-- por las políticas. Desde la aplicación no la toca nadie.
DROP POLICY IF EXISTS leer_estado_sistema ON estado_sistema;
CREATE POLICY leer_estado_sistema ON estado_sistema FOR SELECT
  USING (mi_usuario_id() IS NOT NULL);

REVOKE ALL ON estado_sistema FROM anon, authenticated;
GRANT SELECT ON estado_sistema TO authenticated;

-- Valores iniciales, para que la pantalla no tenga que contemplar el
-- caso "todavía no corrió nadie".
INSERT INTO estado_sistema (clave, valor) VALUES
  ('version',            'sin registrar'),
  ('actualizaciones',    '0'),
  ('revisado_at',        NULL)
ON CONFLICT (clave) DO NOTHING;
