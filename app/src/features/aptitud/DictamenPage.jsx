import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Printer, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { aptitudService } from "./services/aptitudService"
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"
import { imprimirProtocolo } from "./imprimir/Protocolo"

/* ---------------------------------------------------------------------
   ClickUp · Aptitud y legajo — CU-11, RF22/RF23.

   El médico laboral lee la orden completa y dictamina. Tres cosas que
   esta pantalla NO hace, a propósito:

   · No comprueba que la orden esté completa. Lo hace emitir_protocolo()
     y devuelve «Quedan N estudios sin cargar» (CP-19). Si lo repitiéramos
     acá, el día que las dos versiones no coincidan gana la de la base y
     la pantalla mentiría.
   · No comprueba el rol. La misma función rechaza a cualquiera que no
     sea médico laboral, incluido el Administrador (CP-21).
   · No elige la matrícula. Sale del usuario de la sesión: cada médico
     firma con la suya.

   Lo único que decide la pantalla es qué mostrar primero: los valores
   fuera de rango arriba, que es lo que se mira para dictaminar.
   --------------------------------------------------------------------- */

const APTITUDES = [
  { valor: "APTO", label: "Apto", icono: ShieldCheck,
    activo: "border-success bg-success/10 text-success" },
  { valor: "NO_APTO", label: "No apto", icono: ShieldX,
    activo: "border-danger bg-danger/10 text-danger" },
]

