import { supabase } from "../../../lib/supabase"
import { hoyLocal, desdeMedianoche } from "../../../lib/fechas"

/* ---------------------------------------------------------------------
   Aptitud y legajo — CU-11, RF22/RF23.

   Acá NO se decide nada. Quién puede dictaminar, si la orden está
   completa y con qué matrícula se firma lo resuelve la base:
   emitir_protocolo() controla el rol, verifica que no quede ningún
   estudio sin cargar y toma la matrícula del usuario de la sesión
   (010_permisos_funciones.sql). Este servicio llama y devuelve el error
   tal como viene — si dice «Quedan 3 estudios sin cargar», eso es lo
   que tiene que leer el médico.

   Por eso tampoco hay un chequeo de rol en el front: un médico clínico
   que escriba /aptitud a mano ve la pantalla, aprieta el botón y la
   base lo rechaza. Esconder el botón no es la protección (TRABAJAR.md).
   --------------------------------------------------------------------- */

const SELECT_ORDEN = `
  id, numero, fecha, tipo_examen, tarea, estado, aptitud, importe,
  preexistencias, incapacidad_pct, observaciones, informado_at,
  persona:persona_id ( id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac ),
  empresa:empresa_id ( id, razon_social ),
  medico_laboral:medico_laboral_id ( apellido_nombre, especialidad, matricula_prov, matricula_nac )
`

function conNombreYDocumento(orden) {
  const p = orden.persona
  return {
    ...orden,
    persona: p && {
      ...p,
      apellido_nombre: `${p.apellido}, ${p.nombre}`,
      documento: `${p.tipo_doc} ${p.nro_doc}`,
    },
  }
}

