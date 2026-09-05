import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import * as Icons from "lucide-react"
import { Bell, LogOut } from "lucide-react"
import { authService } from "../services/authService"
import { navegacionPorRol } from "../config/navegacionPorRol"
import logoBlanco from "../assets/logo/2.webp"

function IconoDeNav({ nombre, ...props }) {
  const Componente = Icons[nombre] ?? Icons.Circle
  return <Componente {...props} />
}

export default function AppShell({ children, titulo, subtitulo }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sesion, setSesion] = useState(() => authService.getSesionActual())

  useEffect(() => {
    if (!sesion) navigate("/", { replace: true })
  }, [sesion, navigate])

  if (!sesion) return null

  const nav = navegacionPorRol[sesion.rol] ?? { etiqueta: "", items: [] }

  async function handleCerrarSesion() {
    await authService.cerrarSesion()
    setSesion(null)
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar — Regla del Sidebar por Rol: mismo componente, items según nav */}
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-primary-deep px-5 py-6 text-white">
        <div>
          <Link to={nav.home} className="mb-8 flex items-center gap-2">
            <img src={logoBlanco} alt="Centro Médico Laboral del NOA" className="h-10" />
          </Link>

          <p className="mb-3 text-xs font-medium tracking-wide text-white/50">
            {nav.etiqueta}
          </p>
          <nav className="flex flex-col gap-1">
            {nav.items.map((item) => {
              const activo = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    activo
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <IconoDeNav nombre={item.icon} size={17} strokeWidth={1.75} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {sesion.avatar_iniciales}
            </div>
            <div className="text-sm leading-tight">
              <p className="font-medium">{sesion.nombre_completo}</p>
              <p className="text-xs text-white/50">
                {sesion.especialidad ?? sesion.rol}
              </p>
            </div>
          </div>
          <button
            onClick={handleCerrarSesion}
            className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm text-white/60 hover:text-white"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-ink-soft/15 px-8 py-5">
          <div>
            <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
            {subtitulo && <p className="text-sm text-ink-soft">{subtitulo}</p>}
          </div>
          <button className="relative rounded-full p-2 hover:bg-ink-soft/10">
            <Bell size={20} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
