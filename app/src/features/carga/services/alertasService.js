import alertasPersonales from "../../../mock/data/alertas_personales.json"
import { delay } from "../../../lib/delay"

export const alertasService = {
  async getAlertasPersonales() {
    await delay()
    return alertasPersonales
  },
}
