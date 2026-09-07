import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Eye, EyeOff, MapPin, Phone, User, Lock, Info } from "lucide-react"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import { FONDOS_LOGIN } from "../config/fondosLogin"
import SelectorFondoDev from "../components/SelectorFondoDev"
import AccesosRapidosDev from "../components/AccesosRapidosDev"
import FondoAnimado from "../components/FondoAnimado"
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 md:justify-end md:p-16">
      {/* Fondo — gradiente animado de marca por defecto (WebGL, lento y sutil,
          ver FondoAnimado.jsx) o, si se elige desde el panel dev, una de las
          fotos candidatas mientras no hay foto real de la fachada. */}
      {fondo.animado ? (
        <FondoAnimado className="absolute inset-0 h-full w-full bg-primary-deep" />
      ) : (
        <>
          <img
            src={fondo.src}
            alt=""
            className="fondo-kenburns absolute inset-0 h-full w-full object-cover blur-lg"
          />
          <div className="absolute inset-0 bg-primary-deep/88 mix-blend-multiply" />
          <div className="absolute inset-0 bg-primary-deep/35" />
        </>
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-black/20" />

      {/* Panel de herramientas dev — todo junto, un solo bloque */}
      <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-1.5">
        <SelectorFondoDev fondos={FONDOS_LOGIN} indiceActual={indiceFondo} onCambiar={cambiarFondo} />
        <AccesosRapidosDev onEntrar={entrar} cargando={cargando} />
      </div>

      {/* Logo — arriba a la izquierda, cambia de color al pasar el mouse
          (mask-image: el logo es monocromático, el color sale de un token
          real, no de un asset nuevo por variante). */}
      <div
        role="img"
        aria-label="Centro Médico Laboral del NOA"
        className="absolute left-8 top-8 z-10 hidden aspect-2/1 h-24 bg-white transition-colors duration-200 ease-[ease] hover:bg-accent md:block"
        style={{
          WebkitMaskImage: `url(${logoBlanco})`,
          maskImage: `url(${logoBlanco})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "left center",
          maskPosition: "left center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />

      {/* Texto institucional — un solo renglón, abajo a la izquierda */}
      <div className="absolute bottom-10 left-8 z-10 hidden flex-col gap-6 text-white md:flex">
        <div>
          <p className="whitespace-nowrap text-2xl leading-none font-semibold">
            Cuidamos la salud de las personas que impulsan tu empresa.
          </p>
          <p className="mt-3 text-sm font-light text-white/50">
            Medicina Laboral · Exámenes · Juntas Médicas
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-white/60">
          <span className="flex items-center gap-2.5">
            <MapPin size={15} className="opacity-90" /> Av. Avellaneda 338, San Miguel de Tucumán
          </span>
          <span className="flex items-center gap-2.5">
            <Phone size={15} className="opacity-90" /> 0381 4221541
          </span>
        </div>
      </div>

      {/* Card — semi-transparente sobre el fondo (frosted), no un bloque blanco opaco */}
      <div
        className="relative z-10 w-full max-w-md rounded-card bg-white/85 p-10 backdrop-blur-md"
        style={{ boxShadow: "0 20px 40px rgba(11,37,69,0.25)" }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={logoCompleto} alt="Centro Médico Laboral del NOA" className="mb-5 h-16" />
          <h1 className="text-xl font-semibold text-ink">Bienvenido</h1>
          <p className="text-sm text-ink-soft">Inicie sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 bg-white/60 px-3.5 py-3 focus-within:border-primary">
            <User size={18} className="text-ink-soft" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 bg-white/60 px-3.5 py-3 focus-within:border-primary">
            <Lock size={18} className="text-ink-soft" />
            <input
              type={verClave ? "text" : "password"}
              className="w-full bg-transparent text-sm outline-none"
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
  )
}