export default function DictamenPage() {
  const { ordenId } = useParams()
  const navigate = useNavigate()

  const [orden, setOrden] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [aptitud, setAptitud] = useState(null)
  const [preexistencias, setPreexistencias] = useState("")
  const [incapacidad, setIncapacidad] = useState("")
  const [observaciones, setObservaciones] = useState("")

  async function recargar() {
    setCargando(true)
    try {
      const [o, cats] = await Promise.all([
        aptitudService.getOrden(ordenId),
        aptitudService.getEstudiosDeOrden(ordenId),
      ])
      setOrden(o)
      setCategorias(cats)
      setAptitud(o.aptitud === "PENDIENTE" ? null : o.aptitud)
      setPreexistencias(o.preexistencias ?? "")
      setIncapacidad(o.incapacidad_pct ?? "")
      setObservaciones(o.observaciones ?? "")
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

  const fueraDeRango = useMemo(
    () => categorias.flatMap((c) => c.items.filter((i) => i.fuera_de_rango)),
    [categorias]
  )
  const sinCargar = useMemo(
    () => categorias.flatMap((c) => c.items.filter((i) => i.estado !== "CARGADO")),
    [categorias]
  )

  async function dictaminar() {
    if (!aptitud) return
    setGuardando(true)
    setError(null)
    try {
      await aptitudService.emitir(ordenId, { aptitud, preexistencias, incapacidad, observaciones })
      await recargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
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
      <AppShell titulo="Aptitud">
        <div className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          No se pudo abrir la orden: {error}
        </div>
      </AppShell>
    )
  }

  const p = orden.persona ?? {}
  const informada = orden.estado === "INFORMADA"

  return (
    <AppShell
      titulo={`Aptitud · Orden N° ${orden.numero}`}
      subtitulo={`${p.apellido_nombre} · ${p.documento} · ${orden.empresa?.razon_social ?? ""}`}
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
        {informada && (
          <button
            onClick={() => imprimirProtocolo(orden.id)}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/5"
          >
            <Printer size={15} /> Protocolo ({ETIQUETA_APTITUD[orden.aptitud]})
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {informada && (
        <div className="mb-5 rounded-card border border-success/30 bg-success/5 p-4 text-sm">
          <p className="font-medium text-success">
            Informada como {ETIQUETA_APTITUD[orden.aptitud]}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Firmó {orden.medico_laboral?.apellido_nombre ?? "—"}
            {orden.medico_laboral?.matricula_prov && ` · M.P. ${orden.medico_laboral.matricula_prov}`}
            {orden.medico_laboral?.matricula_nac && ` · M.N. ${orden.medico_laboral.matricula_nac}`}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            Los resultados quedaron bloqueados. Para corregir algo hay que reabrir la
            orden dejando el motivo por escrito (CU-08).
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Lo que hay que mirar */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="rounded-card border border-ink-soft/10 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">
              Valores fuera de rango ({fueraDeRango.length})
            </p>
            {fueraDeRango.length === 0 ? (
              <p className="text-xs text-ink-soft">
                Ningún valor quedó fuera de su rango de referencia.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-ink-soft">
                    <th className="pb-2 font-normal">Estudio</th>
                    <th className="pb-2 font-normal">Valor</th>
                    <th className="pb-2 font-normal">Referencia</th>
                    <th className="pb-2 font-normal">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {fueraDeRango.map((i) => (
                    <tr key={i.id} className="border-t border-ink-soft/10">
                      <td className="py-2 text-ink">{i.estudio.nombre}</td>
                      <td className="py-2 font-medium text-warning">
                        {i.detalle || i.resultado || "—"}
                        {i.estudio.unidad ? ` ${i.estudio.unidad}` : ""}
                      </td>
                      <td className="py-2 whitespace-nowrap text-xs text-ink-soft">
                        {p.sexo === "F" ? i.estudio.ref_m : i.estudio.ref_h}
                      </td>
                      <td className="py-2 text-xs text-ink-soft">{i.observacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-card border border-ink-soft/10 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">Todos los estudios</p>
            {categorias.map((c) => (
              <div key={c.id} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-soft">
                  {c.nombre}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {c.items.map((i) => (
                    <span
                      key={i.id}
                      className={
                        i.estado !== "CARGADO"
                          ? "text-danger"
                          : i.fuera_de_rango
                            ? "text-warning"
                            : "text-ink-soft"
                      }
                    >
                      {i.estudio.nombre}: {i.detalle || i.resultado || "sin cargar"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* El dictamen */}
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-ink-soft/10 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">Dictamen</p>

            {sinCargar.length > 0 && (
              <p className="mb-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                Quedan {sinCargar.length} estudio{sinCargar.length === 1 ? "" : "s"} sin cargar.
                No se puede informar hasta que estén todos.
              </p>
            )}

            <div className="mb-4 flex gap-2">
              {APTITUDES.map(({ valor, label, icono: Icono, activo }) => (
                <button
                  key={valor}
                  disabled={informada}
                  onClick={() => setAptitud(valor)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                    aptitud === valor ? activo : "border-ink-soft/20 text-ink-soft hover:border-primary/40"
                  }`}
                >
                  <Icono size={16} /> {label}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs text-ink-soft">Preexistencias</label>
            <textarea
              disabled={informada}
              rows={3}
              value={preexistencias}
              onChange={(e) => setPreexistencias(e.target.value)}
              placeholder="Lo que se detectó y queda registrado"
              className="mb-1 w-full rounded-md border border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
            />
            <p className="mb-3 text-[11px] text-ink-soft">
              Registrar una preexistencia no cambia la aptitud: se puede ser apto y
              tenerla anotada (CP-20).
            </p>

            <label className="mb-1 block text-xs text-ink-soft">Incapacidad (%)</label>
            <input
              disabled={informada}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={incapacidad}
              onChange={(e) => setIncapacidad(e.target.value)}
              className="mb-3 w-full rounded-md border border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
            />

            <label className="mb-1 block text-xs text-ink-soft">
              Especialidades / observaciones
            </label>
            <textarea
              disabled={informada}
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mb-4 w-full rounded-md border border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
            />

            {!informada && (
              <button
                onClick={dictaminar}
                disabled={!aptitud || guardando}
                className="w-full rounded-md bg-primary px-3 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {guardando ? "Emitiendo…" : "Emitir protocolo"}
              </button>
            )}
          </div>

          <div className="rounded-card border border-ink-soft/10 bg-white p-5 text-xs text-ink-soft">
            <p className="mb-2 font-medium text-ink">Paciente</p>
            <p>{p.apellido_nombre}</p>
            <p>{p.documento}</p>
            <p>{p.sexo === "F" ? "Femenino" : "Masculino"}</p>
            <p className="mt-2">{orden.empresa?.razon_social}</p>
            {orden.tarea && <p>Tarea: {orden.tarea}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
