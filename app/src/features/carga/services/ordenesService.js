import ordenes from "../../../mock/data/ordenes.json"
import estudiosPendientes from "../../../mock/data/estudios_pendientes.json"
import personas from "../../../mock/data/personas.json"
import empresas from "../../../mock/data/empresas.json"
import { delay } from "../../../lib/delay"

function conPersonaYEmpresa(orden) {
  const persona = personas.find((p) => p.id === orden.persona_id)
  const empresa = empresas.find((e) => e.id === orden.empresa_id)
  return { ...orden, persona, empresa }
}

// RF11 tipo_examen: prelaboral | periodico | egreso
export const ordenesService = {
  async getOrdenesDelDia() {
    await delay()
    return ordenes.map(conPersonaYEmpresa)
  },

  async getEstudiosPendientes() {
    await delay()
    return estudiosPendientes.map((est) => ({
      ...est,
      persona: personas.find((p) => p.id === est.persona_id),
    }))
  },
}
