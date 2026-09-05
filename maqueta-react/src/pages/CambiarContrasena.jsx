import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import logoCompleto from "../assets/logo/1.webp"

export default function CambiarContrasena() {
  const navigate = useNavigate()
  const [clave, setClave] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (clave.length < 4) return setError("La contraseña debe tener al menos 4 caracteres.")
    if (clave !== confirmar) return setError("Las contraseñas no coinciden.")
    const sesion = await authService.cambiarContrasena(clave)
    const destino = navegacionPorRol[sesion.rol]?.home ?? "/admin"
    navigate(destino)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-soft/5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-ink-soft/10 bg-white p-8 shadow-sm"
      >
        <img src={logoCompleto} alt="" className="mx-auto mb-4 h-14" />
        <h1 className="text-center text-lg font-semibold text-ink">Cambiar contraseña</h1>
        <p className="mb-6 text-center text-sm text-ink-soft">
          Es tu primer inicio de sesión — definí una contraseña nueva.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Contraseña nueva"
            className="rounded-md border border-ink-soft/20 px-3 py-2.5 text-sm outline-none focus:border-primary"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            className="rounded-md border border-ink-soft/20 px-3 py-2.5 text-sm outline-none focus:border-primary"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            className="rounded-md bg-primary py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Guardar y continuar
          </button>
        </div>
      </form>
    </div>
  )
}