export const aptitudService = {
  /** Las que están listas para dictaminar: COMPLETA y todavía sin aptitud.
   *  Una orden con un estudio pendiente o derivado no llega acá — el
   *  trigger la deja en EN_CURSO hasta que vuelva (RF19). */
  async getOrdenesParaInformar() {
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN)
      .eq("estado", "COMPLETA")
      .order("fecha", { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []).map(conNombreYDocumento)
  },

  /** Las informadas hoy, para tenerlas a mano y poder reimprimir. */
  async getInformadasDeHoy() {
    const hoy = hoyLocal()
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN)
      .eq("estado", "INFORMADA")
      .gte("informado_at", desdeMedianoche(hoy))
      .order("informado_at", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(conNombreYDocumento)
  },

  async getOrden(ordenId) {
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN)
      .eq("id", ordenId)
      .single()

    if (error) throw new Error(error.message)
    return conNombreYDocumento(data)
  },

  /** Los estudios agrupados por categoría, para leer antes de dictaminar.
   *  Mismo armado que la pantalla de carga: si algún día cambia el
   *  agrupamiento, cambia en los dos lados igual. */
  async getEstudiosDeOrden(ordenId) {
    const { data, error } = await supabase
      .from("orden_estudio")
      .select(
        `id, estado, resultado, detalle, observacion, fuera_de_rango, motivo_devolucion,
         estudio:estudio_id ( id, nombre, unidad, ref_h, ref_m, orden,
           categoria:categoria_id ( id, nombre, orden ) )`
      )
      .eq("orden_id", ordenId)
      .order("orden", { referencedTable: "estudio", ascending: true })

    if (error) throw new Error(error.message)

    const porCategoria = new Map()
    for (const fila of data ?? []) {
      const cat = fila.estudio.categoria
      if (!porCategoria.has(cat.id)) porCategoria.set(cat.id, { ...cat, items: [] })
      porCategoria.get(cat.id).items.push(fila)
    }
    return [...porCategoria.values()].sort((a, b) => a.orden - b.orden)
  },

  /** Emite el protocolo · RF22/RF23 · CP-19 · CP-21.
   *
   *  Las observaciones se guardan aparte porque emitir_protocolo() no
   *  las recibe. Van ANTES: si después el dictamen falla —por ejemplo
   *  porque alguien reabrió un estudio mientras tanto— lo escrito no se
   *  pierde y la orden queda como estaba, sin aptitud. */
  /** Los médicos laborales que pueden figurar como firmantes.
   *
   *  Hace falta cuando recepción transcribe la aptitud que el médico
   *  dictaminó en papel: la matrícula del protocolo es la de él, no
   *  la de quien tipea. */
  async getMedicosFirmantes() {
    const { data, error } = await supabase
      .from("profesional")
      .select("id, apellido_nombre, matricula_prov, matricula_nac")
      .eq("activo", true)
      .order("apellido_nombre")
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async emitir(ordenId, { aptitud, preexistencias, incapacidad, observaciones, medicoId }) {
    const limpio = (t) => {
      const v = (t ?? "").trim()
      return v === "" ? null : v
    }

    if (observaciones !== undefined) {
      const { error } = await supabase
        .from("orden")
        .update({ observaciones: limpio(observaciones) })
        .eq("id", ordenId)
      if (error) throw new Error(error.message)
    }

    const { error } = await supabase.rpc("emitir_protocolo", {
      p_orden: ordenId,
      p_aptitud: aptitud,
      /* Sólo viaja cuando lo transcribe recepción. El médico firma
         con su matrícula y la función la saca de la sesión. */
      p_medico: medicoId ? Number(medicoId) : null,
      p_preexistencias: limpio(preexistencias),
      p_incapacidad: incapacidad === "" || incapacidad === undefined || incapacidad === null
        ? null
        : Number(incapacidad),
    })
    if (error) throw new Error(error.message)
  },

  /** Devuelve un estudio al profesional que lo cargó · RF21, CP-18.
   *  El motivo es obligatorio: sin él, el que lo cargó no sabe qué
   *  corregir y la devolución no sirve de nada. La orden retrocede sola
   *  a EN_CURSO — eso lo hace el trigger, no esta llamada. */
  async devolverEstudio(ordenEstudioId, motivo) {
    const { error } = await supabase.rpc("devolver_estudio", {
      p_item: ordenEstudioId,
      p_motivo: (motivo ?? "").trim(),
    })
    if (error) throw new Error(error.message)
  },

  /* ------------------------------------------------------------------
     Legajo · RF02 regla b / CP-03
     El historial de una persona: todas sus órdenes, de la más nueva a
     la más vieja. Es lo que hace que volver a ingresar un documento
     traiga la ficha y no cree una segunda.
     ------------------------------------------------------------------ */

  /** Las últimas personas que pasaron por la clínica.
   *
   *  Es lo que se muestra en Legajos antes de buscar nada. Sin esto la
   *  pantalla abría vacía y diciendo «Personas (0)», que se lee como
   *  «no hay ninguna» cuando hay doce.
   *
   *  Y sirve de verdad: la consulta más frecuente es por alguien que
   *  acaba de pasar, así que muchas veces ya está en esta lista y no
   *  hace falta escribir nada. */
  async getUltimasPersonas(cuantas = 8) {
    const { data, error } = await supabase
      .from("orden")
      .select("fecha, persona:persona_id ( id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac, estado_civil, telefono, domicilio, ocupacion )")
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .limit(60)

    if (error) throw new Error(error.message)

    /* Una persona puede tener varias órdenes: se queda la primera vez
       que aparece, que es la más reciente. */
    const vistas = new Set()
    const lista = []
    for (const o of data ?? []) {
      const p = o.persona
      if (!p || vistas.has(p.id)) continue
      vistas.add(p.id)
      lista.push({
        ...p,
        apellido_nombre: `${p.apellido}, ${p.nombre}`,
        documento: `${p.tipo_doc} ${p.nro_doc}`,
        ultima: o.fecha,
      })
      if (lista.length >= cuantas) break
    }
    return lista
  },

  async buscarPersonas(texto) {
    const t = (texto ?? "").trim()
    if (t.length < 2) return []

    /* Si escribieron números, es un documento: se comparan sólo los
       dígitos. En el mostrador el DNI se tipea con puntos tanto como
       sin ellos, y en la base está guardado de una sola forma. */
    const soloDigitos = t.replace(/\D/g, "")
    const esNumero = soloDigitos.length > 0 && /^[\d.\s-]+$/.test(t)
    const filtro = esNumero
      ? `nro_doc.ilike.%${soloDigitos}%`
      : `apellido.ilike.%${t}%,nombre.ilike.%${t}%`

    const { data, error } = await supabase
      .from("persona")
      .select("id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac, estado_civil, telefono, domicilio, ocupacion")
      .or(filtro)
      .order("apellido", { ascending: true })
      .limit(25)

    if (error) throw new Error(error.message)
    return (data ?? []).map((p) => ({
      ...p,
      apellido_nombre: `${p.apellido}, ${p.nombre}`,
      documento: `${p.tipo_doc} ${p.nro_doc}`,
    }))
  },

  /** Corrige los datos de una persona ya cargada · RF05.
   *
   *  «Recepción da de alta Y MODIFICA los datos personales del
   *  trabajador.» Sólo estaba el alta: un apellido mal tipeado o un
   *  teléfono que cambió no tenían dónde corregirse.
   *
   *  El documento se puede corregir —a veces se carga mal— pero la base
   *  sigue impidiendo que quede repetido. Y el sexo también, porque a
   *  veces se carga mal: eso no reescribe las órdenes ya emitidas, que
   *  tienen sus estudios copiados desde que se crearon.
   *
   *  Todo cambio de apellido, nombre, sexo, fecha de nacimiento o
   *  documento queda en la auditoría con quién y cuándo (RF27). */
  async guardarPersona(persona) {
    const limpio = (v) => {
      const t = (v ?? "").toString().trim()
      return t === "" ? null : t
    }
    const { data, error } = await supabase
      .from("persona")
      .update({
        tipo_doc: persona.tipo_doc,
        nro_doc: limpio(persona.nro_doc),
        apellido: limpio(persona.apellido)?.toUpperCase(),
        nombre: limpio(persona.nombre)?.toUpperCase(),
        sexo: persona.sexo,
        fecha_nac: limpio(persona.fecha_nac),
        estado_civil: limpio(persona.estado_civil),
        telefono: limpio(persona.telefono),
        domicilio: limpio(persona.domicilio),
        ocupacion: limpio(persona.ocupacion),
      })
      .eq("id", persona.id)
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya hay otra persona con ese documento.")
      }
      if (error.code === "42501") {
        throw new Error("El padrón lo mantienen Recepción y el Administrador (RF05).")
      }
      throw new Error(error.message)
    }
    return data
  },

  async getLegajo(personaId) {
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN + ", fecha_vencimiento")
      .eq("persona_id", personaId)
      .order("fecha", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(conNombreYDocumento)
  },
}
