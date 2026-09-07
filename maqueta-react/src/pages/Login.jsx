import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Eye, EyeOff, MapPin, Phone, User, Lock, Info, MoreVertical } from "lucide-react"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import { FONDOS_LOGIN } from "../config/fondosLogin"
import SelectorFondoDev from "../components/SelectorFondoDev"
import AccesosRapidosDev from "../components/AccesosRapidosDev"
import logoCompleto from "../assets/logo/1.webp"

export default function Login() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [devAbierto, setDevAbierto] = useState(false)
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

  async function entrar(usuarioIntento, contrasenaIntento) {
    setError("")
    setCargando(true)
    try {
      const sesion = await authService.login(usuarioIntento, contrasenaIntento)
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

  function handleSubmit(e) {
    e.preventDefault()
    entrar(usuario, contrasena)
  }

  const fondo = FONDOS_LOGIN[indiceFondo]

  return (
    <div className="flex min-h-screen">
      {/* ── Columna izquierda — marca. Ocupa el 40%, nada compite con la
          card del otro lado (modelo Split Screen). ── */}
      <div className="relative hidden w-2/5 flex-col justify-center gap-10 overflow-hidden bg-linear-to-br from-primary-deep to-primary p-14 text-white md:flex">
        {fondo.src && (
          <>
            <img
              src={fondo.src}
              alt=""
              className="fondo-kenburns absolute inset-0 h-full w-full object-cover blur-lg"
            />
            <div className="absolute inset-0 bg-primary-deep/80 mix-blend-multiply" />
          </>
        )}

        <div className="relative z-10 max-w-sm">
          <p className="text-3xl leading-[1.3] font-semibold">
            Cuidamos la salud de las personas que impulsan tu empresa.
          </p>
          <p className="mt-3 text-sm font-light text-white/50">
            Medicina Laboral · Exámenes · Juntas Médicas
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-2.5 text-sm text-white/60">
          <span className="flex items-center gap-2.5">
            <MapPin size={15} className="opacity-90" /> Av. Avellaneda 338, San Miguel de
            Tucumán
          </span>
          <span className="flex items-center gap-2.5">
            <Phone size={15} className="opacity-90" /> 0381 4221541
          </span>
        </div>
      </div>

      {/* ── Columna derecha — acción. Fondo claro, card centrada en los dos
          ejes, sin borde (solo sombra difusa) para que "respire". ── */}
      <div className="relative flex flex-1 items-center justify-center bg-ink-soft/5 p-6">
        {/* Herramientas dev — discretas a propósito, un ícono de tres puntos,
            no controles sueltos compitiendo con la interfaz real. */}
        <button
          type="button"
          onClick={() => setDevAbierto((v) => !v)}
          className="absolute right-4 top-4 z-20 rounded p-1.5 text-ink-soft/30 hover:bg-ink-soft/10 hover:text-ink-soft"
          title="Herramientas de maqueta"
        >
          <MoreVertical size={18} />
        </button>
        {devAbierto && (
          <div className="absolute right-4 top-12 z-20 flex flex-col items-end gap-1.5 rounded-md border border-dashed border-ink-soft/30 bg-white p-2 shadow-lg [&_button]:text-ink-soft [&_button]:border-ink-soft/30">
            <SelectorFondoDev fondos={FONDOS_LOGIN} indiceActual={indiceFondo} onCambiar={cambiarFondo} />
            <AccesosRapidosDev onEntrar={entrar} cargando={cargando} />
          </div>
        )}

        <div
          className="w-full max-w-sm rounded-card bg-white p-12"
          style={{ boxShadow: "0 20px 40px rgba(11,37,69,0.15)" }}
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <img src={logoCompleto} alt="Centro Médico Laboral del NOA" className="mb-5 h-16" />
            <h1 className="text-xl font-semibold text-ink">Bienvenido</h1>
            <p className="text-sm text-ink-soft">Inicie sesión para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 px-3.5 py-3 focus-within:border-primary">
              <User size={18} className="text-ink-soft" />
              <input
                className="w-full text-sm outline-none"
                placeholder="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
              />
            </label>

            <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 px-3.5 py-3 focus-within:border-primary">
              <Lock size={18} className="text-ink-soft" />
              <input
                type={verClave ? "text" : "password"}
                className="w-full text-sm outline-none"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
              <button type="button" onClick={() => setVerClave((v) => !v)}>
                {verClave ? (
                  <EyeOff size={18} className="text-ink-soft" />
                ) : (
                  <Eye size={18} className="text-ink-soft" />
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
              className="rounded-md bg-primary py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
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
      </div>
    </div>
  )
}
