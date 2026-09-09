import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, Plus, X, AlertTriangle, Lock } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { nuevaOrdenService } from "./services/nuevaOrdenService"
import { ETIQUETA_ESTADO, ESTILO_ESTADO } from "../../types/dominio"

/* ---------------------------------------------------------------------
   Agregar y quitar estudios de una orden — RF11 regla (c).

   «Se pueden agregar o quitar estudios tipeando el código o tildando.»
   La batería es un punto de partida, no una jaula: la empresa pide uno
   más, o esta vez no corresponde alguno.

   Las políticas de la base ya lo permitían desde la migración 008, pero
   no había ninguna pantalla que las usara: se elegía la batería y se
   quedaba con lo que trajera.

   Qué NO decide esta pantalla:

   · Si se puede tocar. La orden informada queda bloqueada y un estudio
     ya cargado no se puede quitar — se corrige. Borrarlo se llevaría el
     resultado sin dejar rastro de que existió. Eso lo rechaza la base;
     acá sólo se muestra el motivo.

   · Cuánto sale. Después de cada cambio se le vuelve a preguntar el
     importe a calcular_presupuesto y se guarda. Si no, la orden quedaría
     diciendo un precio que ya no corresponde.
   --------------------------------------------------------------------- */

export default function AjustarEstudiosPage() {
  const { ordenId } = useParams()
  const navigate = useNavigate()

  const [orden, setOrden] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    try {
      const [o, cats] = await Promise.all([
        nuevaOrdenService.getOrdenCreada(ordenId),
        nuevaOrdenService.getEstudiosDeOrden(ordenId),
      ])
      setOrden(o)
      setCategorias(cats)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId])

  useEffect(() => {
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const r = await nuevaOrdenService.buscarEstudios(busqueda)
        if (vigente) setResultados(r)
      } catch (e) {
        if (vigente) setError(e.message)
      }
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  const yaEstan = new Set(categorias.flatMap((c) => c.items.map((i) => i.estudio.id)))

  async function agregar(estudio) {
    setError(null)
    setAviso(null)
    try {
      await nuevaOrdenService.agregarEstudio(ordenId, estudio)
      const nuevo = await nuevaOrdenService.recalcularImporte(ordenId)
      setAviso(`Se agregó ${estudio.nombre}. La orden queda en $ ${Number(nuevo).toLocaleString("es-AR")}.`)
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  async function quitar(item) {
    setError(null)
    setAviso(null)
    try {
      await nuevaOrdenService.quitarEstudio(item.id)
      const nuevo = await nuevaOrdenService.recalcularImporte(ordenId)
      setAviso(`Se quitó ${item.estudio.nombre}. La orden queda en $ ${Number(nuevo).toLocaleString("es-AR")}.`)
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  if (cargando && !orden) {
    return <AppShell titulo="Cargando…"><p className="text-sm text-ink-soft">Trayendo la orden…</p></AppShell>
  }
  if (!orden) {
    return (
      <AppShell titulo="Orden">
        <div className="rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          No se pudo abrir la orden: {error}
        </div>
      </AppShell>
    )
  }

  const p = orden.persona ?? {}
  const total = categorias.reduce((s, c) => s + c.items.length, 0)

  return (
    <AppShell
      titulo={`Estudios de la orden N° ${orden.numero}`}
      subtitulo={`${p.apellido}, ${p.nombre} · ${orden.empresa?.razon_social ?? ""}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTILO_ESTADO[orden.estado] ?? ""}`}>
          {ETIQUETA_ESTADO[orden.estado] ?? orden.estado}
        </span>
        <span className="text-xs text-ink-soft">{total} estudios</span>
        <span className="ml-auto text-sm text-ink">
          $ {Number(orden.importe ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-md border-2 border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Lo que tiene */}
        <div className="col-span-2 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <p className="mb-4 text-sm font-medium text-ink">En la orden</p>
          {categorias.map((c) => (
            <div key={c.id} className="mb-4 last:mb-0">
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-ink-soft">
                {c.nombre}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {c.items.map((i) => {
                  const bloqueado = i.estado !== "PENDIENTE"
                  return (
                    <li key={i.id}>
                      <span
                        className={`flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-xs ${
                          bloqueado
                            ? "border-ink-soft/10 bg-ink-soft/5 text-ink-soft"
                            : "border-ink-soft/15 text-ink"
                        }`}
                      >
                        {i.estudio.nombre}
                        {bloqueado ? (
                          <Lock size={12} className="text-ink-soft" title="Ya tiene resultado: se corrige, no se quita" />
                        ) : (
                          <button
                            onClick={() => quitar(i)}
                            title="Quitar de la orden"
                            className="text-ink-soft hover:text-danger"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-xs text-ink-soft">
            Los que tienen candado ya tienen resultado cargado. No se quitan: se
            corrigen desde la pantalla de carga. Quitarlos se llevaría el
            resultado sin dejar rastro.
          </p>
        </div>

        {/* Agregar */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Agregar</p>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código o nombre"
              className="w-full rounded-md border-2 border-ink-soft/20 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {busqueda.trim().length < 2 ? (
            <p className="text-xs text-ink-soft">
              Escribí al menos dos letras, o el código del estudio.
            </p>
          ) : resultados.length === 0 ? (
            <p className="text-xs text-ink-soft">Ningún estudio coincide.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {resultados.map((e) => {
                const puesto = yaEstan.has(e.id)
                return (
                  <li key={e.id}>
                    <button
                      disabled={puesto}
                      onClick={() => agregar(e)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {puesto ? (
                        <span className="mt-0.5 text-[10px] text-ink-soft">ya está</span>
                      ) : (
                        <Plus size={13} className="mt-0.5 shrink-0 text-primary" />
                      )}
                      <span>
                        <span className="text-ink">{e.nombre}</span>
                        <span className="block text-ink-soft">
                          {e.codigo ? `${e.codigo} · ` : ""}{e.categoria?.nombre}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-ink-soft">
            El importe se recalcula solo después de cada cambio. Si el estudio
            no está en ningún concepto facturable, se suma a la orden pero no
            al precio.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
