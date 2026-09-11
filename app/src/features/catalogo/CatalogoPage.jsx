import { useEffect, useState } from "react"
import { Plus, AlertTriangle, DollarSign, Ruler, X, Search } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { catalogoService, REFERENCIA_COMPARABLE } from "./services/catalogoService"
import { ETIQUETA_ROL } from "../../types/dominio"

/* ---------------------------------------------------------------------
   Catálogo de categorías y estudios — RF07, RF08.

   «El alta de un estudio nuevo no requiere desarrollo: el formulario de
   carga se genera solo a partir de esta definición.» Esta es la pantalla
   que hace verdad esa frase.

   Lo mantienen el Administrador y Recepción. Los precios no están acá:
   los conceptos facturables son del Administrador, y esa separación es
   a propósito.

   Dos avisos que la pantalla da y que no son decorativos:

   · Si el valor de referencia no tiene el formato «43-53», el sistema
     no lo va a comparar con nada. Se guarda, pero «no marcó fuera de
     rango» va a significar «no comparé», no «está bien».

   · Si el estudio no está en ningún concepto facturable, se suma a la
     orden y aporta cero al importe. Se factura de menos y nadie se
     entera. Enganchar el concepto es tarea del Administrador.
   --------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   Qué hace el sistema con cada estudio.

   Es la pregunta que la pantalla no contestaba y hay que deducir mirando
   tres columnas a la vez. Y es la que importa: un estudio que "no
   compara" nunca se va a marcar fuera de rango, así que "no apareció
   marcado" significa "nadie lo comparó", no "está bien".

   Los cuatro casos salen de lo que tenga cargado, no de lo que el
   estudio sea en la realidad. El hepatograma es numérico y está cargado
   sin unidad ni referencia: para el sistema es cualitativo.
   --------------------------------------------------------------------- */
const TIPOS = {
  compara: {
    etiqueta: "Compara",
    detalle: "Tiene rango: marca el valor fuera de rango según el sexo",
    clase: "bg-success/10 text-success",
  },
  ilegible: {
    etiqueta: "No compara",
    detalle: "Tiene referencia cargada pero el sistema no la puede leer",
    clase: "bg-danger/10 text-danger",
  },
  sinReferencia: {
    etiqueta: "Sin referencia",
    detalle: "Guarda el número y no lo compara con nada",
    clase: "bg-warning/10 text-warning",
  },
  cualitativo: {
    etiqueta: "Cualitativo",
    detalle: "Se informa una conclusión, no un valor",
    clase: "bg-ink-soft/10 text-ink-soft",
  },
}

function tipoDe(e) {
  const refs = [e.ref_h, e.ref_m].filter((r) => (r ?? "").trim() !== "")
  if (refs.length === 0) return e.unidad ? "sinReferencia" : "cualitativo"
  return refs.every((r) => REFERENCIA_COMPARABLE.test(r)) ? "compara" : "ilegible"
}

const CAT_VACIA = { nombre: "", orden: 99, rol_carga: "R5", valor_defecto: "NORMAL" }
const EST_VACIO = { codigo: "", nombre: "", unidad: "", ref_h: "", ref_m: "", orden: 99 }
const ROLES_CARGA = ["R3", "R4", "R5", "R6", "R7", "R8"]

