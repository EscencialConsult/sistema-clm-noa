import dashboardAdmin from "../mock/data/dashboard_admin.json"
import { delay } from "./delay"

export const dashboardService = {
  async getResumenAdministrador() {
    await delay()
    return dashboardAdmin
  },
}
