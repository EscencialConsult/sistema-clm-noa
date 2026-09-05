import alertasPersonales from "../mock/data/alertas_personales.json"
import { delay } from "./delay"

export const alertasService = {
  async getAlertasPersonales() {
    await delay()
    return alertasPersonales
  },
}
