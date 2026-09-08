import { supabase } from "../../../lib/supabase"
import { authService } from "../../auth/services/authService"

/* ---------------------------------------------------------------------
   Alertas personales de la bandeja — reales, contra la base.

   Antes salían de mock/data/alertas_personales.json y siempre decían lo
   mismo: «2 estudios devueltos», «1 informe de tercero pendiente»,
   «3 exámenes vencen». Números fijos, en pantalla, con cara de verdad.

   De las tres de la maqueta quedó una. Las otras dos no se pueden
   sostener con lo que hoy guarda el sistema:

   · «estudios devueltos». Cuando el médico laboral devuelve un estudio
     (CP-18) vuelve a quedar PENDIENTE, igual que uno que nunca se cargó.
     La base no distingue una cosa de la otra, así que una alerta de
     devueltos contaría cualquier pendiente. Para tenerla habría que
     guardar la devolución, y eso no está pedido en el prelaboral.

   · «informes de terceros pendientes de validar». Los informes externos
     se suben al bucket, pero no hay un estado «esperando validación»
     que se pueda consultar. Mismo caso.

   Quedan las que sí se pueden contar de verdad: lo pendiente del área de
   quien mira, lo que se derivó y no volvió (RF19), y los exámenes por
   vencer (vigencia a 12 meses).
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

    /* --- vigencias próximas --- */
    const { data: porVencer, error: e3 } = await supabase
      .from("v_vencimientos")
      .select("dias")
      .lte("dias", 30)
    if (e3) throw new Error(e3.message)

    if ((porVencer?.length ?? 0) > 0) {
      alertas.push({
        id: "al-p-vigencia",
        tipo: "vigencia",
        texto: `${porVencer.length} ${porVencer.length === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
      })
    }

    return alertas
  },
}
