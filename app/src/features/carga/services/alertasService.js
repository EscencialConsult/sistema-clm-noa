import { supabase } from "../../../lib/supabase"
import { authService } from "../../auth/services/authService"

/* ---------------------------------------------------------------------
   Alertas personales de la bandeja — reales, contra la base.

   Antes salían de mock/data/alertas_personales.json y siempre decían lo
   mismo: «2 estudios devueltos», «1 informe de tercero pendiente»,
   «3 exámenes vencen». Números fijos, en pantalla, con cara de verdad.

   De las tres de la maqueta quedó una. Las otras dos no se pueden
   sostener con lo que hoy guarda el sistema:

   · «informes de terceros pendientes de validar». Los informes externos
     se suben al bucket, pero no hay un estado «esperando validación»
     que se pueda consultar.

   La de «estudios devueltos» SÍ está, desde la migración 018. Hasta
   entonces un estudio devuelto volvía a quedar PENDIENTE, igual que uno
   que nunca se cargó, y contarlos habría sido contar cualquier
   pendiente. Ahora DEVUELTO es un estado propio.

   Marcela llegó a la misma conclusión por su lado (rama tarea1) y la
   escribió igual de claro: se omiten en vez de inventar un número.

   Se agregan dos que sí tienen de dónde salir: lo pendiente del área de
   quien mira —que es lo único accionable de este panel— y lo que se
   derivó y todavía no volvió (RF19).
   --------------------------------------------------------------------- */

export const alertasService = {
  async getAlertasPersonales() {
    const sesion = authService.getSesionActual()
    if (!sesion) return []

    const roles = sesion.roles ?? []
    const alertas = []

    /* --- lo pendiente de mi área --- */
    /* v_pendientes ya filtra por orden no informada y estudio pendiente;
       acá sólo se recorta a las categorías que carga este rol. */
    const { data: pendientes, error } = await supabase
      .from("v_pendientes")
      .select("rol_responsable")
    if (error) throw new Error(error.message)

    const mios = (pendientes ?? []).filter((p) => roles.includes(p.rol_responsable)).length
    if (mios > 0) {
      alertas.push({
        id: "al-p-mi-area",
        tipo: "pendiente",
        texto: `${mios} ${mios === 1 ? "estudio pendiente" : "estudios pendientes"} de tu área`,
      })
    }

    /* --- lo que el médico me devolvió (RF21) --- */
    const { count: devueltos, error: eDev } = await supabase
      .from("orden_estudio")
      .select("*", { count: "exact", head: true })
      .eq("estado", "DEVUELTO")
    if (eDev) throw new Error(eDev.message)

    if (devueltos > 0) {
      alertas.push({
        id: "al-p-devuelto",
        tipo: "devuelto",
        texto: `${devueltos} ${devueltos === 1 ? "estudio devuelto" : "estudios devueltos"} para revisar`,
      })
    }

    /* --- derivados que no volvieron (RF19) --- */
    const { count: derivados, error: e2 } = await supabase
      .from("orden_estudio")
      .select("*", { count: "exact", head: true })
      .eq("estado", "DERIVADO")
    if (e2) throw new Error(e2.message)

    if (derivados > 0) {
      alertas.push({
        id: "al-p-derivado",
        tipo: "derivado",
        texto: `${derivados} ${derivados === 1 ? "estudio derivado sigue" : "estudios derivados siguen"} sin volver`,
      })
    }

    /* --- vigencias próximas (RF24) --- */
    /* Se cuenta sin traer las filas, y sin filtrar por días: v_vencimientos
       YA acota a los próximos 30 en su propia definición. Iba con un
       .lte("dias", 30) de más hasta que Marcela lo señaló. */
    const { count: porVencer, error: e3 } = await supabase
      .from("v_vencimientos")
      .select("*", { count: "exact", head: true })
    if (e3) throw new Error(e3.message)

    if (porVencer > 0) {
      alertas.push({
        id: "al-p-vigencia",
        tipo: "vigencia",
        texto: `${porVencer} ${porVencer === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
      })
    }

    return alertas
  },
}
