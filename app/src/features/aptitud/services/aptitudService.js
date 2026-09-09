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
        `id, estado, resultado, detalle, observacion, fuera_de_rango,
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
  async emitir(ordenId, { aptitud, preexistencias, incapacidad, observaciones }) {
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
      p_preexistencias: limpio(preexistencias),
      p_incapacidad: incapacidad === "" || incapacidad === undefined || incapacidad === null
        ? null
        : Number(incapacidad),
    })
    if (error) throw new Error(error.message)
  },

  /* ------------------------------------------------------------------
     Legajo · RF02 regla b / CP-03
     El historial de una persona: todas sus órdenes, de la más nueva a
     la más vieja. Es lo que hace que volver a ingresar un documento
     traiga la ficha y no cree una segunda.
     ------------------------------------------------------------------ */

  async buscarPersonas(texto) {
    const t = (texto ?? "").trim()
    if (t.length < 2) return []

    const esNumero = /^\d+$/.test(t)
    const filtro = esNumero
      ? `nro_doc.ilike.%${t}%`
      : `apellido.ilike.%${t}%,nombre.ilike.%${t}%`

    const { data, error } = await supabase
      .from("persona")
      .select("id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac")
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
