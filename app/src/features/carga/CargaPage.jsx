import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  RotateCcw,
  Eraser,
  PencilLine,
  X,
  Stethoscope,
  Droplet,
  TestTube2,
  FlaskConical,
  ShieldAlert,
  Scan,
  HeartPulse,
  Brain,
} from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { ordenesService } from "./services/ordenesService"
import { authService } from "../auth/services/authService"
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD, ESTILO_ESTADO, ROL } from "../../types/dominio"
import MenuImpreso from "../../shared/impresos/MenuImpreso"
import { imprimirHojaDeRuta } from "../ordenes/imprimir/HojaDeRuta"
import { imprimirProtocolo } from "../aptitud/imprimir/Protocolo"

/* ---------------------------------------------------------------------
   ClickUp 06 · Pantalla de carga: las dos grillas (CU-07).
   Grilla de arriba: categorías de la orden, con su avance.
   Grilla de abajo: los estudios de la categoría elegida, para cargar,
   con selección múltiple para limpiar o aplicar el mismo valor a varias
   filas a la vez.

   La lógica de negocio (fuera de rango, quién puede cargar qué,
   completar la orden) NO se resuelve acá — vive en la base (trigger y
   RLS, ver TRABAJAR.md). Esta pantalla solo llama al servicio y
   muestra lo que vuelve, incluido el error si RLS lo rechaza.
   --------------------------------------------------------------------- */

const ICONO_CATEGORIA = {
  "EXAMENES FISICOS": Stethoscope,
  HEMOGRAMA: Droplet,
  "ORINA COMPLETA": TestTube2,
  "OTRAS DETERMINACIONES": FlaskConical,
  HEPATOGRAMA: FlaskConical,
  TOXICOLOGICO: ShieldAlert,
  RADIOGRAFIAS: Scan,
  CARDIOLOGIA: HeartPulse,
  ESPECIALIDADES: Brain,
}

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "pendientes", label: "Pendientes" },
  { key: "completas", label: "Completas" },
]

const COLUMNAS_APLICABLES = [
  { key: "resultado", label: "Resultado" },
  { key: "detalle", label: "Valor" },
  { key: "observacion", label: "Observación" },
]

