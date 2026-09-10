import { supabase } from "../../../lib/supabase"
import { hoyLocal } from "../../../lib/fechas"

/* ---------------------------------------------------------------------
   Lo que le queda a recepción además del alta: empresas, el pendiente
   del día y el listado por empresa — CU-05, CU-13 · CP-25, CP-26.

   El listado y los pendientes salen de v_orden_avance, la vista que ya
   cuenta estudios, cargados y pendientes de cada orden. No se recuenta
   nada acá: si la cuenta cambiara, cambia en la base y las dos pantallas
   la ven igual.
   --------------------------------------------------------------------- */

const limpio = (v) => {
  const t = (v ?? "").toString().trim()
  return t === "" ? null : t
}

export const recepcionService = {
  /* ---------------- empresas · CU-05 ---------------- */

  async getEmpresas(soloActivas = false) {
    let q = supabase
      .from("empresa")
      .select("id, codigo, razon_social, cuit, domicilio, telefono, activo")
      .order("razon_social")
    if (soloActivas) q = q.eq("activo", true)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async guardarEmpresa(empresa) {
    const fila = {
      codigo: limpio(empresa.codigo),
      razon_social: limpio(empresa.razon_social)?.toUpperCase(),
      cuit: limpio(empresa.cuit),
      domicilio: limpio(empresa.domicilio),
      telefono: limpio(empresa.telefono),
      activo: empresa.activo ?? true,
    }

    const { data, error } = empresa.id
      ? await supabase.from("empresa").update(fila).eq("id", empresa.id).select().single()
      : await supabase.from("empresa").insert(fila).select().single()

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya hay una empresa con ese código o ese CUIT.")
      }
      throw new Error(error.message)
    }
    return data
  },

  /** No se borran: se desactivan. Una empresa con órdenes viejas tiene
   *  que seguir existiendo para que esas órdenes sigan diciendo de quién
   *  eran. Desactivada, deja de ofrecerse al abrir una orden nueva. */
  async cambiarActivo(id, activo) {
    const { error } = await supabase.from("empresa").update({ activo }).eq("id", id)
    if (error) throw new Error(error.message)
  },

  /* ---------------- pendientes del día · CP-26 ---------------- */

  /** Las órdenes de hoy que todavía no se informaron, separando las que
   *  siguen en curso de las que ya están completas esperando al médico. */
  async getPendientesDelDia() {
    const hoy = hoyLocal()
    const { data, error } = await supabase
      .from("v_orden_avance")
      .select("*")
      .eq("fecha", hoy)
      .neq("estado", "INFORMADA")
      .order("numero", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Las que quedaron sin terminar de días anteriores.
   *
   *  RF26 pide "los estudios sin cargar del día", y eso es lo que hace la
   *  consulta de arriba. El problema es lo que queda afuera: una orden a
   *  medias de ayer desaparece de la Bandeja Y de Pendientes, porque las
   *  dos filtran por la fecha de hoy.
   *
   *  El caso real: el paciente viene el lunes, hace 50 de 55 estudios y
   *  vuelve el miércoles por el toxicológico. El martes esa orden es
   *  invisible: nadie la persigue, y sólo reaparece si a alguien se le
   *  ocurre buscar a la persona por apellido. Así es como una orden queda
   *  varada, y del otro lado hay alguien esperando saber si está apto.
   *
   *  Se muestran aparte, no mezcladas: "del día" tiene que seguir
   *  significando lo que dice.
   */
  async getArrastre() {
    const { data, error } = await supabase
      .from("v_orden_avance")
      .select("*")
      .lt("fecha", hoyLocal())
      .neq("estado", "INFORMADA")
      .order("fecha", { ascending: true })

    if (error) throw new Error(error.message)
    return data ?? []
  },

  /* ---------------- listado de órdenes · CP-25 ---------------- */

  /** El listado mensual que hoy se arma a mano en Excel: las órdenes de
   *  un período, opcionalmente de una empresa, con su importe. */
  async getListado({ desde, hasta, empresa }) {
    let q = supabase.from("v_orden_avance").select("*")
    if (desde) q = q.gte("fecha", desde)
    if (hasta) q = q.lte("fecha", hasta)
    if (empresa) q = q.eq("empresa", empresa)

    const { data, error } = await q.order("fecha", { ascending: false }).order("numero", { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
