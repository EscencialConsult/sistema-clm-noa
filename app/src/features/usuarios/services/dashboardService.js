import { supabase } from "../../../lib/supabase"
import { hoyLocal, haceDias, desdeMedianoche } from "../../../lib/fechas"

/* ---------------------------------------------------------------------
   Resumen del Administrador — real, contra la base.

   Antes leía de mock/data/dashboard_admin.json: la pantalla se veía
   perfecta y todos los números eran inventados. Un tablero que miente
   es peor que no tener tablero, porque se le cree.

   Esta versión junta dos que se escribieron en paralelo sin saberlo: la
   de la rama tarea1 (Marcela) y la del commit ffb1bf1. Se tomó de cada
   una lo que estaba mejor resuelto, y queda anotado dónde.

   Dos reglas a las que las dos llegaron por separado:

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

   2 · Las cuentas las hace PostgREST con count exacto, y los
       agrupamientos se arman acá con los datos que RLS deja ver. No hay
       ninguna función nueva en la base: quien mira este tablero ve
       exactamente lo que tiene permitido ver, ni una fila más.
   --------------------------------------------------------------------- */

async function contar(tabla, armar = (q) => q) {
  const { count, error } = await armar(
    supabase.from(tabla).select("*", { count: "exact", head: true })
  )
  if (error) throw new Error(error.message)
  return count ?? 0
}

/* rol_carga de la categoría → el nombre del ÁREA, que no siempre es el
   del rol: R4 es «Médico clínico» como rol, pero en un panel de áreas se
   lee «Clínica Médica». La distinción viene de tarea1. */
const ETIQUETA_AREA = {
  R3: "Médico Laboral",
  R4: "Clínica Médica",
  R5: "Laboratorio",
  R6: "Rayos",
  R7: "Audiometría",
  R8: "Psicología",
}

const diaCorto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

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
      prelaboral,
      periodico,
      egreso,
      derivados,
      porVencer,
      { data: pendientes, error: e1 },
      { data: ordenesSemana, error: e2 },
      { data: cargadosSemana, error: e3 },
    ] = await Promise.all([
      contar("orden", (q) => q.eq("fecha", hoy)),
      contar("orden", (q) => q.eq("fecha", hoy).in("estado", ["ABIERTA", "EN_CURSO"])),
      contar("orden", (q) => q.eq("fecha", hoy).eq("estado", "COMPLETA")),
      contar("empresa", (q) => q.eq("activo", true)),
      contar("persona"),
      /* Por tipo se cuenta el TOTAL, no el día: con dos órdenes de hoy la
         torta muestra 50 y 50 y no dice nada. Criterio de tarea1. */
      contar("orden", (q) => q.eq("tipo_examen", "PRELABORAL")),
      contar("orden", (q) => q.eq("tipo_examen", "PERIODICO")),
      contar("orden", (q) => q.eq("tipo_examen", "EGRESO")),
      contar("orden_estudio", (q) => q.eq("estado", "DERIVADO")),
      /* Sin filtrar por días: v_vencimientos ya acota a los próximos 30
         en su propia definición. Iba con un .lte("dias", 30) de más
         hasta que apareció tarea1. */
      contar("v_vencimientos"),
      supabase.from("v_pendientes").select("rol_responsable"),
      supabase.from("orden").select("fecha").gte("fecha", desde),
      supabase.from("orden_estudio").select("cargado_at").gte("cargado_at", desdeMedianoche(desde)),
    ])

    const primerError = [e1, e2, e3].find(Boolean)
    if (primerError) throw new Error(primerError.message)

    /* --- pendientes por área --- */
    const porArea = new Map()
    for (const p of pendientes ?? []) {
      const area = ETIQUETA_AREA[p.rol_responsable] ?? p.rol_responsable
      porArea.set(area, (porArea.get(area) ?? 0) + 1)
    }
    const pendientes_por_area = [...porArea.entries()]
      .map(([area, n]) => ({ area, pendientes: n }))
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

    /* --- órdenes por tipo --- */
    const totalTipos = prelaboral + periodico + egreso || 1
    const pct = (n) => Math.round((n / totalTipos) * 100)
    const ordenes_por_tipo = [
      { tipo: "Prelaboral", cantidad: prelaboral, porcentaje: pct(prelaboral) },
      { tipo: "Periódico", cantidad: periodico, porcentaje: pct(periodico) },
      { tipo: "Egreso", cantidad: egreso, porcentaje: pct(egreso) },
    ]

    /* --- alertas: sólo las que se pueden comprobar --- */
    const alertas_sistema = []
    if (porVencer > 0) {
      alertas_sistema.push({
        id: "al-s-vigencia", tipo: "vigencia",
        texto: `${porVencer} ${porVencer === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
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
