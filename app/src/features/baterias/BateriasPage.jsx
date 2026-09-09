import { useEffect, useState } from "react"
import { Plus, X, AlertTriangle, Search, Building2, Globe } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { bateriasService } from "./services/bateriasService"

/* ---------------------------------------------------------------------
   Baterías por empresa y puesto — RF09.

   Lo que se configura acá es qué estudios pide cada empresa, y para
   quién. El campo que hace el trabajo es «para quién»:

     Ambos   ·  Sólo varón  ·  Sólo mujer

   crear_orden() copia los ítems que aplican al sexo de la persona. Por
   eso la misma batería abre 55 estudios a un varón y 56 a una mujer, sin
   que recepción tilde nada (CP-07), y por eso la clínica deja de
   necesitar «Gómez Pardo H» y «Gómez Pardo M» como dos empresas.

   Arriba a la derecha se ve esa cuenta en vivo: cuántos estudios abriría
   la batería para cada sexo. No se calcula acá — se le pregunta a la
   misma tabla que usa crear_orden.

   Editar una batería no toca las órdenes ya emitidas (CP-09): los
   estudios de una orden son una copia hecha al crearla, no un puntero.
   --------------------------------------------------------------------- */

const VACIA = { nombre: "", empresa_id: "" }
const SEXOS = [
  { valor: "A", corto: "Ambos" },
  { valor: "M", corto: "Varón" },
  { valor: "F", corto: "Mujer" },
]

export default function BateriasPage() {
  const [baterias, setBaterias] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [sel, setSel] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cuenta, setCuenta] = useState(null)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState([])
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)

  async function recargar() {
    try {
      const [bs, es] = await Promise.all([
        bateriasService.getBaterias(),
        bateriasService.getEmpresas(),
      ])
      setBaterias(bs)
      setEmpresas(es)
      setSel((s) => s ?? bs[0]?.id ?? null)
      setError(null)
    } catch (e) { setError(e.message) }
  }

  async function recargarItems() {
    if (!sel) return
    try {
      const [cats, c] = await Promise.all([
        bateriasService.getItems(sel),
        bateriasService.contarPorSexo(sel),
      ])
      setCategorias(cats)
      setCuenta(c)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { recargar() }, [])
  useEffect(() => { recargarItems() }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const r = await bateriasService.buscarEstudios(busqueda)
        if (vigente) setResultados(r)
      } catch (e) { if (vigente) setError(e.message) }
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  const actual = baterias.find((b) => b.id === sel)
  const yaEstan = new Set(categorias.flatMap((c) => c.items.map((i) => i.estudio.id)))

  const hacer = (fn) => async (...args) => {
    setError(null)
    try {
      await fn(...args)
      await Promise.all([recargarItems(), recargar()])
    } catch (e) { setError(e.message) }
  }

  const agregar = hacer((est) => bateriasService.agregarItem(sel, est.id))
  const quitar = hacer((item) => bateriasService.quitarItem(item.id))
  const cambiarSexo = hacer((item, s) => bateriasService.cambiarSexo(item.id, s))

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    try {
      const g = await bateriasService.guardarBateria(editando)
      setEditando(null)
      await recargar()
      setSel(g.id)
    } catch (err) { setError(err.message) }
  }

  return (
    <AppShell titulo="Baterías" subtitulo="Qué pide cada empresa, y para quién">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Baterías */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Baterías</p>
            <button
              onClick={() => setEditando({ ...VACIA })}
              title="Nueva batería"
              className="rounded-md border-2 border-ink-soft/15 p-1 text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              <Plus size={14} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {baterias.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setSel(b.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    sel === b.id ? "bg-primary/5 text-primary" : "text-ink hover:bg-ink-soft/5"
                  } ${b.activo ? "" : "opacity-50"}`}
                >
                  <span className="block">{b.nombre}</span>
                  <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                    {b.empresa
                      ? <><Building2 size={10} /> {b.empresa.razon_social}</>
                      : <><Globe size={10} /> global</>}
                    · {b.cantidad}
                    {!b.activo && " · inactiva"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Ítems */}
        <div className="col-span-2 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-1 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{actual?.nombre ?? "—"}</p>
              <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                {actual?.empresa
                  ? <><Building2 size={10} /> {actual.empresa.razon_social}</>
                  : <><Globe size={10} /> vale para todas las empresas</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {cuenta && (
                <span className="rounded-md border-2 border-ink-soft/15 px-2.5 py-1 text-[11px] text-ink-soft">
                  abre <b className="text-ink">{cuenta.varon}</b> a un varón ·{" "}
                  <b className="text-ink">{cuenta.mujer}</b> a una mujer
                </span>
              )}
              {actual && (
                <button
                  onClick={() => setEditando({ ...actual, empresa_id: actual.empresa?.id ?? "" })}
                  className="rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          <p className="mb-4 mt-2 text-[11px] text-ink-soft">
            Cambiar esto no toca las órdenes ya emitidas: los estudios de una
            orden son una copia hecha al crearla (CP-09).
          </p>

          {categorias.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-soft">
              Esta batería no tiene ningún estudio: una orden creada con ella
              saldría vacía.
            </p>
          ) : (
            categorias.map((c) => (
              <div key={c.id} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-ink-soft">
                  {c.nombre}
                </p>
                <ul className="flex flex-col gap-1">
                  {c.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <span className={`flex-1 text-xs ${i.estudio.activo ? "text-ink" : "text-ink-soft line-through"}`}>
                        {i.estudio.nombre}
                        {!i.estudio.activo && (
                          <span className="ml-1 text-[10px] text-warning">estudio desactivado</span>
                        )}
                      </span>
                      <div className="flex shrink-0 gap-1 rounded-md border-2 border-ink-soft/15 p-0.5">
                        {SEXOS.map((s) => (
                          <button
                            key={s.valor}
                            onClick={() => cambiarSexo(i, s.valor)}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              i.sexo_aplica === s.valor
                                ? "bg-primary/10 text-primary"
                                : "text-ink-soft hover:text-ink"
                            }`}
                          >
                            {s.corto}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => quitar(i)}
                        title="Sacar de la batería"
                        className="text-ink-soft hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Agregar */}
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
            <p className="text-xs text-ink-soft">
              Entra para los dos sexos. Después se cambia con los botones.
            </p>
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
              {editando.id ? "Editar batería" : "Nueva batería"}
            </p>
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  autoFocus
                  value={editando.nombre ?? ""}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  placeholder="BASICO + ALTURA"
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Empresa</label>
                <select
                  value={editando.empresa_id ?? ""}
                  onChange={(e) => setEditando({ ...editando, empresa_id: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Ninguna — global, para todas</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.razon_social}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">
                  Sin empresa vale para todas, como el básico de ley.
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