export default function CatalogoPage() {
  const [categorias, setCategorias] = useState([])
  const [sel, setSel] = useState(null)
  const [estudios, setEstudios] = useState([])
  const [editCat, setEditCat] = useState(null)
  const [editEst, setEditEst] = useState(null)
  const [sinConcepto, setSinConcepto] = useState(0)
  const [error, setError] = useState(null)
  /* Todo el catálogo, para el resumen y el buscador. Son 120: traerlos
     todos cuesta menos que hacer nueve consultas. */
  const [todos, setTodos] = useState([])
  const [busqueda, setBusqueda] = useState("")

  async function recargarCategorias() {
    try {
      const cats = await catalogoService.getCategorias()
      setCategorias(cats)
      setSel((s) => s ?? cats[0]?.id ?? null)
      setSinConcepto(await catalogoService.contarSinConcepto())
      setTodos(await catalogoService.getTodos())
      setError(null)
    } catch (e) { setError(e.message) }
  }

  async function recargarEstudios() {
    if (!sel) return
    try { setEstudios(await catalogoService.getEstudios(sel)) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { recargarCategorias() }, [])
  useEffect(() => { recargarEstudios() }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarCat(e) {
    e.preventDefault()
    setError(null)
    try {
      const g = await catalogoService.guardarCategoria(editCat)
      setEditCat(null)
      await recargarCategorias()
      setSel(g.id)
    } catch (err) { setError(err.message) }
  }

  async function guardarEst(e) {
    e.preventDefault()
    setError(null)
    try {
      await catalogoService.guardarEstudio(editEst, sel)
      setEditEst(null)
      await Promise.all([recargarEstudios(), recargarCategorias()])
    } catch (err) { setError(err.message) }
  }

  const catActual = categorias.find((c) => c.id === sel)

  /* Cuántos hay de cada tipo. Es lo que se necesita para la reunión con
     la bioquímica: no la lista, sino cuánto falta y de qué clase. */
  const activos = todos.filter((e) => e.activo)
  const resumen = activos.reduce((acc, e) => {
    const k = tipoDe(e)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  const porCategoria = activos.reduce((acc, e) => {
    const id = e.categoria?.id
    acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  /* El buscador cruza las nueve categorías: con 120 estudios, adivinar
     en cuál está uno es más lento que escribir su nombre. */
  const sinTildes = (s) =>
    (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const hallados = busqueda.trim().length >= 2
    ? todos.filter((e) =>
        sinTildes(e.nombre).includes(sinTildes(busqueda)) ||
        sinTildes(e.codigo).includes(sinTildes(busqueda)))
    : null

  return (
    <AppShell titulo="Estudios y categorías" subtitulo="Lo que el centro ofrece">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {sinConcepto > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <DollarSign size={15} className="mt-0.5 shrink-0" />
          <span>
            <b>{sinConcepto} estudios no están en ningún concepto facturable.</b>{" "}
            Se pueden pedir en una orden, pero suman $0 al importe. Engancharlos a
            un concepto lo hace el Administrador.
          </span>
        </div>
      )}

      {/* Qué hace el sistema con el catálogo, de un vistazo. Antes había
          que entrar a las nueve categorías y sumar a mano. */}
      {activos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border-2 border-ink-soft/15 bg-white px-4 py-3">
          <span className="text-sm font-medium text-ink">{activos.length} estudios</span>
          <span className="text-ink-soft/40">·</span>
          {["compara", "ilegible", "sinReferencia", "cualitativo"].map((k) =>
            resumen[k] ? (
              <span
                key={k}
                title={TIPOS[k].detalle}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPOS[k].clase}`}
              >
                {resumen[k]} {TIPOS[k].etiqueta.toLowerCase()}
              </span>
            ) : null
          )}
          <div className="ml-auto flex items-center gap-2 rounded-md border-2 border-ink-soft/20 px-2.5 py-1.5 focus-within:border-primary">
            <Search size={14} className="shrink-0 text-ink-soft" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en todo el catálogo…"
              className="w-56 bg-transparent text-xs outline-none"
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="text-ink-soft hover:text-ink">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resultados del buscador: reemplazan la vista por categoría
          mientras hay algo escrito. */}
      {hallados && (
        <div className="mb-4 rounded-card border-2 border-primary/25 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">
            {hallados.length} resultado{hallados.length === 1 ? "" : "s"} para «{busqueda.trim()}»
          </p>
          {hallados.length === 0 ? (
            <p className="text-xs text-ink-soft">Ningún estudio coincide.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {hallados.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => { setSel(e.categoria?.id); setBusqueda("") }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-ink-soft/5"
                  >
                    <span className="text-ink">{e.nombre}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPOS[tipoDe(e)].clase}`}>
                      {TIPOS[tipoDe(e)].etiqueta}
                    </span>
                    {!e.seCobra && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">no se cobra</span>
                    )}
                    <span className="ml-auto text-xs text-ink-soft">{e.categoria?.nombre}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Categorías */}
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Categorías</p>
            <button
              onClick={() => setEditCat({ ...CAT_VACIA })}
              title="Nueva categoría"
              className="rounded-md border-2 border-ink-soft/15 p-1 text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              <Plus size={14} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {categorias.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSel(c.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    sel === c.id ? "bg-primary/5 text-primary" : "text-ink hover:bg-ink-soft/5"
                  } ${c.activo ? "" : "opacity-50"}`}
                >
                  <span className="flex items-baseline gap-1.5">
                    {c.nombre}
                    <span className="text-[11px] text-ink-soft/70">{porCategoria[c.id] ?? 0}</span>
                  </span>
                  <span className="block text-[11px] text-ink-soft">
                    {ETIQUETA_ROL[c.rol_carga] ?? c.rol_carga} · {c.valor_defecto}
                    {!c.activo && " · inactiva"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Estudios de la categoría */}
        <div className="col-span-3 rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{catActual?.nombre ?? "—"}</p>
              {catActual && (
                <p className="text-[11px] text-ink-soft">
                  La carga {ETIQUETA_ROL[catActual.rol_carga]} · arranca en {catActual.valor_defecto}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {catActual && (
                <>
                  <button
                    onClick={() => setEditCat({ ...catActual })}
                    className="rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                  >
                    Editar categoría
                  </button>
                  <button
                    onClick={() => setEditEst({ ...EST_VACIO })}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    <Plus size={14} /> Estudio
                  </button>
                </>
              )}
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] text-ink-soft">
                <th className="pb-2 font-normal">Código</th>
                <th className="pb-2 font-normal">Estudio</th>
                <th className="pb-2 font-normal">Qué hace el sistema</th>
                <th className="pb-2 font-normal">Unidad</th>
                <th className="pb-2 font-normal">Referencia varón</th>
                <th className="pb-2 font-normal">Referencia mujer</th>
                <th className="pb-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {estudios.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-ink-soft">
                    Esta categoría todavía no tiene estudios.
                  </td>
                </tr>
              )}
              {estudios.map((e) => (
                <tr key={e.id} className={`border-t border-ink-soft/10 ${e.activo ? "" : "opacity-50"}`}>
                  <td className="py-2.5 text-ink-soft">{e.codigo ?? "—"}</td>
                  <td className="py-2.5">
                    <span className="text-ink">{e.nombre}</span>
                    {!e.seCobra && (
                      <span
                        title="No está en ningún concepto facturable: suma $0"
                        className="ml-2 whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning"
                      >
                        no se cobra
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      title={TIPOS[tipoDe(e)].detalle}
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPOS[tipoDe(e)].clase}`}
                    >
                      {TIPOS[tipoDe(e)].etiqueta}
                    </span>
                  </td>
                  <td className="py-2.5 text-ink-soft">{e.unidad ?? "—"}</td>
                  <Referencia valor={e.ref_h} />
                  <Referencia valor={e.ref_m} />
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => setEditEst({ ...e })}
                      className="mr-3 text-xs text-primary hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        setError(null)
                        try {
                          await catalogoService.cambiarActivoEstudio(e.id, !e.activo)
                          await recargarEstudios()
                        } catch (err) { setError(err.message) }
                      }}
                      className="text-xs text-ink-soft hover:underline"
                    >
                      {e.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-xs text-ink-soft">
            Un estudio no se borra: se desactiva. Deja de ofrecerse en las
            baterías nuevas, pero las órdenes viejas siguen mostrando lo que se
            cargó.
          </p>
        </div>
      </div>

      {editCat && (
        <Modal titulo={editCat.id ? "Editar categoría" : "Nueva categoría"} onCerrar={() => setEditCat(null)}>
          <form onSubmit={guardarCat}>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Campo label="Nombre" requerido valor={editCat.nombre}
                onCambio={(v) => setEditCat({ ...editCat, nombre: v })} />
              <Campo label="Orden en pantalla" tipo="number" valor={editCat.orden}
                onCambio={(v) => setEditCat({ ...editCat, orden: v })} />
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Quién la carga</label>
                <select
                  value={editCat.rol_carga}
                  onChange={(e) => setEditCat({ ...editCat, rol_carga: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  {ROLES_CARGA.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">
                  Sólo ese rol puede cargar sus resultados.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Valor por defecto</label>
                <select
                  value={editCat.valor_defecto}
                  onChange={(e) => setEditCat({ ...editCat, valor_defecto: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="NEGATIVO">NEGATIVO</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">
                  Con lo que se completa la categoría entera de un clic.
                </p>
              </div>
            </div>
            <Botones onCancelar={() => setEditCat(null)} habilitado={!!editCat.nombre?.trim()} />
          </form>
        </Modal>
      )}

      {editEst && (
        <Modal titulo={editEst.id ? "Editar estudio" : `Nuevo estudio en ${catActual?.nombre}`} onCerrar={() => setEditEst(null)}>
          <form onSubmit={guardarEst}>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Campo label="Código" valor={editEst.codigo}
                onCambio={(v) => setEditEst({ ...editEst, codigo: v })} />
              <div className="col-span-2">
                <Campo label="Nombre" requerido valor={editEst.nombre}
                  onCambio={(v) => setEditEst({ ...editEst, nombre: v })} />
              </div>
              <Campo label="Unidad" valor={editEst.unidad}
                onCambio={(v) => setEditEst({ ...editEst, unidad: v })} />
              <Campo label="Referencia varón" valor={editEst.ref_h}
                onCambio={(v) => setEditEst({ ...editEst, ref_h: v })} />
              <Campo label="Referencia mujer" valor={editEst.ref_m}
                onCambio={(v) => setEditEst({ ...editEst, ref_m: v })} />
            </div>

            <AvisoReferencia est={editEst} />

            <Botones onCancelar={() => setEditEst(null)} habilitado={!!editEst.nombre?.trim()} />
          </form>
        </Modal>
      )}
    </AppShell>
  )
}

/* --- una celda de referencia, con el aviso de si se puede comparar --- */
function Referencia({ valor }) {
  if (!valor) return <td className="py-2.5 text-xs text-ink-soft">—</td>
  const comparable = REFERENCIA_COMPARABLE.test(valor)
  return (
    <td className="py-2.5 text-xs">
      <span className={comparable ? "text-ink-soft" : "text-warning"}>{valor}</span>
      {!comparable && (
        <span className="ml-1 text-[10px] text-warning" title="No tiene el formato 43-53: no se compara">
          sin comparar
        </span>
      )}
    </td>
  )
}

function AvisoReferencia({ est }) {
  const refs = [est.ref_h, est.ref_m].filter((r) => (r ?? "").trim() !== "")
  if (refs.length === 0) {
    return (
      <p className="mb-4 rounded-md border-2 border-ink-soft/15 bg-ink-soft/5 px-3 py-2 text-[11px] text-ink-soft">
        Sin valores de referencia el estudio funciona igual, pero nunca se va a
        marcar fuera de rango. Está bien para los cualitativos (radiografías,
        examen físico); no para los numéricos.
      </p>
    )
  }
  const raras = refs.filter((r) => !REFERENCIA_COMPARABLE.test(r))
  if (raras.length > 0) {
    return (
      <p className="mb-4 flex items-start gap-2 rounded-md border-2 border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-warning">
        <Ruler size={13} className="mt-0.5 shrink-0" />
        <span>
          El sistema sólo compara el formato <b>43-53</b>. Lo que escribiste se
          guarda, pero no se va a evaluar: «no marcó fuera de rango» va a
          significar «no comparé».
        </span>
      </p>
    )
  }
  return (
    <p className="mb-4 rounded-md border-2 border-success/30 bg-success/5 px-3 py-2 text-[11px] text-success">
      El sistema va a comparar cada resultado contra estos valores, según el sexo
      de la persona.
    </p>
  )
}

/* --- piezas --- */
function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4">
      <div className="w-full max-w-2xl rounded-card border-2 border-ink-soft/15 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{titulo}</p>
          <button onClick={onCerrar} className="text-ink-soft hover:text-ink"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Botones({ onCancelar, habilitado }) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={!habilitado}
        className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft"
      >
        Cancelar
      </button>
    </div>
  )
}

function Campo({ label, valor, onCambio, tipo = "text", requerido }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-soft">
        {label} {requerido && <span className="text-danger">*</span>}
      </label>
      <input
        type={tipo}
        value={valor ?? ""}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  )
}
