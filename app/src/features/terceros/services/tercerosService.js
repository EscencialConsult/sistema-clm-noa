import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Informes de terceros — RF18, RF19 · RNF-28.

   Acá entran los documentos que llegan de afuera ya firmados: el ECG del
   cardiólogo, la campimetría, el EEG, el laboratorio derivado, las
   declaraciones juradas escaneadas. La regla del requisito es que se
   incorporan TAL COMO FUERON EMITIDOS: no se re-tipean, no se vuelven a
   firmar, no se editan.

   Cómo se vincula un archivo con su estudio
   -----------------------------------------
   orden_estudio no tiene columna de archivo, y no se le agrega: el
   vínculo va en la RUTA dentro del bucket.

       <orden_id>/<orden_estudio_id>/<archivo>

   Así, listar esa carpeta devuelve los informes de ese estudio y nada
   más. Sin tabla intermedia que pueda quedar desincronizada con lo que
   hay realmente guardado — si el archivo está, aparece; si no está, no.

   Qué NO se puede hacer, a propósito
   ----------------------------------
   Borrar ni reemplazar un informe. storage.objects no tiene política de
   DELETE ni de UPDATE (009). Si llegó equivocado, se sube el correcto y
   quedan los dos: el original sigue siendo parte del legajo. Comprobado
   contra el sistema: el intento de borrado se rechaza.

   El bucket es privado. Para mostrar un archivo se pide una URL firmada
   que dura unos minutos; no hay enlaces permanentes a informes clínicos.
   --------------------------------------------------------------------- */

const BUCKET = "informes"
const CARPETA = (ordenId, itemId) => `${ordenId}/${itemId}`

export const tercerosService = {
  /** Los estudios derivados a un tercero y todavía sin volver (RF19).
   *  Son los que están esperando un informe. */
  async getDerivados() {
    const { data, error } = await supabase
      .from("orden_estudio")
      .select(`id, estado, resultado, orden_id,
               estudio:estudio_id ( nombre, categoria:categoria_id ( nombre ) ),
               orden:orden_id ( numero, fecha, estado,
                 persona:persona_id ( apellido, nombre, tipo_doc, nro_doc ),
                 empresa:empresa_id ( razon_social ) )`)
      .eq("estado", "DERIVADO")
      .order("orden_id", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Los que ya tienen informe incorporado hoy, para poder mirarlos. */
  async getIncorporadosDeHoy(desde) {
    const { data, error } = await supabase
      .from("orden_estudio")
      .select(`id, estado, resultado, cargado_at, orden_id,
               estudio:estudio_id ( nombre, categoria:categoria_id ( nombre ) ),
               orden:orden_id ( numero, persona:persona_id ( apellido, nombre ) )`)
      .eq("estado", "CARGADO")
      .gte("cargado_at", desde)
      .order("cargado_at", { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)
    return data ?? []
  },

  async listarArchivos(ordenId, itemId) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(CARPETA(ordenId, itemId))
    if (error) throw new Error(error.message)
    /* .emptyFolderPlaceholder es un archivo interno de Storage */
    return (data ?? []).filter((a) => a.name !== ".emptyFolderPlaceholder")
  },

  /** Sube el informe y deja el estudio como cargado, en una sola acción:
   *  incorporar el archivo y no marcar el estudio dejaría la orden
   *  esperando algo que ya llegó. */
  async incorporar(ordenId, itemId, archivo, resultado) {
    const limpio = archivo.name.replace(/[^\w.\-]/g, "_")
    const ruta = `${CARPETA(ordenId, itemId)}/${Date.now()}-${limpio}`

    const { error: eSubir } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream" })
    if (eSubir) throw new Error(mensajeSubida(eSubir))

    const { error: eEstado } = await supabase
      .from("orden_estudio")
      .update({
        estado: "CARGADO",
        resultado: (resultado ?? "").trim() || "INFORME ADJUNTO",
      })
      .eq("id", itemId)

    if (eEstado) {
      throw new Error(
        `El archivo se guardó, pero el estudio no quedó cargado: ${eEstado.message}. ` +
        "Marcalo desde la pantalla de carga."
      )
    }
    return ruta
  },

  /** URL temporal para mirar el archivo. El bucket es privado. */
  async verArchivo(ordenId, itemId, nombre) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(`${CARPETA(ordenId, itemId)}/${nombre}`, 300)
    if (error) throw new Error(error.message)
    return data.signedUrl
  },
}

function mensajeSubida(error) {
  const m = error.message ?? ""
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) {
    return "El archivo pasa los 20 MB que acepta el sistema. Escaneá en menor calidad."
  }
  if (/mime type|not supported/i.test(m)) {
    return "Sólo se aceptan PDF e imágenes (JPG, PNG, WEBP, TIFF)."
  }
  if (/already exists|Duplicate/i.test(m)) {
    return "Ya hay un archivo con ese nombre para este estudio."
  }
  return m
}
