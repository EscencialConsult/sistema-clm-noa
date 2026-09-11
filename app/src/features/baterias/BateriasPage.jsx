import { useEffect, useState } from "react"
import { Plus, X, AlertTriangle, Search, Building2, Globe, Copy, Pencil, ChevronRight, Power, Layers } from "lucide-react"
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

const pesos = (n) =>
  "$ " + Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })
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
  /* Buscar dentro de la batería: con noventa estudios, encontrar uno
     para corregirle el «para quién» era scrollear. */
  const [dentro, setDentro] = useState("")
  const [filtroBat, setFiltroBat] = useState("")
  /* Categorías plegadas a mano. Arrancan todas abiertas: lo que se viene
     a hacer acá es mirar qué tiene la batería. */
  const [plegadas, setPlegadas] = useState([])
  const [categoriasCat, setCategoriasCat] = useState([])
  const [precio, setPrecio] = useState(null)
  /* Qué ítem tiene abierto el menú de «para quién». Uno solo por vez. */
  const [menuSexo, setMenuSexo] = useState(null)
  /* El buscador de estudios se abre desde la barra. Cerrado por
     defecto: la pantalla se usa más para mirar que para agregar. */
  const [agregando, setAgregando] = useState(false)

  async function recargar() {
    try {
      const [bs, es, cats] = await Promise.all([
        bateriasService.getBaterias(),
        bateriasService.getEmpresas(),
        bateriasService.getCategorias(),
      ])
      setBaterias(bs)
      setEmpresas(es)
      setCategoriasCat(cats)
      setSel((s) => s ?? bs[0]?.id ?? null)
      setError(null)
    } catch (e) { setError(e.message) }
  }

  async function recargarItems() {
    if (!sel) return
    try {
      const [cats, c, pr] = await Promise.all([
        bateriasService.getItems(sel),
        bateriasService.contarPorSexo(sel),
        bateriasService.getPresupuesto(sel),
      ])
      setCategorias(cats)
      setCuenta(c)
      setPrecio(pr)
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
  const agregarCategoria = hacer((cat) =>
    bateriasService.agregarCategoria(sel, cat.id, [...yaEstan])
  )
  /* Sacar la categoría entera. Antes había que apretar noventa veces la
     ✕ para dejar una batería en el básico. */
  const quitarCategoria = hacer(async (cat) => {
    for (const it of cat.items) await bateriasService.quitarItem(it.id)
  })

  async function duplicar() {
    setError(null)
    try {
      const nueva = await bateriasService.duplicar(actual)
      await recargar()
      setSel(nueva.id)
    } catch (e) { setError(e.message) }
  }

  /* El filtro de adentro se aplica sobre las categorías ya agrupadas, y
     se quedan sólo las que tienen algo que mostrar: una categoría vacía
     con su encabezado es ruido cuando se está buscando. */
  const texto = dentro.trim().toLowerCase()
  const categoriasVisibles = !texto
    ? categorias
    : categorias
        .map((c) => ({
          ...c,
          items: c.items.filter((i) => i.estudio.nombre.toLowerCase().includes(texto)),
        }))
        .filter((c) => c.items.length > 0)

  const bateriasVisibles = filtroBat.trim()
    ? baterias.filter((b) =>
        b.nombre.toLowerCase().includes(filtroBat.trim().toLowerCase())
      )
    : baterias

  /* Las que se pueden agregar enteras: las que todavía no están del todo
     adentro. Ofrecer una categoría completa que ya está no sirve. */
  const categoriasQueFaltan = categoriasCat.filter((c) =>
    c.ids.some((id) => !yaEstan.has(id))
  )

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

      {/* La lista tiene ancho propio; el detalle toma lo que queda. Con
          cuatro columnas fijas no entraba en una notebook. */}
      <div className="grid max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">

        {/* ---------------- la lista ---------------- */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-4">
          <button
            onClick={() => setEditando({ ...VACIA })}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={15} /> Nueva batería
          </button>

          <div className="relative mb-2">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={filtroBat}
              onChange={(e) => setFiltroBat(e.target.value)}
              placeholder="Buscar baterías…"
              className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
            />
            {filtroBat && (
              <button
                onClick={() => setFiltroBat("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ul className="flex max-h-[34rem] flex-col gap-1 overflow-y-auto pr-0.5">
            {bateriasVisibles.length === 0 && (
              <li className="py-4 text-center text-xs text-ink-soft">Ninguna coincide.</li>
            )}
            {bateriasVisibles.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setSel(b.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left ${
                    sel === b.id
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-transparent hover:bg-ink-soft/5"
                  } ${b.activo ? "" : "opacity-50"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${
                        sel === b.id ? "text-primary" : "text-ink"
                      }`}
                    >
                      {b.nombre}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                      {b.empresa
                        ? <><Building2 size={10} /> {b.empresa.razon_social}</>
                        : <><Globe size={10} /> global</>}
                      {" · "}{b.cantidad}
                      {!b.activo && " · inactiva"}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className={`shrink-0 ${sel === b.id ? "text-primary" : "text-ink-soft/40"}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------- el detalle ---------------- */}
        <div className="min-w-0 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          {!actual ? (
            <p className="py-10 text-center text-sm text-ink-soft">Elegí una batería.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold leading-tight text-ink">{actual.nombre}</span>
                    {actual.activo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Activa
                      </span>
                    ) : (
                      <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 text-[11px] font-medium text-ink-soft">Inactiva</span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink-soft/10 px-2 py-0.5 text-[11px] text-ink-soft">
                      {actual.empresa
                        ? <><Building2 size={10} /> {actual.empresa.razon_social}</>
                        : <><Globe size={10} /> Global</>}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={duplicar}
                    title="Copiarla con todos sus estudios"
                    className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                  >
                    <Copy size={13} /> Duplicar
                  </button>
                  <button
                    onClick={() => setEditando({ ...actual, empresa_id: actual.empresa?.id ?? "" })}
                    className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={async () => {
                      setError(null)
                      try {
                        await bateriasService.cambiarActivo(actual.id, !actual.activo)
                        await recargar()
                      } catch (e) { setError(e.message) }
                    }}
                    className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink-soft/40 hover:text-ink"
                  >
                    <Power size={13} /> {actual.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>

              {/* Los cuatro números. El precio va SEPARADO por sexo porque no
                  es proporcional a la cantidad: los conceptos se cobran
                  enteros, así que un estudio de diferencia puede valer
                  decenas de miles. Un solo número escondería justo eso. */}
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Cifra rotulo="Ítems" valor={categorias.reduce((s, c) => s + c.items.length, 0)} />
                <Cifra rotulo="Abre a un varón" valor={cuenta?.varon ?? "—"} />
                <Cifra rotulo="Abre a una mujer" valor={cuenta?.mujer ?? "—"} />
                <Cifra
                  rotulo="Precio"
                  valor={
                    precio && precio.varon && precio.mujer
                      ? (Number(precio.varon.importe) === Number(precio.mujer.importe)
                          ? pesos(precio.varon.importe)
                          : `${pesos(precio.varon.importe)} / ${pesos(precio.mujer.importe)}`)
                      : "—"
                  }
                  pie={
                    precio && precio.varon && precio.mujer &&
                    Number(precio.varon.importe) !== Number(precio.mujer.importe)
                      ? "varón / mujer"
                      : null
                  }
                  alerta={
                    precio && precio.varon && precio.mujer &&
                    Number(precio.varon.importe) !== Number(precio.mujer.importe)
                  }
                />
              </div>

              <p className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs leading-snug text-warning">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                <span>
                  Editar esta batería <b>no afecta las órdenes ya emitidas</b>: los
                  estudios de una orden son una copia hecha al crearla.
                </span>
              </p>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                  <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={dentro}
                    onChange={(e) => setDentro(e.target.value)}
                    placeholder="Buscar dentro de la batería…"
                    className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
                  />
                  {dentro && (
                    <button
                      onClick={() => setDentro("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Las dos formas de sumar, juntas y arriba. Antes el
                    buscador de estudios estaba al pie, después de noventa
                    ítems con scroll: había que recorrer toda la batería
                    para agregar uno. */}
                <div className="relative">
                  <button
                    onClick={() => setAgregando((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-md border-2 px-3 py-2 text-sm font-medium ${
                      agregando
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-ink-soft/20 text-ink-soft hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    <Plus size={15} /> Agregar estudio
                  </button>

                  {agregando && (
                    <div className="absolute left-0 top-full z-20 mt-1.5 w-80 rounded-md border-2 border-ink-soft/15 bg-white p-3 shadow-lg">
                      <div className="relative mb-2">
                        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                        <input
                          autoFocus
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Nombre o código"
                          className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
                        />
                        {busqueda && (
                          <button
                            onClick={() => setBusqueda("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {busqueda.trim().length < 2 ? (
                        <p className="text-[11px] leading-snug text-ink-soft">
                          Entra para los dos sexos. Después se cambia con la pastilla.
                        </p>
                      ) : resultados.length === 0 ? (
                        <p className="text-xs text-ink-soft">Ninguno coincide.</p>
                      ) : (
                        <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto pr-0.5">
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
                  )}
                </div>

                {/* Agregar una categoría entera: HEMOGRAMA son catorce
                    estudios y entraban de a uno. */}
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const c = categoriasQueFaltan.find((x) => String(x.id) === e.target.value)
                      if (c) agregarCategoria(c)
                    }}
                    disabled={categoriasQueFaltan.length === 0}
                    className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-40"
                  >
                    <option value="">+ Agregar categoría…</option>
                    {categoriasQueFaltan.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.ids.filter((id) => !yaEstan.has(id)).length} faltan)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {categorias.length === 0 ? (
                <p className="rounded-lg border border-dashed border-danger/40 bg-danger/[0.04] px-3 py-4 text-center text-xs text-danger">
                  Esta batería no tiene ningún estudio: una orden creada con ella
                  saldría vacía.
                </p>
              ) : categoriasVisibles.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-soft">
                  Ningún estudio de esta batería coincide con «{dentro.trim()}».
                </p>
              ) : (
                /* Alto máximo: CONDUCTOR son noventa ítems y sin tope empujaba
                   la pantalla entera hacia abajo. */
                <div className="max-h-[30rem] overflow-y-auto pr-0.5">
                  {categoriasVisibles.map((c) => {
                    const abierta = !plegadas.includes(c.id)
                    return (
                      <div key={c.id} className="mb-2 overflow-hidden rounded-lg border border-ink-soft/15 last:mb-0">
                        <div className="flex items-stretch bg-ink-soft/[0.04]">
                          <button
                            onClick={() =>
                              setPlegadas((p) =>
                                p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]
                              )
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                          >
                            <ChevronRight
                              size={14}
                              className={`shrink-0 text-ink-soft transition-transform ${abierta ? "rotate-90" : ""}`}
                            />
                            <Layers size={14} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                              {c.nombre}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                              {c.items.length}
                            </span>
                          </button>
                          <button
                            onClick={() => quitarCategoria(c)}
                            title="Sacar la categoría entera de esta batería"
                            className="flex shrink-0 items-center px-2.5 text-ink-soft/40 hover:bg-danger/10 hover:text-danger"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {abierta && (
                          <ul className="divide-y divide-ink-soft/10">
                            {c.items.map((i) => (
                              <li key={i.id} className="flex items-center gap-2 px-3 py-1.5">
                                <span
                                  className={`min-w-0 flex-1 truncate text-[13px] ${
                                    i.estudio.activo ? "text-ink" : "text-ink-soft line-through"
                                  }`}
                                  title={i.estudio.nombre}
                                >
                                  {i.estudio.nombre}
                                </span>
                                {!i.estudio.activo && (
                                  <span className="shrink-0 text-[10px] text-warning">desactivado</span>
                                )}

                                {/* El «para quién» como pastilla y no como tres
                                    botones en cada renglón: sólo 7 ítems de 478
                                    usan una restricción, el resto es «Ambos». */}
                                <div className="relative shrink-0">
                                  <button
                                    onClick={() => setMenuSexo(menuSexo === i.id ? null : i.id)}
                                    title="Cambiar para quién aplica"
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      i.sexo_aplica === "A"
                                        ? "bg-ink-soft/10 text-ink-soft hover:bg-ink-soft/20"
                                        : "bg-warning/15 text-warning hover:bg-warning/25"
                                    }`}
                                  >
                                    {SEXOS.find((s) => s.valor === i.sexo_aplica)?.corto}
                                  </button>
                                  {menuSexo === i.id && (
                                    <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-md border border-ink-soft/20 bg-white py-1 shadow-lg">
                                      {SEXOS.map((s) => (
                                        <button
                                          key={s.valor}
                                          onClick={() => { setMenuSexo(null); cambiarSexo(i, s.valor) }}
                                          className={`block w-full px-3 py-1.5 text-left text-xs ${
                                            i.sexo_aplica === s.valor
                                              ? "bg-primary/10 font-medium text-primary"
                                              : "text-ink hover:bg-ink-soft/5"
                                          }`}
                                        >
                                          {s.corto}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => quitar(i)}
                                  title="Sacar de la batería"
                                  className="shrink-0 text-ink-soft/40 hover:text-danger"
                                >
                                  <X size={13} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <p className="mt-3 text-[11px] text-ink-soft">
                Casi todos los estudios entran como <b>Ambos</b>. Sólo hace falta
                cambiar la pastilla en los que de verdad dependen del sexo.
              </p>
            </>
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

/* Un número con su rótulo. `alerta` lo pinta en ámbar: se usa cuando el
   precio difiere entre varón y mujer, que es señal de que a la batería le
   falta algún estudio de un paquete facturable. */
function Cifra({ rotulo, valor, pie, alerta }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        alerta ? "border-warning/40 bg-warning/[0.06]" : "border-ink-soft/15 bg-ink-soft/[0.02]"
      }`}
    >
      <p className="text-[11px] leading-tight text-ink-soft">{rotulo}</p>
      <p
        className={`text-lg font-semibold leading-tight tabular-nums ${
          alerta ? "text-warning" : "text-ink"
        }`}
      >
        {valor}
      </p>
      {pie && <p className="text-[10px] leading-tight text-ink-soft">{pie}</p>}
    </div>
  )
}
