import { useEffect, useState } from "react"
import { Plus, X, AlertTriangle, Search, ArrowRight, Pencil, Ban, BarChart3, ChevronUp, ChevronDown, Power } from "lucide-react"
import Paginador, { paginar } from "../../shared/Paginador"
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
  /* Filtra la lista de conceptos. Con 33 y casi todos de un estudio,
     encontrar «Audiometría» era scrollear. */
  const [filtro, setFiltro] = useState("")
  /* Qué muestra la columna de la derecha: los estudios del concepto
     elegido, o los que no cobra nadie. Antes los segundos vivían arriba
     de todo como 28 chips sueltos. */
  /* Qué lista se ve a la izquierda. Las dos que no son «conceptos» son
     los dos problemas: estudios que nadie cobra, y conceptos que no se
     pueden cobrar. Puestos como pestañas dejan de ser un cartel y pasan
     a ser un lugar donde se trabaja. */
  const [pestana, setPestana] = useState("conceptos")
  const [orden, setOrden] = useState({ campo: "nombre", asc: true })
  const [soloEstado, setSoloEstado] = useState("")
  const [pagina, setPagina] = useState(1)
  /* Cuántas órdenes del último mes cobraron cada concepto. Lo calcula la
     base: ver el comentario de getUso(). */
  const [uso, setUso] = useState({})
  const [resultados, setResultados] = useState([])
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  async function recargar() {
    try {
      const [cs, hs, us] = await Promise.all([
        conceptosService.getConceptos(),
        conceptosService.getSinConcepto(),
        conceptosService.getUso(),
      ])
      setConceptos(cs)
      setHuerfanos(hs)
      setUso(us)
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

  /* Al asignar el último huérfano su pestaña desaparece, y sin esto
     quedaba elegida una que ya no existe: la lista se veía vacía justo
     después de terminar el trabajo. */
  useEffect(() => {
    if (pestana === "huerfanos" && huerfanos.length === 0) setPestana("conceptos")
  }, [pestana, huerfanos])

  /* Filtrar o reordenar desde la página 3 dejaba la tabla vacía. */
  useEffect(() => { setPagina(1) }, [pestana, filtro, soloEstado, orden])
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

  /* Los que tienen precio y ningún estudio no se van a cobrar nunca. Es
     un error de carga, no una decisión: conviene que se vea sin entrar
     de a uno. */
  const rotos = conceptos.filter((c) => c.activo && Number(c.cantidad) === 0)

  const listaFiltrada = conceptos
    .filter((c) =>
      (!filtro.trim() || c.nombre.toLowerCase().includes(filtro.trim().toLowerCase())) &&
      (!soloEstado || (soloEstado === "activo" ? c.activo : !c.activo))
    )
    .sort((a, b) => {
      const s = orden.asc ? 1 : -1
      if (orden.campo === "precio") return s * (Number(a.precio) - Number(b.precio))
      if (orden.campo === "estudios") return s * (Number(a.cantidad) - Number(b.cantidad))
      if (orden.campo === "uso") return s * ((uso[a.id] ?? 0) - (uso[b.id] ?? 0))
      return s * a.nombre.localeCompare(b.nombre, "es")
    })

  const hoja = paginar(listaFiltrada, pagina)

  /* Un estudio inactivo adentro del concepto lo vuelve incobrable: la
     orden nunca lo va a incluir. Es el mismo problema que un concepto sin
     estudios, pero escondido adentro. */
  const inactivosDentro = cubiertos.filter((e) => !e.activo)

  function ordenarPor(campo) {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }))
  }
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

      {/* Los dos problemas, arriba de todo y con su número.

          Son los únicos errores del sistema que no se ven en ningún otro
          lado: la orden se crea, el papel sale, el profesional carga — y
          se factura de menos. El total en pesos es lo que hace que
          alguien los arregle; una lista sola no. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {huerfanos.length > 0 && (
          <button
            onClick={() => setPestana("huerfanos")}
            className={`flex items-center gap-3 rounded-card border-2 px-4 py-3.5 text-left ${
              pestana === "huerfanos"
                ? "border-danger/60 bg-danger/10"
                : "border-danger/30 bg-danger/[0.06] hover:border-danger/50"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
              <AlertTriangle size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-danger">
                {huerfanos.length} estudios sin concepto
              </span>
              <span className="block text-xs text-danger/80">
                Se realizan y hoy facturan $0.
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-danger/60" />
          </button>
        )}

        {rotos.length > 0 && (
          <button
            onClick={() => setPestana("rotos")}
            className={`flex items-center gap-3 rounded-card border-2 px-4 py-3.5 text-left ${
              pestana === "rotos"
                ? "border-warning/60 bg-warning/10"
                : "border-warning/30 bg-warning/[0.06] hover:border-warning/50"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <Ban size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-warning">
                {rotos.length} concepto{rotos.length === 1 ? "" : "s"} activo{rotos.length === 1 ? "" : "s"} sin estudios
              </span>
              <span className="block text-xs text-warning/80">
                {pesos(rotos.reduce((s, c) => s + Number(c.precio), 0))} inalcanzables.
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-warning/60" />
          </button>
        )}
      </div>

      {/* Pestañas: cambian la lista de la izquierda. El detalle de la
          derecha se queda, para poder asignar sin perder de vista a qué
          concepto se está asignando. */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-ink-soft/15">
        {[
          { k: "conceptos", txt: `Conceptos (${conceptos.length})` },
          ...(huerfanos.length ? [{ k: "huerfanos", txt: `Estudios sin concepto (${huerfanos.length})` }] : []),
          ...(rotos.length ? [{ k: "rotos", txt: `Conceptos sin estudios (${rotos.length})` }] : []),
        ].map((p) => (
          <button
            key={p.k}
            onClick={() => setPestana(p.k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              pestana === p.k
                ? "border-primary font-medium text-primary"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {p.txt}
          </button>
        ))}
      </div>

      <div className="grid max-w-[1600px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ---------------- la lista ---------------- */}
        <div className="min-w-0 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          {pestana === "conceptos" ? (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="relative min-w-52 flex-1">
                  <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Buscar un concepto por nombre…"
                    className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
                  />
                  {filtro && (
                    <button
                      onClick={() => setFiltro("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={soloEstado}
                  onChange={(e) => setSoloEstado(e.target.value)}
                  className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
                <button
                  onClick={() => setEditando({ ...VACIO })}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus size={15} /> Nuevo concepto
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-soft/15 text-[11px] uppercase tracking-wide text-ink-soft">
                      <Encabezado campo="nombre" orden={orden} onOrdenar={ordenarPor}>Concepto</Encabezado>
                      <Encabezado campo="precio" orden={orden} onOrdenar={ordenarPor} derecha>Precio</Encabezado>
                      <Encabezado campo="estudios" orden={orden} onOrdenar={ordenarPor} derecha>Estudios</Encabezado>
                      <Encabezado campo="uso" orden={orden} onOrdenar={ordenarPor} derecha>Órdenes/mes</Encabezado>
                      <th className="py-2.5 pl-3 font-medium">Estado</th>
                      <th className="py-2.5 pl-3 font-medium">Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoja.filas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-ink-soft">
                          Ninguno coincide.
                        </td>
                      </tr>
                    )}
                    {hoja.filas.map((c) => {
                      const sinEstudios = Number(c.cantidad) === 0
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSel(c.id)}
                          className={`cursor-pointer border-b border-ink-soft/10 ${
                            sel === c.id ? "bg-primary/[0.06]" : "hover:bg-ink-soft/[0.03]"
                          }`}
                        >
                          <td
                            className={`py-2.5 pr-3 ${
                              sel === c.id ? "font-medium text-primary" : "text-ink"
                            }`}
                          >
                            {c.nombre}
                          </td>
                          <td className="py-2.5 pl-3 text-right tabular-nums text-ink">{pesos(c.precio)}</td>
                          <td className="py-2.5 pl-3 text-right tabular-nums text-ink-soft">{c.cantidad}</td>
                          <td className="py-2.5 pl-3 text-right tabular-nums text-ink-soft">{uso[c.id] ?? 0}</td>
                          {/* ESTADO es activo/inactivo y nada más. «Sin
                              estudios» NO es un estado: un concepto puede
                              estar activo Y sin estudios, que es el caso
                              grave. Mezclarlos escondía justo ése. */}
                          <td className="py-2.5 pl-3">
                            {c.activo ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-ink-soft/10 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                                <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/60" /> Inactivo
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pl-3">
                            {sinEstudios ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                                <AlertTriangle size={11} /> Sin estudios
                              </span>
                            ) : (
                              <span className="text-ink-soft/40">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Paginador
                pagina={hoja.pagina}
                totalPaginas={hoja.totalPaginas}
                onCambiar={setPagina}
                cuantos={listaFiltrada.length}
              />
            </>
          ) : pestana === "huerfanos" ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Se piden en la orden, salen en la hoja de ruta y el profesional los
                carga — y suman $0. Tocá uno para agregarlo a
                <b className="text-ink"> {conceptoActual?.nombre ?? "—"}</b>.
              </p>
              <ul className="grid max-h-[32rem] gap-1 overflow-y-auto pr-0.5 sm:grid-cols-2">
                {huerfanos.map((e) => (
                  <li key={e.id}>
                    <button
                      disabled={!sel}
                      onClick={() => agregar(e)}
                      title={sel ? `Agregar a ${conceptoActual.nombre}` : "Elegí un concepto primero"}
                      className="flex w-full items-center gap-2 rounded-md border border-danger/25 bg-danger/[0.04] px-2.5 py-2 text-left text-xs hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink" title={e.nombre}>{e.nombre}</span>
                        <span className="block truncate text-[11px] text-ink-soft">{e.categoria?.nombre}</span>
                      </span>
                      <ArrowRight size={13} className="shrink-0 text-ink-soft" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Tienen precio y ningún estudio que los active, así que nunca se van
                a facturar. Elegí uno y agregale sus estudios desde la derecha.
              </p>
              <ul className="flex flex-col gap-1">
                {rotos.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSel(c.id)}
                      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left ${
                        sel === c.id
                          ? "border-primary/40 bg-primary/[0.06]"
                          : "border-warning/30 bg-warning/[0.05] hover:border-warning/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1 text-sm text-ink">{c.nombre}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{pesos(c.precio)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ---------------- el detalle ---------------- */}
        <div className="min-w-0 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          {!conceptoActual ? (
            <p className="py-10 text-center text-sm text-ink-soft">
              Elegí un concepto de la lista.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold leading-tight text-ink">
                      {conceptoActual.nombre}
                    </span>
                    {conceptoActual.activo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink-soft/10 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                        Inactivo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    <span className="font-semibold tabular-nums text-ink">{pesos(conceptoActual.precio)}</span>
                    {" · "}{conceptoActual.cantidad} estudio{Number(conceptoActual.cantidad) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditando({ ...conceptoActual })}
                    className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  {/* Desactivar no borra: el concepto queda y se puede volver
                      a activar. En rojo parecía destructivo y frenaba. */}
                  <button
                    onClick={async () => {
                      setError(null)
                      try {
                        await conceptosService.cambiarActivo(conceptoActual.id, !conceptoActual.activo)
                        await recargar()
                      } catch (e) { setError(e.message) }
                    }}
                    className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-soft/40 hover:text-ink"
                  >
                    <Power size={13} /> {conceptoActual.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>

              {/* Cuántas órdenes lo cobraron de verdad. Es el número que hace
                  falta para cambiar un precio sin adivinar. */}
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3.5 py-3">
                <BarChart3 size={18} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-tight text-ink-soft">
                    Órdenes del último mes que lo cobraron
                  </p>
                  <p className="text-xl font-semibold leading-tight tabular-nums text-ink">
                    {uso[conceptoActual.id] ?? 0}
                  </p>
                </div>
                <p className="max-w-40 shrink-0 text-right text-[11px] leading-snug text-ink-soft">
                  Cambiar el precio no toca lo ya facturado: el importe se congela
                  al crear la orden.
                </p>
              </div>

              {inactivosDentro.length > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.05] px-3 py-2 text-xs leading-snug text-danger">
                  <AlertTriangle size={13} className="mt-px shrink-0" />
                  <span>
                    <b>Hay {inactivosDentro.length} estudio{inactivosDentro.length === 1 ? "" : "s"} inactivo{inactivosDentro.length === 1 ? "" : "s"} adentro.</b>{" "}
                    Una orden no los va a incluir, así que este concepto no se cobra.
                  </span>
                </p>
              )}

              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-ink">Estudios incluidos ({cubiertos.length})</p>
              </div>

              {cubiertos.length === 0 ? (
                <p className="mb-4 rounded-lg border border-dashed border-danger/40 bg-danger/[0.04] px-3 py-4 text-center text-xs text-danger">
                  Sin estudios, este concepto no se va a cobrar nunca.
                </p>
              ) : (
                <ul className="mb-4 flex max-h-64 flex-col gap-1 overflow-y-auto pr-0.5">
                  {cubiertos.map((e) => (
                    <li
                      key={e.id}
                      className="group flex items-center gap-2 rounded-md border border-ink-soft/15 px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink" title={e.nombre}>
                        {e.nombre}
                      </span>
                      {!e.activo && (
                        <span className="shrink-0 rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                          inactivo
                        </span>
                      )}
                      <button
                        onClick={() => quitar(e)}
                        title="Sacar del concepto"
                        className="shrink-0 text-ink-soft/40 opacity-0 hover:text-danger group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-ink-soft/10 pt-3">
                <p className="mb-2 text-sm font-medium text-ink">Agregar un estudio</p>
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o código"
                    className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                {busqueda.trim().length < 2 ? (
                  <p className="text-xs text-ink-soft">Escribí al menos dos letras.</p>
                ) : resultados.length === 0 ? (
                  <p className="text-xs text-ink-soft">Ninguno coincide.</p>
                ) : (
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-0.5">
                    {resultados.map((e) => {
                      const puesto = yaEstan.has(e.id)
                      return (
                        <li key={e.id}>
                          <button
                            disabled={puesto}
                            onClick={() => agregar(e)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            {puesto
                              ? <span className="shrink-0 text-[10px] text-ink-soft">ya está</span>
                              : <Plus size={13} className="shrink-0 text-primary" />}
                            <span className="min-w-0">
                              <span className="block truncate text-ink">{e.nombre}</span>
                              <span className="block truncate text-[11px] text-ink-soft">{e.categoria?.nombre}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs leading-snug text-warning">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                <span>
                  <b>Recordá:</b> un concepto se cobra sólo si la orden incluye
                  TODOS sus estudios. Agregar uno lo vuelve más difícil de cobrar,
                  no más caro.
                </span>
              </p>
            </>
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


function Encabezado({ campo, orden, onOrdenar, derecha, children }) {
  const activo = orden.campo === campo
  return (
    <th className={`py-2.5 font-medium ${derecha ? "pl-3 text-right" : "pr-3"}`}>
      <button onClick={() => onOrdenar(campo)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${activo ? "text-primary" : "hover:text-ink"}`}>
        {children}
        {activo ? (orden.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronDown size={12} className="opacity-25" />}
      </button>
    </th>
  )
}