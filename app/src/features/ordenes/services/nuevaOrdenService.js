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
