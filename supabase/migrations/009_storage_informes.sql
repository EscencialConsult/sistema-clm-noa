-- =====================================================================
--  009 · ALMACENAMIENTO DE INFORMES DE TERCEROS · RF18, RNF-22, RNF-28
--
--  Acá van los documentos que llegan de afuera ya firmados: el ECG del
--  cardiólogo, la campimetría, el EEG, el laboratorio derivado, y las
--  dos declaraciones juradas escaneadas con la firma del postulante.
--
--  La regla del requisito es clara: se incorporan TAL COMO FUERON
--  EMITIDOS. No se re-tipean, no se vuelven a firmar y no se editan.
-- =====================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('informes', 'informes', false, 20971520,
        ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/tiff'])
ON CONFLICT (id) DO UPDATE
   SET file_size_limit    = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 20 MB por archivo (RNF-22). No es público: sin sesión no se ve nada,
-- ni siquiera con la URL.

-- ---------------------------------------------------------------------
--  Quién puede qué
-- ---------------------------------------------------------------------

-- Ver: cualquiera del centro que haya iniciado sesión. El profesional
-- necesita mirar el ECG que llegó, y el médico laboral el legajo entero.
CREATE POLICY ver_informes ON storage.objects FOR SELECT
  USING (bucket_id = 'informes' AND mi_usuario_id() IS NOT NULL);

-- Subir: Recepción y los profesionales de área (RF18).
CREATE POLICY subir_informes ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'informes' AND mi_usuario_id() IS NOT NULL);

-- No hay política de UPDATE ni de DELETE, y es a propósito: un informe
-- incorporado no se modifica ni se borra (RNF-28). Si llegó equivocado,
-- se sube el correcto y quedan los dos — igual que en el papel, donde
-- una hoja mal archivada no se rompe, se archiva la buena al lado.

COMMIT;
