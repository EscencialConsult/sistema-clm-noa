import { supabase } from "../../../lib/supabase"
import { hoyLocal } from "../../../lib/fechas"

/* ---------------------------------------------------------------------
   Órdenes — real, contra Supabase (ver TRABAJAR.md, "La bandeja del día"
   y "Las categorías con sus estudios, para la pantalla de carga").

   Antes leía de mock/data/ordenes.json. Se mantiene la misma forma que
   esperan las pantallas (persona.apellido_nombre no existía en la base,
   así que se arma acá una sola vez en vez de repetirlo en cada .jsx).

   Los estados que devuelve son los de orden.estado / dominio.ts
   (ABIERTA · EN_CURSO · COMPLETA · INFORMADA) — no se inventan variantes
   en minúscula acá. Ese fue justo el bug que ya pasó en Carnicerías.
   --------------------------------------------------------------------- */

const SELECT_ORDEN = `
  id, numero, fecha, tipo_examen, tarea, estado, aptitud, importe,
  persona:persona_id ( id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac ),
  empresa:empresa_id ( id, razon_social )
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

export const ordenesService = {
  /** RF11 — Bandeja del Día: las órdenes con fecha de hoy. */
  async getOrdenesDelDia() {
    const hoy = hoyLocal()
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN)
      .eq("fecha", hoy)
      .order("numero", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(conNombreYDocumento)
  },

  /** RF16/RF19 — v_pendientes: qué falta cargar y de quién es (rol_responsable). */
  async getEstudiosPendientes() {
    const { data, error } = await supabase
      .from("v_pendientes")
      .select("numero, fecha, paciente, empresa, categoria, estudio, rol_responsable")
      .order("fecha", { ascending: false })

    if (error) throw new Error(error.message)
    /* La vista agrupa filas de orden_estudio y no expone un id propio.
       Se sintetiza uno estable —número de orden más nombre del estudio,
       que juntos son únicos— para que React tenga key. Lo señaló la rama
       tarea1; sin esto la lista se re-renderiza mal al recargar. */
    return (data ?? []).map((row) => ({ ...row, id: `${row.numero}::${row.estudio}` }))
  },

  /** Cabecera de una orden puntual — para abrir la pantalla de carga. */
  async getOrden(ordenId) {
    const { data, error } = await supabase
      .from("orden")
      .select(SELECT_ORDEN)
      .eq("id", ordenId)
      .single()

    if (error) throw new Error(error.message)
    return conNombreYDocumento(data)
  },

  /**
   * Las dos grillas: categorías involucradas en la orden (con su avance)
   * y, dentro de cada una, sus estudios con lo que ya está cargado.
   * Trae orden_estudio con el estudio y la categoría embebidos, y arma
   * el agrupamiento del lado del cliente porque es una sola orden — no
   * vale la pena una vista para esto.
   */
  async getEstudiosDeOrden(ordenId) {
    const { data, error } = await supabase
      .from("orden_estudio")
      .select(
        `id, estado, resultado, detalle, observacion, fuera_de_rango,
         estudio:estudio_id ( id, nombre, unidad, ref_h, ref_m, orden,
           categoria:categoria_id ( id, nombre, orden, rol_carga, valor_defecto ) )`
      )
      .eq("orden_id", ordenId)
      .order("orden", { referencedTable: "estudio", ascending: true })

    if (error) throw new Error(error.message)

    const porCategoria = new Map()
    for (const fila of data ?? []) {
      const cat = fila.estudio.categoria
      if (!porCategoria.has(cat.id)) {
        porCategoria.set(cat.id, { ...cat, items: [] })
      }
      porCategoria.get(cat.id).items.push(fila)
    }
    return [...porCategoria.values()].sort((a, b) => a.orden - b.orden)
  },

  /** Guarda un resultado. El trigger decide solo si quedó fuera de rango
   *  y si la orden pasa a COMPLETA — no hay que tocar esos dos campos. */
  async guardarResultado(ordenEstudioId, { resultado, detalle, observacion }) {
    const { error } = await supabase
      .from("orden_estudio")
      .update({ resultado, detalle, observacion, estado: "CARGADO" })
      .eq("id", ordenEstudioId)

    if (error) throw new Error(error.message)
  },

  /** RF16/CP-13 — una categoría entera en NORMAL, de un clic. */
  async cargarCategoriaNormal(ordenId, categoriaId) {
    const { data, error } = await supabase.rpc("cargar_categoria_normal", {
      p_orden: ordenId,
      p_categoria: categoriaId,
    })
    if (error) throw new Error(error.message)
    return data // cantidad de estudios que cargó
  },

  /** Deshace una carga: vuelve el estudio a PENDIENTE y borra lo escrito.
   *  Para el "eliminar datos" de una selección múltiple en la pantalla
   *  de carga — no es una regla de negocio, es corregir un error de
   *  tipeo antes de seguir. */
  async limpiarResultado(ordenEstudioId) {
    const { error } = await supabase
      .from("orden_estudio")
      .update({
        resultado: null,
        detalle: null,
        observacion: null,
        estado: "PENDIENTE",
        cargado_por: null,
        cargado_at: null,
      })
      .eq("id", ordenEstudioId)

    if (error) throw new Error(error.message)
  },
}
