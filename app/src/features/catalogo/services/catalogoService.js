import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Catálogo de categorías y estudios — RF07, RF08.

   Lo mantienen el Administrador y Recepción (RF07). Los precios NO: los
   conceptos facturables son del Administrador, y por eso no están acá.
   Recepción define qué estudios existen; cuánto se cobra es otra
   decisión y otra persona.

   Dos cosas que conviene tener presentes al tocar esto:

   · Los valores de referencia son un DATO CLÍNICO (RF08). El trigger
     compara el resultado contra ref_h o ref_m según el sexo de la
     persona, y sólo entiende el formato «43-53». Cualquier otra cosa
     —texto libre, «menor a 1,40»— se guarda, pero no se evalúa: el
     sistema no marcará nada fuera de rango y nadie se va a enterar.

   · Un estudio que no está en ningún concepto facturable NO SE COBRA.
     Se suma a la orden y aporta cero al importe. Por eso este servicio
     devuelve, junto a cada estudio, si está cubierto o no: es lo único
     que avisa antes de que aparezca en una factura de menos.

   Nada se borra. Se desactiva: un estudio con resultados cargados en
   órdenes viejas tiene que seguir existiendo para que esas órdenes
   sigan diciendo lo que dijeron.
   --------------------------------------------------------------------- */

const limpio = (v) => {
  const t = (v ?? "").toString().trim()
  return t === "" ? null : t
}

/* El formato que el trigger sabe comparar: «43-53», «0,8-1,2». */
export const REFERENCIA_COMPARABLE = /^\s*\d+([.,]\d+)?\s*-\s*\d+([.,]\d+)?\s*$/

export const catalogoService = {
  async getCategorias() {
    const { data, error } = await supabase
      .from("categoria")
      .select("id, nombre, orden, rol_carga, valor_defecto, activo")
      .order("orden")

    if (error) throw new Error(error.message)
    return data ?? []
  },

  async guardarCategoria(cat) {
    const fila = {
      nombre: limpio(cat.nombre)?.toUpperCase(),
      orden: Number(cat.orden) || 99,
      rol_carga: cat.rol_carga,
      valor_defecto: limpio(cat.valor_defecto) ?? "NORMAL",
      activo: cat.activo ?? true,
    }
    const { data, error } = cat.id
      ? await supabase.from("categoria").update(fila).eq("id", cat.id).select().single()
      : await supabase.from("categoria").insert(fila).select().single()

    if (error) throw new Error(mensaje(error))
    return data
  },

  /** Los estudios de una categoría, con el aviso de si se cobran. */
  async getEstudios(categoriaId) {
    const { data, error } = await supabase
      .from("estudio")
      .select("id, codigo, nombre, unidad, ref_h, ref_m, orden, activo, concepto_estudio(concepto_id)")
      .eq("categoria_id", categoriaId)
      .order("orden")

    if (error) throw new Error(error.message)
    return (data ?? []).map((e) => ({
      ...e,
      seCobra: (e.concepto_estudio ?? []).length > 0,
    }))
  },

  async guardarEstudio(est, categoriaId) {
    const fila = {
      codigo: limpio(est.codigo)?.toUpperCase(),
      nombre: limpio(est.nombre)?.toUpperCase(),
      categoria_id: categoriaId,
      unidad: limpio(est.unidad),
      ref_h: limpio(est.ref_h),
      ref_m: limpio(est.ref_m),
      orden: Number(est.orden) || 99,
      activo: est.activo ?? true,
    }
    const { data, error } = est.id
      ? await supabase.from("estudio").update(fila).eq("id", est.id).select().single()
      : await supabase.from("estudio").insert(fila).select().single()

    if (error) throw new Error(mensaje(error))
    return data
  },

  async cambiarActivoEstudio(id, activo) {
    const { error } = await supabase.from("estudio").update({ activo }).eq("id", id)
    if (error) throw new Error(mensaje(error))
  },

  async cambiarActivoCategoria(id, activo) {
    const { error } = await supabase.from("categoria").update({ activo }).eq("id", id)
    if (error) throw new Error(mensaje(error))
  },

  /** Cuántos estudios activos no están en ningún concepto: no se cobran. */
  async contarSinConcepto() {
    const { data, error } = await supabase
      .from("estudio")
      .select("id, concepto_estudio(concepto_id)")
      .eq("activo", true)

    if (error) throw new Error(error.message)
    return (data ?? []).filter((e) => (e.concepto_estudio ?? []).length === 0).length
  },
}

function mensaje(error) {
  if (error.code === "23505") return "Ya hay otro con ese código."
  if (error.code === "42501") {
    return "La base no te deja tocar el catálogo. Lo mantienen el Administrador y Recepción (RF07)."
  }
  return error.message
}
