-- =====================================================================
--  020 · LOS INFORMES SE REGISTRAN EN adjunto, NO SÓLO EN EL BUCKET
--
--  La tabla adjunto estaba desde 001_esquema, hecha justo para esto
--  —orden_id, nombre_archivo, ruta, descripcion, subido_por, subido_at—
--  con sus dos políticas puestas. Y quedó sin usar: la pantalla de
--  informes de terceros guardaba el archivo en el bucket y cifraba el
--  vínculo en la ruta, ignorando la tabla que ya existía.
--
--  Apareció en el chequeo general. Es un error de haber mirado el
--  problema sin mirar antes el modelo.
--
--  Qué se gana usándola:
--
--  · QUIÉN subió el informe y CUÁNDO. Storage no lo dice por archivo, y
--    en un legajo clínico esa es la mitad del dato.
--  · Una descripción, para distinguir dos PDF del mismo estudio.
--  · Una sola consulta en vez de una llamada al bucket por cada fila.
--
--  Se agrega orden_estudio_id porque el informe llega POR UN ESTUDIO
--  —el ECG, la campimetría— y no por la orden entera. Queda opcional: la
--  declaración jurada escaneada es de la orden y no de ningún estudio,
--  y esa fila lo deja en nulo.
-- =====================================================================

BEGIN;

ALTER TABLE adjunto
  ADD COLUMN IF NOT EXISTS orden_estudio_id bigint REFERENCES orden_estudio(id);

CREATE INDEX IF NOT EXISTS ix_adjunto_orden_estudio ON adjunto (orden_estudio_id);

COMMENT ON COLUMN adjunto.orden_estudio_id IS
  'RF18. De qué estudio es el informe. Nulo si es de la orden entera, como una declaración jurada escaneada';
COMMENT ON COLUMN adjunto.ruta IS
  'Dónde quedó el archivo en el bucket informes. El archivo manda: si no está, el registro no vale';

-- Quién lo subió lo pone la base, no quien llama. La política de INSERT
-- decía sólo «que haya sesión», así que se podía registrar un informe a
-- nombre de otra persona. En un legajo clínico eso es justo lo que la
-- auditoría existe para impedir.
ALTER TABLE adjunto ALTER COLUMN subido_por SET DEFAULT mi_usuario_id();

DROP POLICY IF EXISTS subir_adjunto ON adjunto;
CREATE POLICY subir_adjunto ON adjunto FOR INSERT
  WITH CHECK (
    mi_usuario_id() IS NOT NULL
    AND subido_por = mi_usuario_id()      -- a nombre propio y de nadie más
    AND EXISTS (SELECT 1 FROM orden o
                 WHERE o.id = adjunto.orden_id AND o.estado <> 'INFORMADA')
  );

COMMENT ON POLICY subir_adjunto ON adjunto IS
  'RF18. Se incorpora a nombre propio, y sólo mientras la orden no esté informada';

-- El informe incorporado no se modifica ni se borra (RNF-28), igual que
-- el archivo. No hay política de UPDATE ni de DELETE, y es a propósito:
-- si llegó equivocado se sube el correcto y quedan los dos.

-- Y queda auditado: incorporar un informe al legajo de alguien es una
-- modificación sensible como cualquier otra (RF27).
DROP TRIGGER IF EXISTS tg_auditoria_adjunto ON adjunto;
CREATE TRIGGER tg_auditoria_adjunto AFTER INSERT ON adjunto
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria('nombre_archivo', 'ruta');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE tablename = 'adjunto' AND cmd IN ('UPDATE', 'DELETE', 'ALL')) THEN
    RAISE EXCEPTION 'adjunto no debe tener política de modificación ni de borrado (RNF-28)';
  END IF;
  RAISE NOTICE 'adjunto: se incorpora y se lee, no se modifica ni se borra.';
END $$;

COMMIT;
