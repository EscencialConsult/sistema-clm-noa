import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Baterías por empresa y puesto — RF09.

   Una batería es el conjunto de estudios que una empresa pide para un
   puesto. Sin empresa, es global: el básico de ley.

   Lo mantienen el Administrador y Recepción.

   El campo que hace todo el trabajo es `sexo_aplica`:

     A   a los dos
     M   sólo varón     (coca y marihuana en la batería de drogas)
     F   sólo mujer     (subunidad beta)

   crear_orden() copia de la batería los ítems con sexo_aplica IN ('A',
   sexo de la persona). De ahí sale CP-07: la misma batería abre 55
   estudios a un varón y 56 a una mujer, sin que recepción tilde nada.

   Y de ahí sale también lo que la clínica hace hoy y deja de hacer: no
   necesitan «Gómez Pardo H» y «Gómez Pardo M» como dos empresas para que
   cada sexo reciba lo suyo. Una empresa, una batería.

   Editar una batería NO toca las órdenes ya emitidas (CP-09). Los
   estudios de una orden son una copia hecha al crearla, no un puntero:
   sacar un estudio de la batería hoy no se lo saca a la orden de ayer.
   --------------------------------------------------------------------- */

export const bateriasService = {
  async getBaterias() {
    const { data, error } = await supabase
      .from("plantilla")
      .select("id, nombre, activo, empresa:empresa_id ( id, razon_social ), plantilla_item(id)")
      .order("id")

    if (error) throw new Error(mensaje(error))
    return (data ?? []).map((b) => ({ ...b, cantidad: (b.plantilla_item ?? []).length }))
  },

  async guardarBateria(bat) {
    const fila = {
      nombre: (bat.nombre ?? "").trim().toUpperCase() || null,
      empresa_id: bat.empresa_id ? Number(bat.empresa_id) : null,
      activo: bat.activo ?? true,
    }
    const { data, error } = bat.id
      ? await supabase.from("plantilla").update(fila).eq("id", bat.id).select().single()
      : await supabase.from("plantilla").insert(fila).select().single()

    if (error) throw new Error(mensaje(error))
    return data
  },

  async cambiarActivo(id, activo) {
    const { error } = await supabase.from("plantilla").update({ activo }).eq("id", id)
    if (error) throw new Error(mensaje(error))
  },

  /** Los ítems de una batería, agrupados por categoría. */
  async getItems(plantillaId) {
    const { data, error } = await supabase
      .from("plantilla_item")
      .select("id, sexo_aplica, estudio:estudio_id ( id, codigo, nombre, activo, orden, categoria:categoria_id ( id, nombre, orden ) )")
      .eq("plantilla_id", plantillaId)

    if (error) throw new Error(mensaje(error))

    const porCategoria = new Map()
    for (const it of data ?? []) {
      const c = it.estudio.categoria
      if (!porCategoria.has(c.id)) porCategoria.set(c.id, { ...c, items: [] })
      porCategoria.get(c.id).items.push(it)
    }
    for (const c of porCategoria.values()) {
      c.items.sort((a, b) => (a.estudio.orden ?? 99) - (b.estudio.orden ?? 99))
    }
    return [...porCategoria.values()].sort((a, b) => a.orden - b.orden)
  },

  async agregarItem(plantillaId, estudioId, sexoAplica = "A") {
    const { error } = await supabase
      .from("plantilla_item")
      .insert({ plantilla_id: plantillaId, estudio_id: estudioId, sexo_aplica: sexoAplica })
    if (error) {
      if (error.code === "23505") throw new Error("Ese estudio ya está en la batería.")
      throw new Error(mensaje(error))
    }
  },

  async cambiarSexo(itemId, sexoAplica) {
    const { error } = await supabase
      .from("plantilla_item")
      .update({ sexo_aplica: sexoAplica })
      .eq("id", itemId)
    if (error) throw new Error(mensaje(error))
  },

  async quitarItem(itemId) {
    const { error } = await supabase.from("plantilla_item").delete().eq("id", itemId)
    if (error) throw new Error(mensaje(error))
  },

  async getEmpresas() {
    const { data, error } = await supabase
      .from("empresa")
      .select("id, razon_social")
      .eq("activo", true)
      .order("razon_social")
    if (error) throw new Error(mensaje(error))
    return data ?? []
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

  /** Cuántos estudios abriría esta batería para cada sexo. Es la cuenta
   *  que hace crear_orden(), pedida a la misma tabla. */
  async contarPorSexo(plantillaId) {
    const { data, error } = await supabase
      .from("plantilla_item")
      .select("sexo_aplica, estudio:estudio_id!inner ( activo )")
      .eq("plantilla_id", plantillaId)
      .eq("estudio.activo", true)

    if (error) throw new Error(mensaje(error))
    const filas = data ?? []
    return {
      varon: filas.filter((i) => i.sexo_aplica === "A" || i.sexo_aplica === "M").length,
      mujer: filas.filter((i) => i.sexo_aplica === "A" || i.sexo_aplica === "F").length,
    }
  },
}

function mensaje(error) {
  if (error.code === "42501") {
    return "Las baterías las mantienen el Administrador y Recepción (RF09)."
  }
  return error.message
}
