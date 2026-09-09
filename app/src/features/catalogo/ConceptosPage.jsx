import { useEffect, useState } from "react"
import { Plus, X, AlertTriangle, DollarSign, Search, ArrowRight } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { conceptosService } from "./services/conceptosService"

/* ---------------------------------------------------------------------
   Conceptos facturables — RF14.

   Acá se decide qué se cobra y cuánto. Sólo el Administrador: recepción
   define qué estudios existen, el precio es otra decisión.

   La pantalla está armada alrededor del problema real, no de la tabla:
   hoy hay estudios que se piden, se cargan y se imprimen, y no se
   facturan, porque no están en ningún concepto. Por eso lo primero que
   se ve es esa lista, y desde ahí se asignan.

   El aviso al agregar no es un detalle. calcular_presupuesto cobra un
   concepto SÓLO si la orden tiene todos sus estudios, así que sumarle
   uno lo vuelve más difícil de cobrar, no más caro. Al «Básico de ley»
   eso le pega a todas las órdenes.
   --------------------------------------------------------------------- */

const VACIO = { nombre: "", precio: "" }
const pesos = (n) => "$ " + Number(n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })

export default function ConceptosPage() {
  const [conceptos, setConceptos] = useState([])
  const [sel, setSel] = useState(null)
  const [cubiertos, setCubiertos] = useState([])
  const [huerfanos, setHuerfanos] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState([])
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  async function recargar() {
    try {
      const [cs, hs] = await Promise.all([
        conceptosService.getConceptos(),
        conceptosService.getSinConcepto(),
      ])
      setConceptos(cs)
      setHuerfanos(hs)
      setSel((s) => s ?? cs[0]?.id ?? null)
      setError(null)
    } catch (e) { setError(e.message) }
  }

  async function recargarCubiertos() {
    if (!sel) return
    try { setCubiertos(await conceptosService.getEstudiosDelConcepto(sel)) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { recargar() }, [])
  useEffect(() => { recargarCubiertos() }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const r = await conceptosService.buscarEstudios(busqueda)
        if (vigente) setResultados(r)
      } catch (e) { if (vigente) setError(e.message) }
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  const conceptoActual = conceptos.find((c) => c.id === sel)
  const yaEstan = new Set(cubiertos.map((e) => e.id))

  async function agregar(estudio) {
    setError(null); setAviso(null)
    try {
      await conceptosService.agregarEstudio(sel, estudio.id)
      setAviso(
        `${estudio.nombre} entró en «${conceptoActual.nombre}». ` +
        `Ojo: ahora una orden tiene que incluirlo para que ese concepto se cobre.`
      )
      await Promise.all([recargarCubiertos(), recargar()])
    } catch (e) { setError(e.message) }
  }

  async function quitar(estudio) {
    setError(null); setAviso(null)
    try {
      await conceptosService.quitarEstudio(sel, estudio.id)
      await Promise.all([recargarCubiertos(), recargar()])
    } catch (e) { setError(e.message) }
  }

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    try {
      const g = await conceptosService.guardarConcepto(editando)
      setEditando(null)
      await recargar()
      setSel(g.id)
    } catch (err) { setError(err.message) }
  }

  return (
    <AppShell titulo="Conceptos facturables" subtitulo="Qué se cobra, y qué estudios cubre cada uno">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-md border-2 border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          {aviso}
        </div>
      )}

      {/* El problema, primero */}
      {huerfanos.length > 0 && (
        <div className="mb-5 rounded-card border-2 border-warning/30 bg-warning/5 p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-warning">
            <DollarSign size={15} />
            {huerfanos.length} estudios no se cobran
          </p>
          <p className="mb-3 text-xs text-warning/90">
            Se piden en la orden, salen en la hoja de ruta y el profesional los
            carga — y suman $0. Elegí un concepto a la izquierda y tocá uno para
            engancharlo.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {huerfanos.map((e) => (
              <li key={e.id}>
                <button
                  disabled={!sel}
                  onClick={() => agregar(e)}
                  title={sel ? `Agregar a ${conceptoActual?.nombre}` : "Elegí un concepto primero"}
                  className="flex items-center gap-1.5 rounded-md border-2 border-warning/30 bg-white px-2.5 py-1 text-xs text-ink hover:border-primary/50 hover:text-primary disabled:opacity-50"
                >
                  {e.nombre}
                  <span className="text-[10px] text-ink-soft">{e.categoria?.nombre}</span>
                  <ArrowRight size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Conceptos */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Conceptos</p>
            <button
              onClick={() => setEditando({ ...VACIO })}
              title="Nuevo concepto"
              className="rounded-md border-2 border-ink-soft/15 p-1 text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              <Plus size={14} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {conceptos.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSel(c.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    sel === c.id ? "bg-primary/5 text-primary" : "text-ink hover:bg-ink-soft/5"
                  } ${c.activo ? "" : "opacity-50"}`}
                >
                  <span className="block">{c.nombre}</span>
                  <span className="block text-[11px] text-ink-soft">
                    {pesos(c.precio)} · {c.cantidad} estudios
                    {!c.activo && " · inactivo"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Estudios que cubre */}
        <div className="col-span-2 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{conceptoActual?.nombre ?? "—"}</p>
            {conceptoActual && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink">{pesos(conceptoActual.precio)}</span>
                <button
                  onClick={() => setEditando({ ...conceptoActual })}
                  className="rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                >
                  Editar
                </button>
                <button
                  onClick={async () => {
                    setError(null)
                    try {
                      await conceptosService.cambiarActivo(conceptoActual.id, !conceptoActual.activo)
                      await recargar()
                    } catch (e) { setError(e.message) }
                  }}
                  className="rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
                >
                  {conceptoActual.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            )}
          </div>
          <p className="mb-4 text-[11px] text-ink-soft">
            Se cobra sólo si la orden tiene <b>todos</b> estos estudios. Sumarle uno
            lo vuelve más difícil de cobrar, no más caro.
          </p>

          {cubiertos.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-soft">
              Este concepto no cubre ningún estudio: nunca se va a cobrar.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {cubiertos.map((e) => (
                <li key={e.id}>
                  <span className={`flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-2.5 py-1 text-xs ${e.activo ? "text-ink" : "text-ink-soft line-through"}`}>
                    {e.nombre}
                    <button
                      onClick={() => quitar(e)}
                      title="Sacar del concepto"
                      className="text-ink-soft hover:text-danger"
                    >
                      <X size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Buscador */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Agregar estudio</p>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código o nombre"
              className="w-full rounded-md border-2 border-ink-soft/20 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          {busqueda.trim().length < 2 ? (
            <p className="text-xs text-ink-soft">Escribí al menos dos letras.</p>
          ) : resultados.length === 0 ? (
            <p className="text-xs text-ink-soft">Ninguno coincide.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {resultados.map((e) => {
                const puesto = yaEstan.has(e.id)
                return (
                  <li key={e.id}>
                    <button
                      disabled={puesto || !sel}
                      onClick={() => agregar(e)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {puesto
                        ? <span className="mt-0.5 text-[10px] text-ink-soft">ya está</span>
                        : <Plus size={13} className="mt-0.5 shrink-0 text-primary" />}
                      <span>
                        <span className="text-ink">{e.nombre}</span>
                        <span className="block text-ink-soft">{e.categoria?.nombre}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4">
          <form onSubmit={guardar} className="w-full max-w-md rounded-card border-2 border-ink-soft/15 bg-white p-5 shadow-lg">
            <p className="mb-4 text-sm font-medium text-ink">
              {editando.id ? "Editar concepto" : "Nuevo concepto"}
            </p>
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Nombre <span className="text-danger">*</span></label>
                <input
                  autoFocus
                  value={editando.nombre ?? ""}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Precio</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editando.precio ?? ""}
                  onChange={(e) => setEditando({ ...editando, precio: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-ink-soft">
                  Cambiarlo no toca las órdenes ya emitidas: el importe se congela
                  al crearlas (CP-10).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!editando.nombre?.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
              >
                Guardar
              </button>
              <button type="button" onClick={() => setEditando(null)}
                className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  )
}
