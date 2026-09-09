import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Conceptos facturables — RF14.

   Un concepto es lo que se cobra: «Básico de ley», $55.000. Lo que se
   configura acá es QUÉ ESTUDIOS cubre cada uno.

   Cómo se usa después, que es lo que hace todo esto delicado
   (calcular_presupuesto, migración 006):

     1. Recorre los conceptos del MÁS CARO al más barato.
     2. Cobra un concepto sólo si la orden tiene TODOS sus estudios.
     3. Marca esos estudios como cubiertos, para no cobrarlos de nuevo.

   De ahí salen dos consecuencias que la pantalla avisa:

   · Un estudio que no está en ningún concepto suma $0. Se puede pedir,
     aparece en la hoja de ruta, el profesional lo carga — y no se
     factura. Hoy son 27.

   · Agregarle un estudio a un concepto lo vuelve MÁS DIFÍCIL de cobrar,
     no más caro. Si al «Básico de ley» le sumás un estudio, toda orden
     que no lo incluya deja de pagar el básico entero. Es al revés de lo
     que uno espera.

   Sólo el Administrador. Recepción define qué estudios existen; cuánto
   se cobra es otra decisión (catálogo de actores, A1).
   --------------------------------------------------------------------- */

const limpio = (v) => {
  const t = (v ?? "").toString().trim()
  return t === "" ? null : t
}

export const conceptosService = {
  async getConceptos() {
    const { data, error } = await supabase
      .from("concepto")
      .select("id, nombre, precio, activo, concepto_estudio(estudio_id)")
      .order("precio", { ascending: false })

    if (error) throw new Error(mensaje(error))
    return (data ?? []).map((c) => ({ ...c, cantidad: (c.concepto_estudio ?? []).length }))
  },

  async guardarConcepto(con) {
    const fila = {
      nombre: limpio(con.nombre),
      precio: Number(con.precio) || 0,
      activo: con.activo ?? true,
    }
    const { data, error } = con.id
      ? await supabase.from("concepto").update(fila).eq("id", con.id).select().single()
      : await supabase.from("concepto").insert(fila).select().single()

    if (error) throw new Error(mensaje(error))
    return data
  },

  async cambiarActivo(id, activo) {
    const { error } = await supabase.from("concepto").update({ activo }).eq("id", id)
    if (error) throw new Error(mensaje(error))
  },

  /** Los estudios que cubre un concepto. */
  async getEstudiosDelConcepto(conceptoId) {
    const { data, error } = await supabase
      .from("concepto_estudio")
      .select("estudio:estudio_id ( id, codigo, nombre, activo, categoria:categoria_id ( id, nombre, orden ) )")
      .eq("concepto_id", conceptoId)

    if (error) throw new Error(mensaje(error))
    return (data ?? [])
      .map((r) => r.estudio)
      .sort((a, b) =>
        (a.categoria?.orden ?? 99) - (b.categoria?.orden ?? 99) ||
        a.nombre.localeCompare(b.nombre))
  },

  async agregarEstudio(conceptoId, estudioId) {
    const { error } = await supabase
      .from("concepto_estudio")
      .insert({ concepto_id: conceptoId, estudio_id: estudioId })
    if (error) {
      if (error.code === "23505") throw new Error("Ese estudio ya está en el concepto.")
      throw new Error(mensaje(error))
    }
  },

  async quitarEstudio(conceptoId, estudioId) {
    const { error } = await supabase
      .from("concepto_estudio")
      .delete()
      .eq("concepto_id", conceptoId)
      .eq("estudio_id", estudioId)
    if (error) throw new Error(mensaje(error))
  },

  /** Los que no están en ningún concepto: los que hoy no se cobran. */
  async getSinConcepto() {
    const { data, error } = await supabase
      .from("estudio")
      .select("id, codigo, nombre, concepto_estudio(concepto_id), categoria:categoria_id ( id, nombre, orden )")
      .eq("activo", true)
      .order("nombre")

    if (error) throw new Error(mensaje(error))
    return (data ?? [])
      .filter((e) => (e.concepto_estudio ?? []).length === 0)
      .sort((a, b) => (a.categoria?.orden ?? 99) - (b.categoria?.orden ?? 99))
  },

  async buscarEstudios(texto) {
    const t = (texto ?? "").trim()
    if (t.length < 2) return []
    const { data, error } = await supabase
      .from("estudio")
      .select("id, codigo, nombre, categoria:categoria_id ( id, nombre )")
      .eq("activo", true)
      .or(`codigo.ilike.%${t}%,nombre.ilike.%${t}%`)
      .order("nombre")
      .limit(30)

    if (error) throw new Error(mensaje(error))
    return data ?? []
  },
}

function mensaje(error) {
  if (error.code === "42501") {
    return "Los conceptos facturables los mantiene sólo el Administrador."
  }
  return error.message
}
