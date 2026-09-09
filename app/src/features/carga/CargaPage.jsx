import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Printer,
  Download,
  ArrowLeft,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
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
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"
import { imprimirHojaDeRuta } from "../ordenes/imprimir/HojaDeRuta"
import { imprimirProtocolo, descargarProtocoloPdf } from "../aptitud/imprimir/Protocolo"

/* ---------------------------------------------------------------------
   ClickUp 06 · Pantalla de carga: las dos grillas (CU-07).
   Grilla de arriba: categorías de la orden, con su avance.
   Grilla de abajo: los estudios de la categoría elegida, para cargar.

   La lógica de negocio (fuera de rango, quién puede cargar qué,
   completar la orden) NO se resuelve acá — vive en la base (trigger y
   RLS, ver TRABAJAR.md). Esta pantalla solo llama al servicio y
   muestra lo que vuelve, incluido el error si RLS lo rechaza.
   --------------------------------------------------------------------- */

// Mismo tratamiento de tarjeta que ya usa el Dashboard (border-2/15%, no
// border/10% — con 1px se leía "vacío/genérico", ver DESIGN.md).
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

const ESTADO_ESTILO = {
  ABIERTA: "bg-warning/10 text-warning",
  EN_CURSO: "bg-accent/15 text-primary",
  COMPLETA: "bg-success/10 text-success",
  INFORMADA: "bg-ink-soft/10 text-ink-soft",
}

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "pendientes", label: "Pendientes" },
  { key: "completas", label: "Completas" },
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
    return {
      total: items.length,
      cargados: items.filter((i) => i.estado === "CARGADO").length,
      pendientes: items.filter((i) => i.estado !== "CARGADO").length,
    }
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
      {/* Cabecera: volver, estado, e impresos — la única fila con acciones globales */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTADO_ESTILO[orden.estado]}`}>
          {ETIQUETA_ESTADO[orden.estado]}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => imprimirHojaDeRuta(orden.id)}
            className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
          >
            <Printer size={15} /> Hoja de ruta
          </button>
          {orden.estado === "INFORMADA" && (
            <>
              <button
                onClick={() => imprimirProtocolo(orden.id)}
                className="flex items-center gap-1.5 rounded-md border-2 border-primary/50 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
              >
                <Printer size={15} /> Protocolo ({ETIQUETA_APTITUD[orden.aptitud]})
              </button>
              <button
                onClick={() => descargarProtocoloPdf(orden.id)}
                title="Descargar el protocolo como PDF (RF23) — para mandar por mail a una empresa de otra provincia sin escanear"
                className="flex items-center gap-1.5 rounded-md border-2 border-primary/50 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
              >
                <Download size={15} /> Descargar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* El contador: cuánto falta de la orden entera, no solo de la categoría
          abierta — y sirve de filtro para la grilla de categorías de abajo. */}
      <div className="mb-5 rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <p className="text-2xl font-semibold text-ink">
              {totales.cargados} <span className="text-base font-normal text-ink-soft">/ {totales.total}</span>
            </p>
            <p className="text-xs text-ink-soft">estudios cargados</p>
          </div>

          <div className="h-2 flex-1 rounded-full bg-ink-soft/10">
            <div
              className={`h-2 rounded-full transition-[width] duration-200 ${
                porcentaje === 100 ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          <div className="flex shrink-0 gap-1 rounded-md border-2 border-ink-soft/15 p-1">
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
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
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

      {/* Grilla 1 · categorías */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {categoriasFiltradas.length === 0 && (
          <p className="col-span-4 py-4 text-center text-sm text-ink-soft">
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
              onClick={() => {
                setCategoriaSel(c.id)
                setAvisoCategoria(null)
              }}
              className={`rounded-card border-2 p-4 text-left transition-colors ${
                seleccionada
                  ? "border-primary bg-primary/5"
                  : c.completa
                    ? "border-success/30 bg-success/5 hover:border-success/50"
                    : "border-ink-soft/15 bg-white hover:border-primary/40"
              }`}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-md ${
                    seleccionada ? "bg-primary/15 text-primary" : c.completa ? "bg-success/15 text-success" : "bg-ink-soft/10 text-ink-soft"
                  }`}
                >
                  <Icono size={18} strokeWidth={1.75} />
                </span>
                {c.completa && <CheckCircle2 size={17} className="text-success" />}
              </div>

              <p className="text-sm font-medium text-ink">{c.nombre}</p>
              {!esDeMiArea && <p className="text-xs text-ink-soft">Categoría ajena</p>}

              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-ink-soft/10">
                  <div
                    className={`h-1.5 rounded-full ${c.completa ? "bg-success" : "bg-primary"}`}
                    style={{ width: `${c.total ? (c.cargados / c.total) * 100 : 0}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${c.completa ? "text-success" : "text-ink-soft"}`}>
                  {c.cargados}/{c.total}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Grilla 2 · estudios de la categoría elegida */}
      {catActual && (
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                {(() => {
                  const Icono = ICONO_CATEGORIA[catActual.nombre] ?? Circle
                  return <Icono size={16} strokeWidth={1.75} />
                })()}
              </span>
              <h3 className="text-base font-medium text-ink">{catActual.nombre}</h3>
            </div>
            <button
              onClick={cargarCategoriaCompleta}
              disabled={catActual.completa}
              className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-soft/15 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
            >
              <CheckCheck size={14} /> Cargar toda la categoría en {catActual.valor_defecto ?? "NORMAL"}
            </button>
          </div>

          {avisoCategoria && (
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 size={14} /> {avisoCategoria}
            </p>
          )}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink-soft/10 text-xs text-ink-soft">
                <th className="w-6 pb-2.5 font-normal"></th>
                <th className="pb-2.5 font-normal">Estudio</th>
                <th className="pb-2.5 font-normal">Resultado</th>
                <th className="pb-2.5 font-normal">Valor</th>
                <th className="pb-2.5 font-normal">Referencia</th>
                <th className="pb-2.5 font-normal">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-soft/10">
              {catActual.items.map((it) => (
                <FilaEstudio key={it.id} item={it} onGuardar={(campos) => guardarFila(it, campos)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}

function FilaEstudio({ item, onGuardar }) {
  const [resultado, setResultado] = useState(item.resultado ?? "")
  const [detalle, setDetalle] = useState(item.detalle ?? "")
  const [observacion, setObservacion] = useState(item.observacion ?? "")

  // El botón "cargar categoría completa" actualiza el ITEM (vía recargar()
  // en el padre), no esta fila directamente — sin este efecto, la fila
  // seguía mostrando el campo vacío aunque el valor ya estuviera guardado
  // en la base. Es el mismo estudio (misma key), React reusa la instancia.
  useEffect(() => {
    setResultado(item.resultado ?? "")
    setDetalle(item.detalle ?? "")
    setObservacion(item.observacion ?? "")
  }, [item.resultado, item.detalle, item.observacion])

  const est = item.estudio
  const referencia = est.ref_h && est.ref_m ? `H ${est.ref_h} · M ${est.ref_m}` : est.ref_h || est.ref_m || "—"
  const cargado = item.estado === "CARGADO"

  function guardarSiCambio(campo, valor) {
    if (valor === (item[campo] ?? "")) return
    onGuardar({ resultado, detalle, observacion, [campo]: valor })
  }

  const inputClase = (base) =>
    `${base} rounded-md border-2 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-primary ${
      item.fuera_de_rango ? "border-warning/60 bg-warning/5 text-warning" : "border-ink-soft/15 hover:border-ink-soft/30"
    }`

  return (
    <tr className="group">
      <td className="py-2.5">
        {cargado ? (
          <CheckCircle2 size={15} className="text-success" />
        ) : (
          <Circle size={15} className="text-ink-soft/30" />
        )}
      </td>
      <td className="py-2.5 text-ink">
        {est.nombre}
        {est.unidad ? <span className="text-ink-soft"> ({est.unidad})</span> : null}
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
  )
}
