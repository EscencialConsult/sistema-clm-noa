import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Alta de orden y admisión — CU-05, CU-06 · RF11, RF12, RF14.

   El circuito arranca acá: se busca a la persona por documento, se elige
   empresa y batería, y se abre la orden.

   Tres cosas las decide la base, no esta pantalla:

   · El número de orden. Lo saca crear_orden() de un numerador que se
     bloquea al leerlo, así que dos puestos a la vez no sacan el mismo
     (CP-12). Acá no se calcula ni se propone ningún número.

   · Qué estudios se abren. Salen de la batería, filtrados por el sexo de
     la persona: al varón se le abren coca y marihuana, a la mujer además
     subunidad beta, sin que recepción tilde nada (CP-07).

   · El importe. Se congela al crear la orden. Un cambio de precio
     mañana no reescribe lo que ya se facturó (CP-10).

   Lo único que se hace acá antes de crear es MOSTRAR ese cálculo, para
   que recepción vea qué va a salir. Se pide a la misma base, no se
   recalcula: si la vista previa y la orden no coincidieran, la que vale
   es la orden.
   --------------------------------------------------------------------- */

export const nuevaOrdenService = {
  /* ---------------- padrón · CU-05 ---------------- */

  /** Busca por documento. Devuelve la persona o null.
   *  El documento es único en la base (uq_persona_doc): esta búsqueda es
   *  lo que hace que volver a ingresarlo traiga la ficha en vez de abrir
   *  una segunda (CP-03). */
  async buscarPorDocumento(tipoDoc, nroDoc) {
    const nro = (nroDoc ?? "").trim()
    if (!nro) return null

    const { data, error } = await supabase
      .from("persona")
      .select("id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac, telefono, domicilio, ocupacion, estado_civil")
      .eq("tipo_doc", tipoDoc)
      .eq("nro_doc", nro)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  },

  /** Las órdenes que ya tiene, para no repetir un examen vigente. */
  async getHistorial(personaId) {
    const { data, error } = await supabase
      .from("orden")
      .select("id, numero, fecha, fecha_vencimiento, estado, aptitud, empresa:empresa_id ( razon_social )")
      .eq("persona_id", personaId)
      .order("fecha", { ascending: false })
      .limit(10)

    if (error) throw new Error(error.message)
    return data ?? []
  },

  async altaPersona(datos) {
    const limpio = (v) => {
      const t = (v ?? "").toString().trim()
      return t === "" ? null : t
    }
    const { data, error } = await supabase
      .from("persona")
      .insert({
        tipo_doc: datos.tipo_doc,
        nro_doc: limpio(datos.nro_doc),
        apellido: limpio(datos.apellido)?.toUpperCase(),
        nombre: limpio(datos.nombre)?.toUpperCase(),
        sexo: datos.sexo,
        fecha_nac: limpio(datos.fecha_nac),
        telefono: limpio(datos.telefono),
        domicilio: limpio(datos.domicilio),
        ocupacion: limpio(datos.ocupacion),
        estado_civil: limpio(datos.estado_civil),
      })
      .select()
      .single()

    if (error) {
      // 23505 = ya existe alguien con ese documento. No es un error del
      // sistema: es el padrón haciendo lo suyo.
      if (error.code === "23505") {
        throw new Error("Ya hay una persona con ese documento. Buscala en vez de darla de alta.")
      }
      throw new Error(error.message)
    }
    return data
  },

  /* ---------------- datos para el formulario ---------------- */

  async getEmpresas() {
    const { data, error } = await supabase
      .from("empresa")
      .select("id, codigo, razon_social")
      .eq("activo", true)
      .order("razon_social")

    if (error) throw new Error(error.message)
    return data ?? []
  },

  async getBaterias() {
    const { data, error } = await supabase
      .from("plantilla")
      .select("id, nombre")
      .order("id")

    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Vista previa: qué estudios abriría esta batería para este sexo, y
   *  cuánto saldría. Se consulta la misma tabla que usa crear_orden(),
   *  con el mismo filtro por sexo, para que lo que se muestra y lo que
   *  se crea no puedan separarse. */
  async previsualizar(plantillaId, sexo) {
    if (!plantillaId || !sexo) return null

    const { data, error } = await supabase
      .from("plantilla_item")
      .select("sexo_aplica, estudio:estudio_id!inner ( id, nombre, activo, categoria:categoria_id ( id, nombre, orden ) )")
      .eq("plantilla_id", plantillaId)
      .in("sexo_aplica", ["A", sexo])
      .eq("estudio.activo", true)

    if (error) throw new Error(error.message)

    const porCategoria = new Map()
    for (const it of data ?? []) {
      const c = it.estudio.categoria
      if (!porCategoria.has(c.id)) porCategoria.set(c.id, { ...c, estudios: [] })
      porCategoria.get(c.id).estudios.push(it.estudio.nombre)
    }

    return {
      total: data?.length ?? 0,
      categorias: [...porCategoria.values()].sort((a, b) => a.orden - b.orden),
    }
  },

  /* ---------------- crear · CU-06 ---------------- */

  /** Devuelve el id de la orden creada. El número, los estudios y el
   *  importe los pone la base. */
  async crear({ personaId, empresaId, plantillaId, tarea, tipoExamen }) {
    const { data, error } = await supabase.rpc("crear_orden", {
      p_persona: personaId,
      p_empresa: empresaId,
      p_plantilla: plantillaId,
      p_tarea: (tarea ?? "").trim() || null,
      p_tipo_examen: tipoExamen || "PRELABORAL",
    })
    if (error) throw new Error(error.message)
    return data
  },

  /* ---------------- ajustar los estudios de la orden · RF11 (c) ----
     «Se pueden agregar o quitar estudios tipeando el código o tildando».
     La batería es un punto de partida, no una jaula: la empresa pide uno
     más, o esta vez no corresponde alguno.

     Las políticas para esto existen desde 008 (agregar_estudio,
     quitar_estudio, agregar_categoria) y sólo permiten tocar una orden
     que todavía no se informó. Un estudio ya CARGADO no se puede quitar:
     se corrige. Borrarlo se llevaría el resultado sin dejar rastro.
     -------------------------------------------------------------- */

  /** Los estudios de la orden, agrupados por categoría. */
  async getEstudiosDeOrden(ordenId) {
    const { data, error } = await supabase
      .from("orden_estudio")
      .select(
        `id, estado, resultado,
         estudio:estudio_id ( id, codigo, nombre, unidad, orden,
           categoria:categoria_id ( id, nombre, orden ) )`
      )
      .eq("orden_id", ordenId)
      .order("orden", { referencedTable: "estudio", ascending: true })

    if (error) throw new Error(error.message)

    const porCategoria = new Map()
    for (const f of data ?? []) {
      const c = f.estudio.categoria
      if (!porCategoria.has(c.id)) porCategoria.set(c.id, { ...c, items: [] })
      porCategoria.get(c.id).items.push(f)
    }
    return [...porCategoria.values()].sort((a, b) => a.orden - b.orden)
  },

  /** Catálogo para el buscador: código o nombre. */
  async buscarEstudios(texto) {
    const t = (texto ?? "").trim()
    if (t.length < 2) return []

    const { data, error } = await supabase
      .from("estudio")
      .select("id, codigo, nombre, unidad, categoria:categoria_id ( id, nombre )")
      .eq("activo", true)
      .or(`codigo.ilike.%${t}%,nombre.ilike.%${t}%`)
      .order("nombre")
      .limit(30)

    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Categorías cuyo nombre coincide, con todos sus estudios activos.
   *
   *  Existe para no pedir quince clics cuando lo que se quiere son las
   *  quince radiografías. El buscador de estudios sueltos ofrece la
   *  categoría entera además de los estudios uno por uno.
   */
  async buscarCategorias(texto) {
    const t = (texto ?? "").trim()
    if (t.length < 2) return []

    const { data, error } = await supabase
      .from("categoria")
      .select("id, nombre, estudio:estudio ( id, nombre, categoria_id, activo )")
      .eq("activo", true)
      .ilike("nombre", `%${t}%`)
      .order("orden")

    if (error) throw new Error(error.message)

    /* El filtro por activo no se puede poner en la relación embebida
       sin excluir la categoría entera, así que se filtra acá. */
    return (data ?? [])
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        estudios: (c.estudio ?? [])
          .filter((e) => e.activo)
          .map((e) => ({ id: e.id, nombre: e.nombre, categoria: { id: c.id, nombre: c.nombre } })),
      }))
      .filter((c) => c.estudios.length > 0)
  },

  /** Suma un estudio. Si su categoría no estaba en la orden, la agrega:
   *  sin esa fila el estudio no aparecería en la pantalla de carga. */
  async agregarEstudio(ordenId, estudio) {
    const { error: eCat } = await supabase
      .from("orden_categoria")
      .upsert(
        { orden_id: ordenId, categoria_id: estudio.categoria.id },
        { onConflict: "orden_id,categoria_id", ignoreDuplicates: true }
      )
    if (eCat) throw new Error(eCat.message)

    const { error } = await supabase
      .from("orden_estudio")
      .insert({ orden_id: ordenId, estudio_id: estudio.id })
    if (error) {
      if (error.code === "23505") throw new Error("Ese estudio ya está en la orden.")
      throw new Error(error.message)
    }
  },

  /** Quita un estudio. La política sólo deja si sigue PENDIENTE. */
  async quitarEstudio(ordenEstudioId) {
    const { data, error } = await supabase
      .from("orden_estudio")
      .delete()
      .eq("id", ordenEstudioId)
      .select()
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) {
      throw new Error("No se pudo quitar: o ya tiene resultado cargado, o la orden está informada.")
    }
  },

  /** Vuelve a calcular el importe y lo guarda. Se llama después de cada
   *  cambio: si no, la orden queda diciendo un precio que ya no es. */
  async recalcularImporte(ordenId) {
    const { data: importe, error } = await supabase.rpc("calcular_presupuesto", { p_orden: ordenId })
    if (error) throw new Error(error.message)

    const { error: e2 } = await supabase.from("orden").update({ importe }).eq("id", ordenId)
    if (e2) throw new Error(e2.message)
    return importe
  },

  /** La orden recién creada, para mostrar número e importe. */
  async getOrdenCreada(ordenId) {
    const { data, error } = await supabase
      .from("orden")
      .select(`id, numero, fecha, fecha_vencimiento, importe, tipo_examen,
               persona:persona_id ( apellido, nombre, tipo_doc, nro_doc ),
               empresa:empresa_id ( razon_social )`)
      .eq("id", ordenId)
      .single()

    if (error) throw new Error(error.message)
    return data
  },
}