export default function CargaPage() {
  const { ordenId } = useParams()
  const navigate = useNavigate()
  const sesion = authService.getSesionActual()

  const [orden, setOrden] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaSel, setCategoriaSel] = useState(null)
  const [filtro, setFiltro] = useState("todas")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [avisoCategoria, setAvisoCategoria] = useState(null)

  // Selección múltiple — vive por categoría: cambiar de categoría limpia la selección.
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [aplicarAbierto, setAplicarAbierto] = useState(false)
  const [columnaAplicar, setColumnaAplicar] = useState("resultado")
  const [textoAplicar, setTextoAplicar] = useState("")

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      const [o, cats] = await Promise.all([
        ordenesService.getOrden(ordenId),
        ordenesService.getEstudiosDeOrden(ordenId),
      ])
      setOrden(o)
      setCategorias(cats)
      setCategoriaSel((sel) => sel ?? cats[0]?.id ?? null)
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

  function elegirCategoria(id) {
    setCategoriaSel(id)
    setAvisoCategoria(null)
    setSeleccionados(new Set())
    setAplicarAbierto(false)
  }

  const categoriasConAvance = useMemo(
    () =>
      categorias.map((c) => {
        const cargados = c.items.filter((i) => i.estado === "CARGADO").length
        return { ...c, cargados, total: c.items.length, completa: cargados === c.items.length && c.items.length > 0 }
      }),
    [categorias]
  )

  const catActual = categoriasConAvance.find((c) => c.id === categoriaSel)

  const totales = useMemo(() => {
    const items = categorias.flatMap((c) => c.items)
    return { total: items.length, cargados: items.filter((i) => i.estado === "CARGADO").length }
  }, [categorias])

  const categoriasFiltradas = categoriasConAvance.filter((c) => {
    if (filtro === "pendientes") return !c.completa
    if (filtro === "completas") return c.completa
    return true
  })

  async function guardarFila(item, campos) {
    try {
      await ordenesService.guardarResultado(item.id, {
        resultado: campos.resultado ?? item.resultado ?? "",
        detalle: campos.detalle ?? item.detalle ?? "",
        observacion: campos.observacion ?? item.observacion ?? "",
      })
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  async function cargarCategoriaCompleta() {
    if (!catActual) return
    setAvisoCategoria(null)
    try {
      const n = await ordenesService.cargarCategoriaNormal(ordenId, catActual.id)
      setAvisoCategoria(`Se cargaron ${n} estudio${n === 1 ? "" : "s"} en ${catActual.valor_defecto ?? "NORMAL"}.`)
      await recargar()
    } catch (e) {
      // 42501 / mensaje de la propia función: "La categoría X no es de tu área"
      setError(e.message)
    }
  }

  function alternarSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function alternarSeleccionTodos() {
    if (!catActual) return
    setSeleccionados((prev) =>
      prev.size === catActual.items.length ? new Set() : new Set(catActual.items.map((i) => i.id))
    )
  }

  async function eliminarDatosSeleccionados() {
    try {
      await Promise.all([...seleccionados].map((id) => ordenesService.limpiarResultado(id)))
      setSeleccionados(new Set())
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  async function aplicarTextoASeleccionados() {
    try {
      await Promise.all(
        [...seleccionados].map((id) => {
          const item = catActual.items.find((i) => i.id === id)
          return ordenesService.guardarResultado(id, {
            resultado: columnaAplicar === "resultado" ? textoAplicar : (item.resultado ?? ""),
            detalle: columnaAplicar === "detalle" ? textoAplicar : (item.detalle ?? ""),
            observacion: columnaAplicar === "observacion" ? textoAplicar : (item.observacion ?? ""),
          })
        })
      )
      setAplicarAbierto(false)
      setTextoAplicar("")
      setSeleccionados(new Set())
      await recargar()
    } catch (e) {
      setError(e.message)
    }
  }

  if (cargando && !orden) {
    return (
      <AppShell titulo="Cargando…">
        <p className="text-sm text-ink-soft">Trayendo la orden…</p>
      </AppShell>
    )
  }

  if (error && !orden) {
    return (
      <AppShell titulo="Orden">
        <div className="rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          No se pudo abrir la orden: {error}
        </div>
      </AppShell>
    )
  }

  const p = orden.persona ?? {}
  const porcentaje = totales.total ? Math.round((totales.cargados / totales.total) * 100) : 0

  return (
    <AppShell
      titulo={`Orden N° ${orden.numero}`}
      subtitulo={`${p.apellido}, ${p.nombre} · ${orden.empresa?.razon_social ?? ""}`}
    >
      {/* Cabecera: volver, estado, e impresos */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTILO_ESTADO[orden.estado]}`}>
          {ETIQUETA_ESTADO[orden.estado]}
        </span>

        <div className="ml-auto flex gap-2">
          <MenuImpreso etiqueta="Hoja de ruta" onImprimir={() => imprimirHojaDeRuta(orden.id)} />
          {/* RNF-17 "0 opciones ajenas visibles": el protocolo es el
              informe integral que arma el médico laboral con todo el
              flujo consolidado — un profesional de una sola categoría
              (rayos, laboratorio, etc.) no tiene que ver este botón,
              aunque la orden ya esté informada. */}
          {orden.estado === "INFORMADA" && sesion?.roles?.includes(ROL.MEDICO_LABORAL) && (
            <MenuImpreso
              etiqueta={`Protocolo (${ETIQUETA_APTITUD[orden.aptitud]})`}
              destacado
              onImprimir={() => imprimirProtocolo(orden.id)}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Contador de toda la orden + filtro de la grilla de categorías */}
      <div className="mb-4 rounded-card border-2 border-ink-soft/15 bg-white px-5 py-3.5">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <p className="text-xl font-semibold text-ink">
              {totales.cargados} <span className="text-sm font-normal text-ink-soft">/ {totales.total}</span>
            </p>
            <p className="text-[11px] text-ink-soft">estudios cargados</p>
          </div>

          <div className="h-1.5 flex-1 rounded-full bg-ink-soft/10">
            <div
              className={`h-1.5 rounded-full transition-[width] duration-200 ${porcentaje === 100 ? "bg-success" : "bg-primary"}`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          <div className="flex shrink-0 gap-1 rounded-md border-2 border-ink-soft/15 p-0.5">
            {FILTROS.map((f) => {
              const cantidad =
                f.key === "pendientes"
                  ? categoriasConAvance.filter((c) => !c.completa).length
                  : f.key === "completas"
                    ? categoriasConAvance.filter((c) => c.completa).length
                    : categoriasConAvance.length
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    filtro === f.key ? "bg-primary text-white" : "text-ink-soft hover:bg-ink-soft/5"
                  }`}
                >
                  {f.label} ({cantidad})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grilla 1 · categorías — compacta, 3 por fila */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {categoriasFiltradas.length === 0 && (
          <p className="col-span-3 py-4 text-center text-sm text-ink-soft">
            No hay categorías {filtro === "pendientes" ? "pendientes" : "completas"}.
          </p>
        )}
        {categoriasFiltradas.map((c) => {
          const esDeMiArea = sesion?.roles?.includes(c.rol_carga)
          const Icono = ICONO_CATEGORIA[c.nombre] ?? Circle
          const seleccionada = categoriaSel === c.id
          return (
            <button
              key={c.id}
              onClick={() => elegirCategoria(c.id)}
              className={`flex items-center gap-3 rounded-card border-2 p-3 text-left transition-colors ${
                seleccionada
                  ? "border-primary bg-primary/5"
                  : c.completa
                    ? "border-success/30 bg-success/5 hover:border-success/50"
                    : "border-ink-soft/15 bg-white hover:border-primary/40"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 ${
                  seleccionada
                    ? "border-primary bg-primary text-white"
                    : c.completa
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-primary/25 bg-primary/10 text-primary"
                }`}
              >
                <Icono size={22} strokeWidth={1.75} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-ink">{c.nombre}</p>
                  {c.completa && <CheckCircle2 size={14} className="shrink-0 text-success" />}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="h-1 flex-1 rounded-full bg-ink-soft/10">
                    <div
                      className={`h-1 rounded-full ${c.completa ? "bg-success" : "bg-primary"}`}
                      style={{ width: `${c.total ? (c.cargados / c.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium ${c.completa ? "text-success" : "text-ink-soft"}`}>
                    {c.cargados}/{c.total}
                  </span>
                </div>
                {!esDeMiArea && <p className="mt-0.5 text-[10px] text-ink-soft">Categoría ajena</p>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Grilla 2 · estudios de la categoría elegida */}
      {catActual && (
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                {(() => {
                  const Icono = ICONO_CATEGORIA[catActual.nombre] ?? Circle
                  return <Icono size={16} strokeWidth={1.75} />
                })()}
              </span>
              <h3 className="text-base font-medium text-ink">{catActual.nombre}</h3>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {seleccionados.size > 0 && (
                <div className="flex items-center gap-1.5 rounded-md border-2 border-primary/40 bg-primary/5 px-2.5 py-1.5">
                  <span className="mr-1 text-xs font-medium text-primary">{seleccionados.size} seleccionado{seleccionados.size === 1 ? "" : "s"}</span>
                  <button
                    onClick={() => setAplicarAbierto((v) => !v)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <PencilLine size={13} /> Mismo valor
                  </button>
                  <button
                    onClick={eliminarDatosSeleccionados}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    <Eraser size={13} /> Eliminar datos
                  </button>
                  <button
                    onClick={() => {
                      setSeleccionados(new Set())
                      setAplicarAbierto(false)
                    }}
                    title="Cancelar selección"
                    className="rounded p-1 text-ink-soft hover:bg-ink-soft/10 hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <button
                onClick={cargarCategoriaCompleta}
                disabled={catActual.completa}
                className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-soft/15 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
              >
                <CheckCheck size={14} /> Cargar toda en {catActual.valor_defecto ?? "NORMAL"}
              </button>
            </div>
          </div>

          {/* Nunca visible sin selección activa: si se vacía la selección
              por otra vía (p.ej. "Eliminar datos" con el panel abierto),
              el panel se cierra solo en vez de quedar huérfano. */}
          {aplicarAbierto && seleccionados.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border-2 border-primary/30 bg-primary/5 p-3">
              <span className="text-xs font-medium text-ink">Poner en</span>
              <select
                value={columnaAplicar}
                onChange={(e) => setColumnaAplicar(e.target.value)}
                className="rounded-md border-2 border-ink-soft/20 bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-primary"
              >
                {COLUMNAS_APLICABLES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="text-xs font-medium text-ink">el texto</span>
              <input
                autoFocus
                value={textoAplicar}
                onChange={(e) => setTextoAplicar(e.target.value)}
                placeholder="ej. NORMAL"
                className="w-40 rounded-md border-2 border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
              <span className="text-xs text-ink-soft">
                en los {seleccionados.size} estudios seleccionados
              </span>
              <button
                onClick={aplicarTextoASeleccionados}
                disabled={!textoAplicar}
                className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          )}

          {avisoCategoria && (
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 size={14} /> {avisoCategoria}
            </p>
          )}

          {/* Antes solo había un "1/1" chico y un tilde — no quedaba claro
              cuándo una categoría estaba realmente terminada. Este aviso es
              la confirmación explícita: aparece solo, no hace falta tocar
              nada más para "cerrarla" (el guardado ya es automático por
              campo), pero deja bien visible que no falta nada acá. */}
          {catActual.completa && (
            <div className="mb-4 flex items-center gap-3 rounded-md border-2 border-success/30 bg-success/5 px-4 py-3">
              <CheckCircle2 size={20} className="shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Categoría completa</p>
                <p className="text-xs text-ink-soft">
                  Ya cargaste los {catActual.total} estudios de {catActual.nombre}. No falta nada más acá.
                </p>
              </div>
            </div>
          )}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="rounded-md bg-ink-soft/5 text-xs font-semibold text-ink">
                <th className="w-9 rounded-l-md py-2.5 pl-3">
                  <input
                    type="checkbox"
                    checked={seleccionados.size > 0 && seleccionados.size === catActual.items.length}
                    onChange={alternarSeleccionTodos}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-2 border-ink-soft/30 accent-primary"
                  />
                </th>
                <th className="py-2.5 pl-1">Estudio</th>
                <th className="py-2.5">Resultado</th>
                <th className="py-2.5">Valor</th>
                <th className="py-2.5">Referencia</th>
                <th className="rounded-r-md py-2.5">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-soft/10">
              {catActual.items.map((it) => (
                <FilaEstudio
                  key={it.id}
                  item={it}
                  seleccionado={seleccionados.has(it.id)}
                  onToggleSeleccion={() => alternarSeleccion(it.id)}
                  onGuardar={(campos) => guardarFila(it, campos)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}

function FilaEstudio({ item, seleccionado, onToggleSeleccion, onGuardar }) {
  const [resultado, setResultado] = useState(item.resultado ?? "")
  const [detalle, setDetalle] = useState(item.detalle ?? "")
  const [observacion, setObservacion] = useState(item.observacion ?? "")

  // El botón "cargar categoría completa" (y ahora también "eliminar
  // datos"/"mismo valor" en selección múltiple) actualizan el ITEM vía
  // recargar() en el padre, no esta fila directamente — sin este efecto
  // la fila seguía mostrando el valor viejo aunque la base ya tuviera el
  // nuevo. Misma key entre recargas, React reusa la instancia.
  useEffect(() => {
    setResultado(item.resultado ?? "")
    setDetalle(item.detalle ?? "")
    setObservacion(item.observacion ?? "")
  }, [item.resultado, item.detalle, item.observacion])

  const est = item.estudio
  const referencia = est.ref_h && est.ref_m ? `H ${est.ref_h} · M ${est.ref_m}` : est.ref_h || est.ref_m || "—"
  const cargado = item.estado === "CARGADO"
  // RF21: un DEVUELTO no es lo mismo que un PENDIENTE que nunca se tocó —
  // el médico laboral lo rechazó con un motivo, y eso hay que verlo acá,
  // no solo saber que "falta". Antes se veía igual que un pendiente común.
  const devuelto = item.estado === "DEVUELTO"

  function guardarSiCambio(campo, valor) {
    if (valor === (item[campo] ?? "")) return
    onGuardar({ resultado, detalle, observacion, [campo]: valor })
  }

  const inputClase = (base) =>
    `${base} rounded-md border-2 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-primary ${
      item.fuera_de_rango ? "border-warning/60 bg-warning/5 text-warning" : "border-ink-soft/15 hover:border-ink-soft/30"
    }`

  return (
    <>
      <tr className={seleccionado ? "bg-primary/5" : devuelto ? "bg-danger/5" : undefined}>
        <td className="py-2.5 pl-3">
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={onToggleSeleccion}
            className="h-3.5 w-3.5 cursor-pointer rounded border-2 border-ink-soft/30 accent-primary"
          />
        </td>
        <td className="py-2.5 pl-1 text-ink">
          <span className="inline-flex items-center gap-1.5">
            {cargado ? (
              <CheckCircle2 size={13} className="shrink-0 text-success" />
            ) : devuelto ? (
              <RotateCcw size={13} className="shrink-0 text-danger" />
            ) : (
              <Circle size={13} className="shrink-0 text-ink-soft/30" />
            )}
            {est.nombre}
            {est.unidad ? <span className="text-ink-soft"> ({est.unidad})</span> : null}
          </span>
        </td>
      <td className="py-2.5">
        <input
          className={inputClase("w-28")}
          value={resultado}
          onChange={(e) => setResultado(e.target.value)}
          onBlur={(e) => guardarSiCambio("resultado", e.target.value)}
        />
      </td>
      <td className="py-2.5">
        <div className="flex items-center gap-1.5">
          <input
            className={inputClase("w-24")}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            onBlur={(e) => guardarSiCambio("detalle", e.target.value)}
          />
          {item.fuera_de_rango && (
            <span className="whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              Fuera de rango
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 whitespace-nowrap text-xs text-ink-soft">{referencia}</td>
      <td className="py-2.5">
        <input
          className={inputClase("w-full")}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          onBlur={(e) => guardarSiCambio("observacion", e.target.value)}
        />
      </td>
      </tr>
      {devuelto && (
        <tr className="bg-danger/5">
          <td></td>
          <td colSpan={5} className="pb-2.5 pl-1">
            <p className="flex items-start gap-1.5 text-xs text-danger">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <b>El médico laboral lo devolvió:</b> {item.motivo_devolucion || "sin motivo registrado"}
              </span>
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
