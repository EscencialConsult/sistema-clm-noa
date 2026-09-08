import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import * as Icons from "lucide-react"
import { Bell, LogOut, Search, PanelLeftClose, PanelLeftOpen, User, UserCog } from "lucide-react"
import { authService } from "../features/auth/services/authService"
import { navegacionPorRol } from "../routes/rutasPorRol"
import logoCompleto from "../assets/logo/2.webp"
import logoIsotipo from "../assets/logo/5.webp"

function IconoDeNav({ nombre, ...props }) {
  const Componente = Icons[nombre] ?? Icons.Circle
  return <Componente {...props} />
}

export default function AppShell({ children, titulo, subtitulo }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sesion, setSesion] = useState(() => authService.getSesionActual())
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem("kaplan_sidebar_colapsado") === "1"
  )
  const [busqueda, setBusqueda] = useState("")
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)

  useEffect(() => {
    if (!sesion) navigate("/", { replace: true })
  }, [sesion, navigate])

  if (!sesion) return null

  const nav = navegacionPorRol[sesion.rol] ?? { etiqueta: "", items: [] }

  function alternarColapso() {
    setColapsado((v) => {
      localStorage.setItem("kaplan_sidebar_colapsado", v ? "0" : "1")
      return !v
    })
  }

  async function handleCerrarSesion() {
    await authService.cerrarSesion()
    setSesion(null)
  }

  const resultadosBusqueda = busqueda
    ? nav.items.filter((i) => i.label.toLowerCase().includes(busqueda.toLowerCase()))
    : []

  const IconoRol = sesion.rol === "administrador" ? UserCog : User

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar — Regla del Sidebar por Rol: mismo componente, items según nav.
          Colapsable: ancho cambia, las etiquetas se ocultan, los íconos quedan
          en el mismo lugar (no se reacomodan). */}
      <aside
        className={`flex shrink-0 flex-col justify-between bg-primary-deep py-6 text-white transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          colapsado ? "w-20 px-3" : "w-64 px-5"
        }`}
      >
        <div>
          <Link to={nav.home} className="mb-8 flex items-center justify-center">
            <img
              src={colapsado ? logoIsotipo : logoCompleto}
              alt="Centro Médico Laboral del NOA"
              className={colapsado ? "h-9" : "h-11"}
            />
          </Link>

          {!colapsado && (
            <p className="mb-3 text-center text-xs font-medium tracking-wide text-white/50">{nav.etiqueta}</p>
          )}
          <nav className="flex flex-col gap-1">
            {nav.items.map((item) => {
              const activo = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={colapsado ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    colapsado ? "justify-center" : ""
                  } ${
                    activo ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <IconoDeNav nombre={item.icon} size={20} strokeWidth={1.75} className="shrink-0" />
                  {!colapsado && item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          {/* Perfil + botón de ocultar en la MISMA fila cuando está expandido
              (no una fila propia arriba de todo). Colapsado: columna
              centrada, avatar arriba, ícono de ocultar debajo — mismo ancho
              (w-full) para que justify-center centre de verdad. */}
          <div className={`mb-3 flex items-center gap-2.5 ${colapsado ? "flex-col" : ""}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent">
              <IconoRol size={22} strokeWidth={1.75} />
            </div>
            {!colapsado && (
              <div className="flex-1 text-sm leading-tight">
                <p className="font-medium">{sesion.nombre_completo}</p>
                <p className="text-xs text-white/50">{sesion.especialidad ?? sesion.rol}</p>
              </div>
            )}
            <button
              onClick={alternarColapso}
              title={colapsado ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              className={`flex items-center justify-center gap-2 rounded-md border border-white/15 py-1.5 text-xs text-white/60 hover:border-white/40 hover:text-white ${
                colapsado ? "w-full" : "shrink-0 px-2"
              }`}
            >
              {colapsado ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              {!colapsado && "Ocultar"}
            </button>
          </div>

          <button
            onClick={handleCerrarSesion}
            title={colapsado ? "Cerrar sesión" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm text-white/60 hover:text-white ${
              colapsado ? "justify-center" : ""
            }`}
          >
            <LogOut size={16} strokeWidth={1.75} />
            {!colapsado && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1">
        <header className="flex items-center gap-6 border-b border-ink-soft/15 px-8 py-5">
          <div className="shrink-0">
            <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
            {subtitulo && <p className="text-sm text-ink-soft">{subtitulo}</p>}
          </div>

          {/* Buscador — filtra las opciones del sidebar del rol actual */}
          <div className="relative mx-auto w-full max-w-md">
            <label className="flex items-center gap-2 rounded-md border border-ink-soft/20 bg-ink-soft/5 px-3.5 py-2.5 focus-within:border-primary">
              <Search size={17} className="text-ink-soft" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Buscar una opción del menú…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onFocus={() => setBuscadorAbierto(true)}
                onBlur={() => setTimeout(() => setBuscadorAbierto(false), 150)}
              />
            </label>
            {buscadorAbierto && busqueda && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-md border border-ink-soft/15 bg-white shadow-lg">
                {resultadosBusqueda.length === 0 ? (
                  <p className="px-3.5 py-3 text-sm text-ink-soft">Sin resultados para "{busqueda}"</p>
                ) : (
                  resultadosBusqueda.map((r) => (
                    <button
                      key={r.to}
                      onMouseDown={() => {
                        navigate(r.to)
                        setBusqueda("")
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-ink-soft/5"
                    >
                      <IconoDeNav nombre={r.icon} size={16} className="text-ink-soft" />
                      {r.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button className="relative shrink-0 rounded-full p-2 hover:bg-ink-soft/10">
            <Bell size={20} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </header>
        <main
          className="p-8"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--color-ink-soft) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
