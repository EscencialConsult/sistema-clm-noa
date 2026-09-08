import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Printer, ArrowLeft, CheckCheck, AlertTriangle } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { ordenesService } from "./services/ordenesService"
import { authService } from "../auth/services/authService"
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"
import { imprimirHojaDeRuta } from "../ordenes/imprimir/HojaDeRuta"
import { imprimirProtocolo } from "../aptitud/imprimir/Protocolo"

/* ---------------------------------------------------------------------
   ClickUp 06 · Pantalla de carga: las dos grillas (CU-07).
   Grilla de arriba: categorías de la orden, con su avance.
   Grilla de abajo: los estudios de la categoría elegida, para cargar.

   La lógica de negocio (fuera de rango, quién puede cargar qué,
   completar la orden) NO se resuelve acá — vive en la base (trigger y
   RLS, ver TRABAJAR.md). Esta pantalla solo llama al servicio y
   muestra lo que vuelve, incluido el error si RLS lo rechaza.
   --------------------------------------------------------------------- */

export default function CargaPage() {
  const { ordenId } = useParams()
  const navigate = useNavigate()
  const sesion = authService.getSesionActual()

  const [orden, setOrden] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaSel, setCategoriaSel] = useState(null)
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

  const catActual = categorias.find((c) => c.id === categoriaSel)

  const totales = useMemo(() => {
    const items = categorias.flatMap((c) => c.items)
    return {
      total: items.length,
      cargados: items.filter((i) => i.estado === "CARGADO").length,
    }
  }, [categorias])

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
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          No se pudo abrir la orden: {error}
        </div>
      </AppShell>
    )
  }

  const p = orden.persona ?? {}

  return (
    <AppShell
      titulo={`Orden N° ${orden.numero}`}
      subtitulo={`${p.apellido}, ${p.nombre} · ${orden.empresa?.razon_social ?? ""}`}
    >
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 px-3 py-2 text-xs text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver
        </button>
        <span className="rounded-full bg-ink-soft/10 px-2.5 py-1 text-xs text-ink-soft">
          {ETIQUETA_ESTADO[orden.estado]}
        </span>
        <span className="text-xs text-ink-soft">
          {totales.cargados} de {totales.total} estudios cargados
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => imprimirHojaDeRuta(orden.id)}
            className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 px-3 py-2 text-xs text-ink-soft hover:border-primary/40 hover:text-primary"
          >
            <Printer size={15} /> Hoja de ruta
          </button>
          {orden.estado === "INFORMADA" && (
            <button
              onClick={() => imprimirProtocolo(orden.id)}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/5"
            >
              <Printer size={15} /> Protocolo ({ETIQUETA_APTITUD[orden.aptitud]})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grilla 1 · categorías */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {categorias.map((c) => {
          const cargadosCat = c.items.filter((i) => i.estado === "CARGADO").length
          const completa = cargadosCat === c.items.length
          const esDeMiArea = sesion?.roles?.includes(c.rol_carga)
          return (
            <button
              key={c.id}
              onClick={() => {
                setCategoriaSel(c.id)
                setAvisoCategoria(null)
              }}
              className={`rounded-card border p-3.5 text-left transition-colors ${
                categoriaSel === c.id
                  ? "border-primary bg-primary/5"
                  : "border-ink-soft/10 bg-white hover:border-primary/30"
              }`}
            >
              <p className="text-sm font-medium text-ink">
                {c.nombre}
                {!esDeMiArea && <span className="ml-1 text-ink-soft">· ajena</span>}
              </p>
              <p className={`text-xs ${completa ? "text-success" : "text-ink-soft"}`}>
                {cargadosCat} / {c.items.length} cargados
              </p>
            </button>
          )
        })}
      </div>

      {/* Grilla 2 · estudios de la categoría elegida */}
      {catActual && (
        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">{catActual.nombre}</h3>
            <button
              onClick={cargarCategoriaCompleta}
              className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 px-3 py-1.5 text-xs text-ink-soft hover:border-primary/40 hover:text-primary"
            >
              <CheckCheck size={14} /> Cargar toda la categoría en {catActual.valor_defecto ?? "NORMAL"}
            </button>
          </div>

          {avisoCategoria && <p className="mb-3 text-xs text-success">{avisoCategoria}</p>}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="pb-2 font-normal">Estudio</th>
                <th className="pb-2 font-normal">Resultado</th>
                <th className="pb-2 font-normal">Valor</th>
                <th className="pb-2 font-normal">Referencia</th>
                <th className="pb-2 font-normal">Observación</th>
              </tr>
            </thead>
            <tbody>
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

  const est = item.estudio
  const referencia = est.ref_h && est.ref_m ? `H ${est.ref_h} · M ${est.ref_m}` : est.ref_h || est.ref_m || "—"

  function guardarSiCambio(campo, valor) {
    if (valor === (item[campo] ?? "")) return
    onGuardar({ resultado, detalle, observacion, [campo]: valor })
  }

  return (
    <tr className="border-t border-ink-soft/10">
      <td className="py-2 text-ink">
        {est.nombre}
        {est.unidad ? <span className="text-ink-soft"> ({est.unidad})</span> : null}
      </td>
      <td className="py-2">
        <input
          className={`w-28 rounded-md border px-2 py-1 text-xs outline-none focus:border-primary ${
            item.fuera_de_rango ? "border-warning bg-warning/5 text-warning" : "border-ink-soft/20"
          }`}
          value={resultado}
          onChange={(e) => setResultado(e.target.value)}
          onBlur={(e) => guardarSiCambio("resultado", e.target.value)}
        />
      </td>
      <td className="py-2">
        <input
          className={`w-24 rounded-md border px-2 py-1 text-xs outline-none focus:border-primary ${
            item.fuera_de_rango ? "border-warning bg-warning/5 text-warning" : "border-ink-soft/20"
          }`}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          onBlur={(e) => guardarSiCambio("detalle", e.target.value)}
        />
        {item.fuera_de_rango && <span className="ml-1 text-[10px] text-warning">fuera de rango</span>}
      </td>
      <td className="py-2 whitespace-nowrap text-xs text-ink-soft">{referencia}</td>
      <td className="py-2">
        <input
          className="w-full rounded-md border border-ink-soft/20 px-2 py-1 text-xs outline-none focus:border-primary"
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          onBlur={(e) => guardarSiCambio("observacion", e.target.value)}
        />
      </td>
    </tr>
  )
}
