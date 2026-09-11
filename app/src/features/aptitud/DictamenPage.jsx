import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Printer, AlertTriangle, ShieldCheck, ShieldX, Undo2, X, Check, ChevronRight, PencilLine } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { aptitudService } from "./services/aptitudService"
import { authService } from "../auth/services/authService"
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD, ESTILO_ESTADO, ROL } from "../../types/dominio"
import MenuImpreso from "../../shared/impresos/MenuImpreso"
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

  /* Quién puede dictaminar. No reemplaza al control de la base —esa
     sigue rechazando a cualquier otro— sino que evita mostrar botones
     que no se van a poder usar. */
  const sesion = authService.getSesionActual()
  const esMedicoLaboral = !!sesion?.roles?.includes(ROL.MEDICO_LABORAL)
  /* Recepción transcribe la aptitud que el médico dictaminó en papel:
     es lo que se hace hoy en la clínica. Lo que no puede es firmar con
     su propia matrícula, así que tiene que elegir de quién es la firma. */
  const transcribe = !esMedicoLaboral &&
    (sesion?.roles?.includes(ROL.RECEPCION) || sesion?.roles?.includes(ROL.ADMINISTRADOR))
  const puedeDictaminar = esMedicoLaboral || transcribe

  const [aptitud, setAptitud] = useState(null)
  const [medicoId, setMedicoId] = useState("")
  const [medicos, setMedicos] = useState([])
  const [preexistencias, setPreexistencias] = useState("")
  const [incapacidad, setIncapacidad] = useState("")
  const [observaciones, setObservaciones] = useState("")
  /* Categorías desplegadas a mano. Las que tienen algo raro se abren
     solas; ésta guarda las que el médico abrió además de esas. */
  const [abiertas, setAbiertas] = useState([])
  const [devolviendo, setDevolviendo] = useState(null)
  const [motivo, setMotivo] = useState("")

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
    if (!transcribe) return
    aptitudService.getMedicosFirmantes().then(setMedicos).catch(() => setMedicos([]))
  }, [transcribe])

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId])

  const fueraDeRango = useMemo(
    () => categorias.flatMap((c) => c.items.filter((i) => i.fuera_de_rango)),
    [categorias]
  )

  /* La primera categoría que tiene algo sin cargar: es a donde manda el
     atajo del aviso. Se saca de las categorías y no cavando en el primer
     item, para no depender de que el servicio siga anidando la categoría
     adentro del estudio. */
  const primeraSinCargar = categorias.find((c) =>
    c.items.some((i) => i.estado !== "CARGADO" && i.estado !== "DEVUELTO")
  )

  /* Qué le pasa a cada categoría. Lo que decide si se abre sola y con
     qué color se marca: fuera de rango, devuelto o sin cargar. */
  const resumenCategoria = (c) => {
    const fuera = c.items.filter((i) => i.fuera_de_rango).length
    const devueltos = c.items.filter((i) => i.estado === "DEVUELTO").length
    const faltan = c.items.filter((i) => i.estado !== "CARGADO" && i.estado !== "DEVUELTO").length
    return { fuera, devueltos, faltan, hayAlgo: fuera + devueltos + faltan > 0 }
  }

  const sinCargar = useMemo(
    () => categorias.flatMap((c) => c.items.filter((i) => i.estado !== "CARGADO")),
    [categorias]
  )

  async function dictaminar() {
    if (!aptitud) return
    setGuardando(true)
    setError(null)
    try {
      await aptitudService.emitir(ordenId, { aptitud, preexistencias, incapacidad, observaciones, medicoId })
      await recargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  /* RF21 · devolver con motivo. La orden vuelve sola a EN_CURSO: eso lo
     hace el trigger de la base, no esta pantalla. */
  async function devolver(e) {
    e.preventDefault()
    setError(null)
    try {
      await aptitudService.devolverEstudio(devolviendo.id, motivo)
      setDevolviendo(null)
      setMotivo("")
      await recargar()
    } catch (err) {
      setError(err.message)
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
        <div className="rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
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
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/20 px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTILO_ESTADO[orden.estado]}`}>
          {ETIQUETA_ESTADO[orden.estado]}
        </span>
        {informada && (
          <div className="ml-auto">
            <MenuImpreso
              etiqueta={`Protocolo (${ETIQUETA_APTITUD[orden.aptitud]})`}
              destacado
              onImprimir={() => imprimirProtocolo(orden.id)}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {informada && (
        <div className="mb-5 rounded-card border-2 border-success/30 bg-success/5 p-4 text-sm">
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

      <div className="grid max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* Lo que hay que mirar */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Sin nada fuera de rango esto era una tarjeta entera para decir
              que no hay nada. Con algo, es lo más importante de la pantalla
              y ahí sí ocupa lo que tiene que ocupar. */}
          {fueraDeRango.length === 0 ? (
            <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success/[0.06] px-4 py-3">
              <Check size={16} className="shrink-0 text-success" />
              <p className="text-sm text-ink">
                Ningún valor quedó fuera de su rango de referencia.
              </p>
            </div>
          ) : (
            <div className="rounded-card border-2 border-warning/40 bg-warning/[0.05] p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
                <AlertTriangle size={16} />
                {fueraDeRango.length} valor{fueraDeRango.length === 1 ? "" : "es"} fuera de rango
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] text-ink-soft">
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
            </div>
          )}

          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <p className="mb-4 text-base font-semibold text-ink">Todos los estudios</p>
            {categorias.map((c) => {
              const r = resumenCategoria(c)
              const abierta = r.hayAlgo || abiertas.includes(c.id)
              return (
                <div key={c.id} className="mb-2 overflow-hidden rounded-lg border border-ink-soft/15 last:mb-0">
                  {/* La cabecera dice sola si hay que mirar adentro. Las
                      categorías con algo raro se abren y no se pueden cerrar:
                      son justo las que el médico vino a ver. */}
                  <button
                    onClick={() => !r.hayAlgo && setAbiertas((p) =>
                      p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]
                    )}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left ${
                      r.hayAlgo
                        ? "cursor-default bg-warning/[0.06]"
                        : "hover:bg-ink-soft/[0.03]"
                    }`}
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 transition-transform ${
                        abierta ? "rotate-90" : ""
                      } ${r.hayAlgo ? "text-warning" : "text-ink-soft/50"}`}
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">{c.nombre}</span>

                    {r.fuera > 0 && (
                      <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        {r.fuera} fuera de rango
                      </span>
                    )}
                    {r.devueltos > 0 && (
                      <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">
                        {r.devueltos} devuelto{r.devueltos === 1 ? "" : "s"}
                      </span>
                    )}
                    {r.faltan > 0 && (
                      <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">
                        {r.faltan} sin cargar
                      </span>
                    )}
                    {/* El atajo va donde se lee el problema. Sin esto había
                        que volver, entrar a la orden y buscar la categoría
                        entre nueve, con el paciente esperando. */}
                    {r.faltan > 0 && !informada && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          navigate(`/carga/${ordenId}?categoria=${c.id}`)
                        }}
                        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") navigate(`/carga/${ordenId}?categoria=${c.id}`) }}
                        title="Abrir la carga en esta categoría"
                        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        <PencilLine size={12} /> Ir a cargarlo
                      </span>
                    )}
                    {!r.hayAlgo && (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-success">
                        <Check size={12} /> todo en orden
                      </span>
                    )}
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-ink-soft">
                      {c.items.length} est.
                    </span>
                  </button>

                  {/* Nombre y valor en columnas, no un párrafo corrido: lo
                      que se busca es un valor, y los valores se comparan
                      cuando están alineados. */}
                  {abierta && (
                    <div className="grid gap-x-6 gap-y-px border-t border-ink-soft/10 bg-ink-soft/[0.02] p-2 sm:grid-cols-2 xl:grid-cols-3">
                      {c.items.map((i) => {
                        const devuelto = i.estado === "DEVUELTO"
                        const falta = i.estado !== "CARGADO" && !devuelto
                        return (
                          <div
                            key={i.id}
                            className={`group flex items-baseline gap-2 rounded px-2 py-1 text-xs ${
                              devuelto || falta
                                ? "bg-danger/[0.06]"
                                : i.fuera_de_rango
                                  ? "bg-warning/[0.08]"
                                  : ""
                            }`}
                            title={i.motivo_devolucion ? `Devuelto: ${i.motivo_devolucion}` : undefined}
                          >
                            <span className="min-w-0 flex-1 truncate text-ink-soft">{i.estudio.nombre}</span>
                            <span
                              className={`shrink-0 font-medium ${
                                devuelto || falta
                                  ? "text-danger"
                                  : i.fuera_de_rango
                                    ? "text-warning"
                                    : "text-ink"
                              }`}
                            >
                              {devuelto ? "devuelto" : (i.detalle || i.resultado || "sin cargar")}
                              {i.detalle && i.estudio.unidad ? ` ${i.estudio.unidad}` : ""}
                            </span>
                            {/* La flecha de devolver aparece al pasar por
                                encima: 52 flechitas fijas eran más ruido que
                                los resultados. */}
                            {!informada && i.estado === "CARGADO" && (
                              <button
                                onClick={() => { setDevolviendo(i); setMotivo("") }}
                                title="Devolver al profesional que lo cargó"
                                className="shrink-0 text-ink-soft/40 opacity-0 hover:text-danger group-hover:opacity-100"
                              >
                                <Undo2 size={12} />
                              </button>
                            )}
                            {!informada && falta && (
                              <button
                                onClick={() => navigate(`/carga/${ordenId}?categoria=${c.id}`)}
                                title="Abrir la carga en esta categoría"
                                className="shrink-0 text-primary hover:opacity-70"
                              >
                                <PencilLine size={12} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* El dictamen */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <p className="mb-4 text-base font-semibold text-ink">Dictamen</p>

            {sinCargar.length > 0 && (
              <div className="mb-3 rounded-md border-2 border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                <p>
                  Quedan {sinCargar.length} estudio{sinCargar.length === 1 ? "" : "s"} sin cargar.
                  No se puede informar hasta que estén todos.
                </p>
                {/* Es el primer cartel que se lee, así que también lleva:
                    va a la categoría del primero que falta. */}
                {!informada && (
                  <button
                    onClick={() =>
                      navigate(`/carga/${ordenId}${primeraSinCargar ? `?categoria=${primeraSinCargar.id}` : ""}`)
                    }
                    className="mt-2 flex items-center gap-1.5 rounded-md border border-warning/50 bg-white px-2.5 py-1.5 text-[11px] font-medium text-warning hover:bg-warning/10"
                  >
                    <PencilLine size={12} /> Ir a cargarlos
                  </button>
                )}
              </div>
            )}

            {/* Recepción llegaba acá desde el legajo y veía los botones
                Apto / No apto con un cartel diciéndole que no podía usarlos.
                Lo reportó Marcela probando el 9/9.

                La base ya la rechazaba —eso no cambia, es el control real—
                pero mostrar algo que no se puede usar es peor que no
                mostrarlo: hace dudar de si el problema es el permiso o el
                sistema. Es el criterio de RNF-17, "0 opciones ajenas
                visibles", el mismo con el que se ocultó el protocolo. */}
            {!puedeDictaminar && (
              <p className="mb-4 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs text-ink-soft">
                La aptitud la firma el médico laboral con su matrícula. Desde
                acá se ve todo el legajo, pero no se dictamina.
                {orden.aptitud !== "PENDIENTE" && (
                  <> Está dictaminada como <strong className="text-ink">{ETIQUETA_APTITUD[orden.aptitud]}</strong>.</>
                )}
              </p>
            )}

            {/* Quién firma. Sólo aparece cuando NO lo carga el médico: él
                firma con su matrícula, que sale de su sesión.

                Va antes de los botones a propósito. Es lo primero que hay
                que resolver: sin firmante, el protocolo sale sin matrícula
                y no sirve como documento. */}
            {transcribe && (
              <div className="mb-4">
                <label className="mb-1 block text-xs text-ink-soft">
                  Médico que firma <span className="text-danger">*</span>
                </label>
                <select
                  disabled={informada}
                  value={medicoId}
                  onChange={(e) => setMedicoId(e.target.value)}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary disabled:bg-ink-soft/5"
                >
                  <option value="">Elegir…</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.apellido_nombre}
                      {m.matricula_prov ? ` · M.P. ${m.matricula_prov}` : " · sin matrícula"}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">
                  La aptitud la dictamina el médico; acá se transcribe lo que firmó
                  en la planilla. En el protocolo va su matrícula, y en la auditoría
                  queda quién lo cargó.
                </p>
              </div>
            )}

            <div className={`mb-4 flex gap-2 ${puedeDictaminar ? "" : "hidden"}`}>
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

            <div className={puedeDictaminar ? "" : "hidden"}>
            <label className="mb-1 block text-xs text-ink-soft">Preexistencias</label>
            <textarea
              disabled={informada}
              rows={3}
              value={preexistencias}
              onChange={(e) => setPreexistencias(e.target.value)}
              placeholder="Lo que se detectó y queda registrado"
              className="mb-1 w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
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
              className="mb-3 w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
            />

            <label className="mb-1 block text-xs text-ink-soft">
              Especialidades / observaciones
            </label>
            <textarea
              disabled={informada}
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mb-4 w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-xs outline-none focus:border-primary disabled:bg-ink-soft/5"
            />

            {!informada && (
              <button
                onClick={dictaminar}
                disabled={!aptitud || guardando || (transcribe && !medicoId)}
                className="w-full rounded-md bg-primary px-3 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {guardando ? "Emitiendo…" : "Emitir protocolo"}
              </button>
            )}
            </div>
          </div>

          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5 text-xs text-ink-soft">
            <p className="mb-2 font-medium text-ink">Paciente</p>
            <p>{p.apellido_nombre}</p>
            <p>{p.documento}</p>
            <p>{p.sexo === "F" ? "Femenino" : "Masculino"}</p>
            <p className="mt-2">{orden.empresa?.razon_social}</p>
            {orden.tarea && <p>Tarea: {orden.tarea}</p>}
          </div>
        </div>
      </div>
      {devolviendo && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4">
          <form onSubmit={devolver} className="w-full max-w-lg rounded-card border-2 border-ink-soft/15 bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                Devolver {devolviendo.estudio.nombre}
              </p>
              <button type="button" onClick={() => setDevolviendo(null)} className="text-ink-soft hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-ink-soft">
              Vuelve a la bandeja de quien lo cargó y la orden deja de estar
              completa. El motivo es obligatorio: es lo único que le dice qué
              corregir.
            </p>
            <textarea
              autoFocus
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="El valor no coincide con el informe adjunto"
              className="mb-4 w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={!motivo.trim()}
                className="rounded-md bg-danger px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40">
                Devolver
              </button>
              <button type="button" onClick={() => setDevolviendo(null)}
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
