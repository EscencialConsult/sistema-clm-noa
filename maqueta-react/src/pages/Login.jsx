import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Eye, EyeOff, MapPin, Phone, User, Lock, Info } from "lucide-react"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import { FONDOS_LOGIN } from "../config/fondosLogin"
import SelectorFondoDev from "../components/SelectorFondoDev"
import logoCompleto from "../assets/logo/1.webp"
import logoBlanco from "../assets/logo/2.webp"

export default function Login() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [indiceFondo, setIndiceFondo] = useState(() => {
    const guardado = Number(localStorage.getItem("kaplan_dev_fondo_login"))
    return Number.isInteger(guardado) && guardado < FONDOS_LOGIN.length ? guardado : 0
  })

  function cambiarFondo(indice) {
    setIndiceFondo(indice)
    localStorage.setItem("kaplan_dev_fondo_login", String(indice))
  }

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 md:justify-end md:p-16">
      {/* Fondo — imágenes candidatas mientras no hay foto real de la fachada
          del CML NOA (ver src/config/fondosLogin.js). Ya vienen borrosas de
          origen; se les suma blur + tinte de marca para que no se lean como
          foto de stock genérica y quede coherente con la paleta institucional. */}
      <img
        src={FONDOS_LOGIN[indiceFondo].src}
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
      />
      <div className="absolute inset-0 bg-primary-deep/75 mix-blend-multiply" />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/50" />

      <SelectorFondoDev fondos={FONDOS_LOGIN} indiceActual={indiceFondo} onCambiar={cambiarFondo} />

      {/* Texto institucional — abajo a la izquierda, sobre el fondo */}
      <div className="absolute inset-x-0 bottom-0 z-10 hidden flex-col gap-6 p-12 text-white md:flex">
        <img src={logoBlanco} alt="Centro Médico Laboral del NOA" className="h-12" />
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-snug">
            Cuidamos la salud de las personas que impulsan tu empresa.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Medicina Laboral · Exámenes · Juntas Médicas
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-white/70">
          <span className="flex items-center gap-2">
            <MapPin size={15} /> Av. Avellaneda 338, San Miguel de Tucumán
          </span>
          <span className="flex items-center gap-2">
            <Phone size={15} /> 0381 4221541
          </span>
        </div>
      </div>

      {/* Card — flota sobre el fondo, no ocupa un panel propio */}
      <div className="relative z-10 w-full max-w-sm rounded-card bg-white p-8 shadow-xl">
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

        <p className="mt-6 text-center text-xs text-ink-soft/60">Versión 1.0.0 · Prelaboral</p>
      </div>

      <p className="absolute bottom-4 right-4 z-10 text-xs text-white/40 md:right-16">
        Probar con <code>admin/admin</code> (Administrador) o <code>mlopez/1234</code> (Médico Laboral)
      </p>
    </div>
  )
}
