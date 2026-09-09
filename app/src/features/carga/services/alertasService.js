import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Alertas personales de la Bandeja. Mantiene la forma que consume
   BandejaPage: [{ id, tipo, texto }].

   Hoy el modelo solo tiene una fuente real de alerta: los exámenes por
   vencer (RF24), que resuelve v_vencimientos (≤ 30 días).

   Las otras dos que mostraba la maqueta —estudios "devueltos" e informes
   de tercero pendientes— todavía no tienen dónde leerse: no hay estado
   "devuelto" (RF21) ni marca de informe pendiente en el esquema. Se
   omiten en vez de inventar un número, hasta que exista el dato.
   --------------------------------------------------------------------- */

export const alertasService = {
  async getAlertasPersonales() {
    const { count, error } = await supabase
      .from("v_vencimientos")
      .select("*", { count: "exact", head: true })

    if (error) throw new Error(error.message)

    const alertas = []
    if (count > 0) {
      alertas.push({
        id: "vigencia",
        tipo: "vigencia",
        texto: `${count} ${count === 1 ? "examen vence" : "exámenes vencen"} en 30 días`,
      })
    }
    return alertas
  },
}
