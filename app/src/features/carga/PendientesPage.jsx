import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, RefreshCw, Search } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { supabase } from "../../lib/supabase"
import { authService } from "../auth/services/authService"
import { ETIQUETA_ROL } from "../../types/dominio"

/* ---------------------------------------------------------------------
   Estudios pendientes — RF16, RF19.

   La pregunta que se hace la bioquímica veinte veces por día: qué me
   falta cargar a mí. La bandeja muestra ÓRDENES; esto muestra ESTUDIOS,
   que es la unidad con la que ella trabaja.

   Arranca filtrado por el área de quien mira, porque es lo que va a
   querer el 95% de las veces. Recepción y el Administrador pueden sacar
   el filtro y ver todo — para eso está el selector.

   Ese filtro es de comodidad, no de seguridad: la vista corre con los
   permisos de quien consulta (security_invoker) y RLS decide qué filas
   existen. Sacar el filtro no muestra nada que no se pudiera ver.

   Cada fila abre la orden en la pantalla de carga. Eso es lo que hace la
   diferencia entre una lista y una herramienta.
   --------------------------------------------------------------------- */

export default function PendientesPage() {
  const navigate = useNavigate()
  const sesion = authService.getSesionActual()
  const misRoles = useMemo(() => sesion?.roles ?? [], [sesion])

  const [filas, setFilas] = useState([])
  const [soloMiArea, setSoloMiArea] = useState(true)
  const [texto, setTexto] = useState("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function recargar() {
    setCargando(true)
    try {
      const { data, error: e } = await supabase
        .from("v_pendientes")
        .select("numero, fecha, paciente, empresa, categoria, estudio, rol_responsable, orden_id, estudio_id")
        .order("fecha", { ascending: true })
        .order("numero", { ascending: true })
      if (e) throw new Error(e.message)
      setFilas(data ?? [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { recargar() }, [])

  const t = texto.trim().toLowerCase()
  const visibles = filas.filter((f) => {
    if (soloMiArea && !misRoles.includes(f.rol_responsable)) return false
    if (!t) return true
    return (
      f.paciente?.toLowerCase().includes(t) ||
      f.empresa?.toLowerCase().includes(t) ||
      f.estudio?.toLowerCase().includes(t) ||
      String(f.numero).includes(t)
    )
  })

  /* Agrupado por orden: la bioquímica no carga un estudio suelto, carga
     todo lo que le falta de un paciente que está sentado enfrente. */
  const porOrden = useMemo(() => {
    const m = new Map()
    for (const f of visibles) {
      if (!m.has(f.orden_id)) {
        m.set(f.orden_id, { orden_id: f.orden_id, numero: f.numero, fecha: f.fecha,
                            paciente: f.paciente, empresa: f.empresa, estudios: [] })
      }
      m.get(f.orden_id).estudios.push(f)
    }
    return [...m.values()]
  }, [visibles])

  const misAreas = misRoles.map((r) => ETIQUETA_ROL[r] ?? r).join(", ")

  return (
    <AppShell titulo="Estudios pendientes" subtitulo="Lo que falta cargar">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Paciente, empresa, estudio o N°"
            className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-1 rounded-md border-2 border-ink-soft/15 p-0.5">
          <button
            onClick={() => setSoloMiArea(true)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              soloMiArea ? "bg-primary/10 text-primary" : "text-ink-soft hover:text-ink"
            }`}
          >
            Mi área
          </button>
          <button
            onClick={() => setSoloMiArea(false)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              !soloMiArea ? "bg-primary/10 text-primary" : "text-ink-soft hover:text-ink"
            }`}
          >
            Todas
          </button>
        </div>

        <button
          onClick={recargar}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <RefreshCw size={14} /> Actualizar
        </button>

        <span className="ml-auto text-xs text-ink-soft">
          {visibles.length} {visibles.length === 1 ? "estudio" : "estudios"} en{" "}
          {porOrden.length} {porOrden.length === 1 ? "orden" : "órdenes"}
          {soloMiArea && misAreas && ` · ${misAreas}`}
        </span>
      </div>

      {!cargando && porOrden.length === 0 && (
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-8 text-center">
          <p className="text-sm text-ink">No queda nada pendiente.</p>
          <p className="mt-1 text-xs text-ink-soft">
            {soloMiArea
              ? "De tu área no falta cargar ningún estudio. Probá con «Todas» para ver el resto."
              : "Ninguna orden abierta tiene estudios sin cargar."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {porOrden.map((o) => (
          <button
            key={o.orden_id}
            onClick={() => navigate(`/carga/${o.orden_id}`)}
            className="rounded-card border-2 border-ink-soft/15 bg-white p-5 text-left transition-colors hover:border-primary/40"
          >
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-sm font-medium text-ink">{o.paciente}</span>
              <span className="text-xs text-ink-soft">
                N° {o.numero} · {o.empresa} · {o.fecha}
              </span>
              <span className="ml-auto text-xs text-ink-soft">
                {o.estudios.length} {o.estudios.length === 1 ? "pendiente" : "pendientes"}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {o.estudios.map((e) => (
                <li key={`${e.orden_id}-${e.estudio_id}`}>
                  <span className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-2.5 py-1 text-xs text-ink">
                    {e.estudio}
                    <span className="text-[10px] text-ink-soft">{e.categoria}</span>
                  </span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </AppShell>
  )
}
