import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Eye, EyeOff, MapPin, Phone, User, Lock, Info } from "lucide-react"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import logoCompleto from "../assets/logo/1.webp"
import logoBlanco from "../assets/logo/2.webp"

export default function Login() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)

  const sesionActual = authService.getSesionActual()
  if (sesionActual) {
    const destino = navegacionPorRol[sesionActual.rol]?.home ?? "/admin"
    return <Navigate to={destino} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setCargando(true)
    try {
      const sesion = await authService.login(usuario, contrasena)
      if (sesion.debe_cambiar_contrasena) {
        navigate("/cambiar-contrasena")
        return
      }
      const destino = navegacionPorRol[sesion.rol]?.home ?? "/admin"
      navigate(destino)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo — institucional */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-primary-deep p-12 text-white md:flex">
        <div className="absolute inset-0 bg-primary-deep/70 mix-blend-multiply" />
        <div className="relative z-10">
          <img src={logoBlanco} alt="Centro Médico Laboral del NOA" className="h-14" />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-3xl font-semibold leading-snug">
            Cuidamos la salud de las personas que impulsan tu empresa.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Medicina Laboral · Exámenes · Juntas Médicas
          </p>
        </div>
        <div className="relative z-10 flex flex-col gap-2 text-sm text-white/70">
          <span className="flex items-center gap-2">
            <MapPin size={15} /> Av. Avellaneda 338, San Miguel de Tucumán
          </span>
          <span className="flex items-center gap-2">
            <Phone size={15} /> 0381 4221541
          </span>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex w-full flex-col items-center justify-center bg-ink-soft/5 p-8 md:w-1/2">
        <div className="w-full max-w-sm rounded-card border border-ink-soft/10 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <img src={logoCompleto} alt="Centro Médico Laboral del NOA" className="mb-4 h-16" />
            <h1 className="text-lg font-semibold text-ink">Bienvenido</h1>
            <p className="text-sm text-ink-soft">Inicie sesión para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 px-3 py-2.5 focus-within:border-primary">
              <User size={17} className="text-ink-soft" />
              <input
                className="w-full text-sm outline-none"
                placeholder="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
              />
            </label>

            <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 px-3 py-2.5 focus-within:border-primary">
              <Lock size={17} className="text-ink-soft" />
              <input
                type={verClave ? "text" : "password"}
                className="w-full text-sm outline-none"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
              <button type="button" onClick={() => setVerClave((v) => !v)}>
                {verClave ? (
                  <EyeOff size={17} className="text-ink-soft" />
                ) : (
                  <Eye size={17} className="text-ink-soft" />
                )}
              </button>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex items-center justify-between text-sm text-ink-soft">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-primary" /> Recordarme
              </label>
              <button type="button" className="text-primary hover:underline">
                ¿Olvidó su contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="rounded-md bg-primary py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {cargando ? "Ingresando…" : "Ingresar"}
            </button>

            {/* RF01: el primer ingreso obliga a cambiar la contraseña */}
            <div className="flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs text-ink-soft">
              <Info size={15} className="mt-0.5 shrink-0 text-primary" />
              Por su seguridad, deberá cambiar su contraseña en su primer inicio de sesión.
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-ink-soft/60">
            Versión 1.0.0 · Prelaboral
          </p>
        </div>

        <p className="mt-4 text-xs text-ink-soft/50">
          Probar con <code>admin/admin</code> (Administrador) o <code>mlopez/1234</code> (Médico Laboral)
        </p>
      </div>
    </div>
  )
}
