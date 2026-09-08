import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Printer,
  UserPlus,
  FolderOpen,
  CalendarClock,
  AlertTriangle,
} from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { ordenesService } from "./services/ordenesService"
import { alertasService } from "./services/alertasService"
import { ESTADO_ORDEN, ETIQUETA_ESTADO } from "../../types/dominio"
import { imprimirHojaDeRuta } from "../ordenes/imprimir/HojaDeRuta"

const TIPO_EXAMEN_LABEL = {
  PRELABORAL: "Prelaboral",
  PERIODICO: "Periódico",
  EGRESO: "Egreso",
}

// Colores semánticos (DESIGN.md: nunca el azul de marca para estado clínico/operativo)
const ESTADO_ESTILO = {
  ABIERTA: "bg-warning/10 text-warning",
  EN_CURSO: "bg-accent/15 text-primary",
  COMPLETA: "bg-success/10 text-success",
  INFORMADA: "bg-ink-soft/10 text-ink-soft",
}

const TABS = [{ key: "todos", label: "Todos" }, ...ESTADO_ORDEN.map((e) => ({ key: e, label: ETIQUETA_ESTADO[e] }))]

export default function BandejaProfesional() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [alertas, setAlertas] = useState([])
  const [tab, setTab] = useState("todos")
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  useEffect(() => {
    Promise.all([ordenesService.getOrdenesDelDia(), ordenesService.getEstudiosPendientes()])
      .then(([ords, pends]) => {
        setOrdenes(ords)
        setPendientes(pends)
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false))
    alertasService.getAlertasPersonales().then(setAlertas)
  }, [])

  const conteos = useMemo(() => {
    const base = { todos: ordenes.length }
    for (const e of ESTADO_ORDEN) base[e] = ordenes.filter((o) => o.estado === e).length
    return base
  }, [ordenes])

  const ordenesFiltradas = ordenes
    .filter((o) => tab === "todos" || o.estado === tab)
    .filter((o) =>
      busqueda
        ? o.persona?.apellido_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          o.persona?.documento.toLowerCase().includes(busqueda.toLowerCase()) ||
          o.empresa?.razon_social.toLowerCase().includes(busqueda.toLowerCase())
        : true
    )

  return (
    <AppShell titulo="Bandeja del Día" subtitulo="Resumen de pacientes y estudios asignados">
      <div className="mb-6 flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-md border border-ink-soft/20 px-3 py-2">
          <Search size={16} className="text-ink-soft" />
          <input
            className="w-full text-sm outline-none"
            placeholder="Buscar paciente, empresa o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      {errorCarga && (
        <div className="mb-6 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          No se pudo traer la bandeja: {errorCarga}
        </div>
      )}

      <div className="mb-6 flex gap-4">
        {[
          { label: "Pacientes Hoy", valor: conteos.todos },
          ...ESTADO_ORDEN.map((e) => ({ label: ETIQUETA_ESTADO[e], valor: conteos[e] })),
        ].map((k) => (
          <div key={k.label} className="flex-1 rounded-card border border-ink-soft/10 bg-white p-4">
            <p className="text-xs text-ink-soft">{k.label}</p>
            <p className="text-xl font-semibold text-ink">{k.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-card border border-ink-soft/10 bg-white p-5">
          <div className="mb-4 flex gap-1 border-b border-ink-soft/10">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-xs font-medium ${
                  tab === t.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t.label} ({conteos[t.key] ?? 0})
              </button>
            ))}
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="pb-2 font-normal">Paciente</th>
                <th className="pb-2 font-normal">Empresa</th>
                <th className="pb-2 font-normal">Tipo Examen</th>
                <th className="pb-2 font-normal">Estado</th>
                <th className="pb-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {!cargando && ordenesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-ink-soft">
                    No hay órdenes con fecha de hoy que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {ordenesFiltradas.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-t border-ink-soft/10 hover:bg-ink-soft/5"
                  onClick={() => navigate(`/carga/${o.id}`)}
                >
                  <td className="py-2.5">
                    <p className="text-ink">{o.persona?.apellido_nombre}</p>
                    <p className="text-xs text-ink-soft">{o.persona?.documento}</p>
                  </td>
                  <td className="py-2.5 text-ink-soft">{o.empresa?.razon_social}</td>
                  <td className="py-2.5 text-ink-soft">{TIPO_EXAMEN_LABEL[o.tipo_examen]}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_ESTILO[o.estado]}`}>
                      {ETIQUETA_ESTADO[o.estado]}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      title="Imprimir hoja de ruta"
                      onClick={(e) => {
                        e.stopPropagation()
                        imprimirHojaDeRuta(o.id)
                      }}
                      className="text-ink-soft hover:text-primary"
                    >
                      <Printer size={16} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-ink-soft/10 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">Alertas Personales</p>
            <ul className="flex flex-col gap-2.5">
              {alertas.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs text-ink-soft">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                  {a.texto}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card border border-ink-soft/10 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">Acciones Rápidas</p>
            <div className="flex flex-col gap-2 text-xs">
              <button className="flex items-center gap-2 rounded-md border border-ink-soft/10 p-2 text-left hover:border-primary/40">
                <UserPlus size={15} className="text-primary" /> Nuevo Paciente
              </button>
              <button className="flex items-center gap-2 rounded-md border border-ink-soft/10 p-2 text-left hover:border-primary/40">
                <Search size={15} className="text-primary" /> Buscar Paciente
              </button>
              <button className="flex items-center gap-2 rounded-md border border-ink-soft/10 p-2 text-left hover:border-primary/40">
                <FolderOpen size={15} className="text-primary" /> Ver Legajos
              </button>
              <button className="flex items-center gap-2 rounded-md border border-ink-soft/10 p-2 text-left hover:border-primary/40">
                <CalendarClock size={15} className="text-primary" /> Vigencias Próximas
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-ink-soft/10 bg-white p-5">
        <p className="mb-3 text-sm font-medium text-ink">Estudios Pendientes</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-soft">
              <th className="pb-2 font-normal">Paciente</th>
              <th className="pb-2 font-normal">Estudio</th>
              <th className="pb-2 font-normal">Categoría</th>
              <th className="pb-2 font-normal">Empresa</th>
              <th className="pb-2 font-normal">Lo carga</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((e, i) => (
              <tr key={`${e.numero}-${e.estudio}-${i}`} className="border-t border-ink-soft/10">
                <td className="py-2.5 text-ink">{e.paciente}</td>
                <td className="py-2.5 text-ink-soft">{e.estudio}</td>
                <td className="py-2.5 text-ink-soft">{e.categoria}</td>
                <td className="py-2.5 text-ink-soft">{e.empresa}</td>
                <td className="py-2.5 text-ink-soft">{e.rol_responsable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
