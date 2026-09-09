import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Órdenes del día y estudios pendientes para la Bandeja (RF15).

   Mantiene EXACTAMENTE la forma que espera BandejaPage —mismos métodos,
   mismos nombres de campo— para no tocar ninguna pantalla. Es la regla 4
   de TRABAJAR.md: el servicio es la frontera, el componente no se entera
   de dónde salen los datos.

   Este adaptador traduce dos cosas del vocabulario de la base al que hoy
   habla la pantalla (heredado de la maqueta). Ver dominio.ts:
   · estado: la base usa ABIERTA/EN_CURSO/COMPLETA/INFORMADA; la pantalla
     todavía usa pendiente/en_curso/completo. Se mapea acá hasta que una
     tarea posterior alinee BandejaPage con dominio.ts.
   · tipo_examen: la base lo guarda en MAYÚSCULAS; la pantalla lo busca en
     minúsculas en TIPO_EXAMEN_LABEL.
   --------------------------------------------------------------------- */

// base (dominio.ts) → vocabulario que hoy entiende BandejaPage
const ESTADO_A_PANTALLA = {
  ABIERTA: "pendiente",
  EN_CURSO: "en_curso",
  COMPLETA: "completo",
  INFORMADA: "completo", // ya informada = terminada, para la bandeja
}

function aOrdenPantalla(row) {
  return {
    id: row.id,
    tipo_examen: (row.tipo_examen ?? "").toLowerCase(),
    estado: ESTADO_A_PANTALLA[row.estado] ?? "pendiente",
    persona: row.persona
      ? {
          apellido_nombre: `${row.persona.apellido}, ${row.persona.nombre}`,
          documento: row.persona.nro_doc, // la pantalla ya antepone "DNI"
        }
      : null,
    empresa: row.empresa ? { razon_social: row.empresa.razon_social } : null,
  }
}

export const ordenesService = {
  async getOrdenesDelDia() {
    // La bandeja sale casi entera de v_orden_avance, pero esa vista no
    // trae tipo_examen (que la pantalla muestra) y arma el documento como
    // "DNI 1234", que la pantalla volvería a prefijar con "DNI". Por eso
    // se consulta `orden` con persona y empresa embebidas: el RLS deja ver
    // la orden a cualquier sesión, y persona/empresa a Recepción (R2) y
    // Médico laboral (R3).
    // Nota RF15: "del día" se puede acotar agregando .eq("fecha", hoy);
    // por ahora trae todas, de la más nueva a la más vieja.
    const { data, error } = await supabase
      .from("orden")
      .select(
        "id, numero, tipo_examen, estado, " +
          "persona:persona_id (apellido, nombre, nro_doc), " +
          "empresa:empresa_id (razon_social)"
      )
      .order("numero", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(aOrdenPantalla)
  },

  async getEstudiosPendientes() {
    // v_pendientes ya resuelve el join y respeta el RLS (security_invoker).
    // No trae un id propio: se sintetiza para la key de React.
    const { data, error } = await supabase
      .from("v_pendientes")
      .select("numero, paciente, empresa, categoria, estudio, rol_responsable")
      .order("numero", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: `${row.numero}::${row.estudio}`,
      persona: { apellido_nombre: row.paciente },
      estudio: row.estudio,
      categoria: row.categoria,
      // "prioridad" es un resto de la maqueta: el modelo no la registra.
      // Se deja fija en "media" para que la pantalla no se rompa. Si se
      // decide conservar la columna, hay que definir de dónde sale.
      prioridad: "media",
    }))
  },
}
