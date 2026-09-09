import { supabase } from "../../../lib/supabase"
import { ETIQUETA_ROL } from "../../../types/dominio"
import { hoyLocal, haceDias, desdeMedianoche } from "../../../lib/fechas"

/* ---------------------------------------------------------------------
   Resumen del Administrador — real, contra la base.

   Antes leía de mock/data/dashboard_admin.json: la pantalla se veía
   perfecta y todos los números eran inventados. Un tablero que miente
   es peor que no tener tablero, porque se le cree.

   Dos reglas que se siguieron al conectarlo:

   1 · Lo que no se puede sacar de la base, NO se muestra. La maqueta
       traía dos alertas que se sacaron enteras:

       «Respaldos automáticos al día — último 30/05 02:00». El estado
       del backup no vive en la base: lo hace una tarea programada del
       sistema operativo (INSTALAR.md paso 7). Hacerle creer a alguien
       que hay respaldo cuando no lo sabemos es justo el error que no
       queremos.

       «2 profesionales sin firma cargada». La firma de los profesionales
       no es parte del prelaboral: es otro incremento y todavía no se
       diseñó. No hay requisito ni columna, así que no hay alerta.

       Quedan sólo las dos que sí están en los requerimientos: los
       exámenes por vencer (vigencia a 12 meses) y los estudios
       derivados que no volvieron (RF19).

   2 · Las cuentas las hace PostgREST con count exacto, y los
       agrupamientos se arman acá con los datos que RLS deja ver. No hay
       ninguna función nueva en la base: quien mira este tablero ve
       exactamente lo que tiene permitido ver, ni una fila más.
   --------------------------------------------------------------------- */

const diaCorto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

async function contar(tabla, armar = (q) => q) {
  const { count, error } = await armar(
    supabase.from(tabla).select("*", { count: "exact", head: true })
  )
  if (error) throw new Error(error.message)
  return count ?? 0
}

const TIPO_LABEL = { PRELABORAL: "Prelaboral", PERIODICO: "Periódico", EGRESO: "Egreso" }

export const dashboardService = {
  async getResumenAdministrador() {
    const hoy = hoyLocal()
    const desde = haceDias(6)

    const [
      ordenesHoy,
      enCurso,
      completas,
      empresas,
      personas,
      { data: pendientes, error: e1 },
      { data: ordenesSemana, error: e2 },
      { data: cargadosSemana, error: e3 },
      { data: tiposHoy, error: e4 },
      { data: porVencer, error: e5 },
      derivados,
    ] = await Promise.all([
      contar("orden", (q) => q.eq("fecha", hoy)),
      contar("orden", (q) => q.eq("fecha", hoy).in("estado", ["ABIERTA", "EN_CURSO"])),
      contar("orden", (q) => q.eq("fecha", hoy).eq("estado", "COMPLETA")),
      contar("empresa", (q) => q.eq("activo", true)),
      contar("persona"),
      supabase.from("v_pendientes").select("rol_responsable"),
      supabase.from("orden").select("fecha").gte("fecha", desde),
      supabase.from("orden_estudio").select("cargado_at").gte("cargado_at", desdeMedianoche(desde)),
      supabase.from("orden").select("tipo_examen").eq("fecha", hoy),
      supabase.from("v_vencimientos").select("dias").lte("dias", 30),
      contar("orden_estudio", (q) => q.eq("estado", "DERIVADO")),
    ])

    const primerError = [e1, e2, e3, e4, e5].find(Boolean)
    if (primerError) throw new Error(primerError.message)

    /* --- pendientes por área --- */
    const porArea = new Map()
    for (const p of pendientes ?? []) {
      porArea.set(p.rol_responsable, (porArea.get(p.rol_responsable) ?? 0) + 1)
    }
    const pendientes_por_area = [...porArea.entries()]
      .map(([rol, n]) => ({ area: ETIQUETA_ROL[rol] ?? rol, pendientes: n }))
      .sort((a, b) => b.pendientes - a.pendientes)

    /* --- actividad de los últimos 7 días --- */
    const dias = Array.from({ length: 7 }, (_, i) => haceDias(6 - i))
    const creadas = new Map(dias.map((d) => [d, 0]))
    const cargados = new Map(dias.map((d) => [d, 0]))
    for (const o of ordenesSemana ?? []) {
      if (creadas.has(o.fecha)) creadas.set(o.fecha, creadas.get(o.fecha) + 1)
    }
    for (const c of cargadosSemana ?? []) {
      const d = (c.cargado_at ?? "").slice(0, 10)
      if (cargados.has(d)) cargados.set(d, cargados.get(d) + 1)
    }
    const actividad_7_dias = dias.map((d) => ({
      dia: diaCorto(d),
      ordenes_creadas: creadas.get(d),
      estudios_cargados: cargados.get(d),
    }))

    /* --- órdenes de hoy por tipo de examen --- */
    const porTipo = new Map()
    for (const o of tiposHoy ?? []) {
      porTipo.set(o.tipo_examen, (porTipo.get(o.tipo_examen) ?? 0) + 1)
    }
    const totalTipos = tiposHoy?.length ?? 0
    const ordenes_por_tipo = [...porTipo.entries()].map(([tipo, cantidad]) => ({
      tipo: TIPO_LABEL[tipo] ?? tipo,
      cantidad,
      porcentaje: totalTipos ? Math.round((cantidad / totalTipos) * 100) : 0,
    }))

    /* --- alertas: sólo las que se pueden comprobar --- */
    const alertas_sistema = []
    if ((porVencer?.length ?? 0) > 0) {
      alertas_sistema.push({
        id: "al-s-vigencia", tipo: "vigencia",
        texto: `${porVencer.length} ${porVencer.length === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
        accion: "Ver",
      })
    }
    if (derivados > 0) {
      alertas_sistema.push({
        id: "al-s-derivado", tipo: "devuelto",
        texto: `${derivados} ${derivados === 1 ? "estudio derivado sigue" : "estudios derivados siguen"} sin volver`,
        accion: "Ver",
      })
    }

    return {
      kpis: {
        ordenes_hoy: {
          total: ordenesHoy,
          detalle: `${enCurso} en curso · ${completas} completas`,
        },
        estudios_pendientes: {
          total: pendientes?.length ?? 0,
          detalle: "Asignados a profesionales",
        },
        empresas_activas: { total: empresas, detalle: "En padrón" },
        personas_registradas: { total: personas, detalle: "Total en el sistema" },
      },
      actividad_7_dias,
      ordenes_por_tipo,
      pendientes_por_area,
      alertas_sistema,
    }
  },
}
