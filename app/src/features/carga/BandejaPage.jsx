import { useEffect, useMemo, useState } from "react"
import {
  Search,
  Printer,
  Eye,
  UserPlus,
  FolderOpen,
  CalendarClock,
  AlertTriangle,
} from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { ordenesService } from "./services/ordenesService"
import { alertasService } from "./services/alertasService"

const TIPO_EXAMEN_LABEL = {
  prelaboral: "Prelaboral",
  periodico: "Periódico",
  egreso: "Egreso",
}

const ESTADO_ESTILO = {
  pendiente: "bg-warning/10 text-warning",
  en_curso: "bg-accent/15 text-primary",
  completo: "bg-success/10 text-success",
}
const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  completo: "Completo",
}

const PRIORIDAD_ESTILO = {
  alta: "bg-danger/10 text-danger",
  media: "bg-warning/10 text-warning",
  baja: "bg-ink-soft/10 text-ink-soft",
}

const TABS = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendientes" },
  { key: "en_curso", label: "En Curso" },
  { key: "completo", label: "Completos" },
]

export default function BandejaProfesional() {
  const [ordenes, setOrdenes] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [alertas, setAlertas] = useState([])
  const [tab, setTab] = useState("todos")
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => {
    ordenesService.getOrdenesDelDia().then(setOrdenes)
    ordenesService.getEstudiosPendientes().then(setPendientes)
    alertasService.getAlertasPersonales().then(setAlertas)
  }, [])

  const conteos = useMemo(
    () => ({
      todos: ordenes.length,
      pendiente: ordenes.filter((o) => o.estado === "pendiente").length,
      en_curso: ordenes.filter((o) => o.estado === "en_curso").length,
      completo: ordenes.filter((o) => o.estado === "completo").length,
    }),
    [ordenes]
  )

  const ordenesFiltradas = ordenes
    .filter((o) => tab === "todos" || o.estado === tab)
    .filter((o) =>
      busqueda
        ? o.persona?.apellido_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          o.persona?.documento.includes(busqueda) ||
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
        <button className="rounded-md border border-ink-soft/20 p-2 text-ink-soft hover:text-ink">
          <Printer size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mb-6 flex gap-4">
        {[
          { label: "Pacientes Hoy", valor: conteos.todos },
          { label: "Pendientes", valor: conteos.pendiente },
          { label: "En Curso", valor: conteos.en_curso },
          { label: "Completos", valor: conteos.completo },
          { label: "Devueltos", valor: 2 },
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
                {t.label} ({conteos[t.key]})
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
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map((o) => (
                <tr key={o.id} className="border-t border-ink-soft/10">
                  <td className="py-2.5">
                    <p className="text-ink">{o.persona?.apellido_nombre}</p>
                    <p className="text-xs text-ink-soft">DNI {o.persona?.documento}</p>
                  </td>
                  <td className="py-2.5 text-ink-soft">{o.empresa?.razon_social}</td>
                  <td className="py-2.5 text-ink-soft">{TIPO_EXAMEN_LABEL[o.tipo_examen]}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_ESTILO[o.estado]}`}>
                      {ESTADO_LABEL[o.estado]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-3 text-xs text-primary hover:underline">Ver todos los pacientes →</button>
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
              <th className="pb-2 font-normal">Prioridad</th>
              <th className="pb-2 font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((e) => (
              <tr key={e.id} className="border-t border-ink-soft/10">
                <td className="py-2.5 text-ink">{e.persona?.apellido_nombre}</td>
                <td className="py-2.5 text-ink-soft">{e.estudio}</td>
                <td className="py-2.5 text-ink-soft">{e.categoria.replace("_", " ")}</td>
                <td className="py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORIDAD_ESTILO[e.prioridad]}`}>
                    {e.prioridad}
                  </span>
                </td>
                <td className="py-2.5">
                  <button className="text-ink-soft hover:text-primary">
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-3 text-xs text-primary hover:underline">Ver todos los estudios pendientes →</button>
      </div>
    </AppShell>
  )
}
