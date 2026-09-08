import usuarios from "../../../mock/data/usuarios.json"
import { delay } from "../../../lib/delay"

const CLAVE_SESION = "kaplan_sesion"

// Mismo objeto exportado, misma firma de función para cada método:
// el día que exista backend real (Node/Express), acá se reemplaza el
// CUERPO de cada función por un fetch/axios a la API, sin tocar
// ningún componente que ya consuma authService.
export const authService = {
  async login(usuario, contrasena) {
    await delay()
    const encontrado = usuarios.find(
      (u) => u.usuario === usuario && u.contrasena === contrasena
    )
    if (!encontrado) {
      throw new Error("Usuario o contraseña incorrectos.")
    }
    const sesion = { ...encontrado }
    delete sesion.contrasena
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return sesion
  },

  async cerrarSesion() {
    await delay(100)
    localStorage.removeItem(CLAVE_SESION)
  },

  getSesionActual() {
    const guardado = localStorage.getItem(CLAVE_SESION)
    return guardado ? JSON.parse(guardado) : null
  },

  async cambiarContrasena(_nuevaContrasena) {
    await delay()
    const sesion = authService.getSesionActual()
    if (!sesion) return null
    sesion.debe_cambiar_contrasena = false
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return sesion
  },
}
