import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Resumen del Administrador, con datos reales de la base.

   Mantiene la forma que consume DashboardAdmin. Cada número sale de una
   consulta contra la base. Donde la maqueta mostraba cosas que el modelo
   todavía no registra (respaldos, estudios "devueltos", firmas
   faltantes) se omiten en vez de inventarse — ver alertas_sistema.
   --------------------------------------------------------------------- */

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Cuenta filas sin traerlas (head: true). El filtro es una función que
// recibe la query y le encadena los .eq() que hagan falta.
async function contar(tabla, filtro = (q) => q) {
  const { count, error } = await filtro(
    supabase.from(tabla).select("*", { count: "exact", head: true })
  )
  if (error) throw new Error(error.message)
  return count ?? 0
}

function ultimosDias(n) {
  const dias = []
  const hoy = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    dias.push(d)
  }
  return dias
}

const claveDia = (d) => d.toISOString().slice(0, 10)
const etiquetaDia = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`

// rol_carga de la categoría → nombre de área que muestra el panel
const ETIQUETA_AREA = {
  R3: "Médico Laboral",
  R4: "Clínica Médica",
  R5: "Laboratorio",
  R6: "Rayos",
  R7: "Audiometría",
  R8: "Psicología",
}

export const dashboardService = {
  async getResumenAdministrador() {
    const hoy = hoyISO()

    const [
      ordenesHoy,
      ordenesHoyEnCurso,
      ordenesHoyCompletas,
      estudiosPendientes,
      empresasActivas,
      personas,
      prelaboral,
      periodico,
      egreso,
    ] = await Promise.all([
      contar("orden", (q) => q.eq("fecha", hoy)),
      contar("orden", (q) => q.eq("fecha", hoy).eq("estado", "EN_CURSO")),
      contar("orden", (q) => q.eq("fecha", hoy).eq("estado", "COMPLETA")),
      contar("orden_estudio", (q) => q.eq("estado", "PENDIENTE")),
      contar("empresa", (q) => q.eq("activo", true)),
      contar("persona"),
      contar("orden", (q) => q.eq("tipo_examen", "PRELABORAL")),
      contar("orden", (q) => q.eq("tipo_examen", "PERIODICO")),
      contar("orden", (q) => q.eq("tipo_examen", "EGRESO")),
    ])

    const totalTipos = prelaboral + periodico + egreso || 1
    const pct = (n) => Math.round((n / totalTipos) * 100)

    // Pendientes por área: se agrupa v_pendientes por rol responsable.
    const { data: pend, error: ePend } = await supabase
      .from("v_pendientes")
      .select("rol_responsable")
    if (ePend) throw new Error(ePend.message)
    const porArea = {}
    for (const row of pend ?? []) {
      const area = ETIQUETA_AREA[row.rol_responsable] ?? row.rol_responsable
      porArea[area] = (porArea[area] ?? 0) + 1
    }

    // Actividad de los últimos 7 días: órdenes creadas y estudios cargados.
    const dias = ultimosDias(7)
    const desde = claveDia(dias[0])
    const [{ data: ordCreadas }, { data: estCargados }] = await Promise.all([
      supabase.from("orden").select("creado_at").gte("creado_at", desde),
      supabase.from("orden_estudio").select("cargado_at").gte("cargado_at", desde),
    ])
    const actividad_7_dias = dias.map((d) => {
      const k = claveDia(d)
      return {
        dia: etiquetaDia(d),
        ordenes_creadas: (ordCreadas ?? []).filter(
          (o) => o.creado_at?.slice(0, 10) === k
        ).length,
        estudios_cargados: (estCargados ?? []).filter(
          (e) => e.cargado_at?.slice(0, 10) === k
        ).length,
      }
    })

    // Alertas del sistema con origen real. Hoy solo las vigencias (RF24);
    // "devueltos", "sin firma" y "respaldos" no tienen fuente en el
    // esquema todavía, así que no se muestran para no fingir un dato.
    const vencen = await contar("v_vencimientos")
    const alertas_sistema = []
    if (vencen > 0) {
      alertas_sistema.push({
        id: "al-vigencia",
        tipo: "vigencia",
        texto: `${vencen} ${vencen === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
        accion: "Ver",
      })
    }

    return {
      kpis: {
        ordenes_hoy: {
          total: ordenesHoy,
          detalle: `${ordenesHoyEnCurso} en curso · ${ordenesHoyCompletas} completas`,
        },
        estudios_pendientes: {
          total: estudiosPendientes,
          detalle: "Asignados a profesionales",
        },
        empresas_activas: { total: empresasActivas, detalle: "En padrón" },
        personas_registradas: { total: personas, detalle: "Total en el sistema" },
      },
      actividad_7_dias,
      ordenes_por_tipo: [
        { tipo: "Prelaboral", cantidad: prelaboral, porcentaje: pct(prelaboral) },
        { tipo: "Periódico", cantidad: periodico, porcentaje: pct(periodico) },
        { tipo: "Egreso", cantidad: egreso, porcentaje: pct(egreso) },
      ],
      pendientes_por_area: Object.entries(porArea).map(([area, pendientes]) => ({
        area,
        pendientes,
      })),
      alertas_sistema,
    }
  },
}
