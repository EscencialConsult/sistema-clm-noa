import { supabase } from "../../lib/supabase"

/* ---------------------------------------------------------------------
   Datos para los dos impresos (hoja de ruta y protocolo) — RF-impresos,
   tareas "03 · Hoja de ruta impresa" y "09 · Protocolo impreso".

   Vive en shared/ y no adentro de features/ordenes ni features/aptitud
   a propósito: los dos impresos usan la MISMA consulta (cabecera de la
   orden + categorías con sus estudios), y ninguna de esas dos carpetas
   es dueña de la otra. Que cada feature importe esto en vez de
   importarse features entre sí.

   Formato de campos confirmado contra el legajo real
   (Informe_Formularios_y_Plan_Fase1.md, secciones 2.1 y 2.12):
   estudio · resultado · observación · valor, agrupado por categoría.
   --------------------------------------------------------------------- */

const SELECT_ORDEN = `
  id, numero, fecha, tipo_examen, tarea, estado, aptitud,
  incapacidad_pct, preexistencias, observaciones,
  persona:persona_id ( tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac ),
  empresa:empresa_id ( razon_social ),
  medico_laboral:medico_laboral_id ( apellido_nombre, especialidad, matricula_prov, matricula_nac )
`

function edad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const n = new Date(fechaNac)
  let e = hoy.getFullYear() - n.getFullYear()
  const noCumplioAun = hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())
  if (noCumplioAun) e--
  return e
}

/** Cabecera + categorías con estudios de una orden, lista para imprimir. */
export async function getDatosParaImprimir(ordenId) {
  const { data: orden, error: e1 } = await supabase
    .from("orden")
    .select(SELECT_ORDEN)
    .eq("id", ordenId)
    .single()
  if (e1) throw new Error(e1.message)

  const { data: filas, error: e2 } = await supabase
    .from("orden_estudio")
    .select(
      `resultado, detalle, observacion, fuera_de_rango,
       estudio:estudio_id ( nombre, unidad, ref_h, ref_m, orden,
         categoria:categoria_id ( id, nombre, orden ) )`
    )
    .eq("orden_id", ordenId)
    .order("orden", { referencedTable: "estudio", ascending: true })
  if (e2) throw new Error(e2.message)

  const porCategoria = new Map()
  for (const f of filas ?? []) {
    const cat = f.estudio.categoria
    if (!porCategoria.has(cat.id)) porCategoria.set(cat.id, { ...cat, items: [] })
    porCategoria.get(cat.id).items.push({
      nombre: f.estudio.nombre,
      unidad: f.estudio.unidad,
      referencia: orden.persona?.sexo === "F" ? f.estudio.ref_m : f.estudio.ref_h,
      resultado: f.resultado,
      detalle: f.detalle,
      observacion: f.observacion,
      fueraDeRango: f.fuera_de_rango,
    })
  }

  return {
    ...orden,
    edad: edad(orden.persona?.fecha_nac),
    categorias: [...porCategoria.values()].sort((a, b) => a.orden - b.orden),
  }
}
