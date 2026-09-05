import { useEffect, useState } from "react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts"
import {
  Users,
  FlaskConical,
  Building2,
  IdCard,
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Search,
  FileText,
  ClipboardList,
  ShieldCheck,
  BarChart3,
} from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { dashboardService } from "../../services/dashboardService"

const COLORES_TORTA = ["var(--color-primary)", "var(--color-accent)", "#B8D4EE"]

const ACCESOS_RAPIDOS = [
  { label: "Nueva Orden de Servicio", icon: FilePlus2, to: "/admin/ordenes" },
  { label: "Buscar Persona", icon: Search, to: "/admin/personas" },
  { label: "Hoja de Ruta", icon: FileText, to: "/admin/ordenes" },
  { label: "Listado de Órdenes", icon: ClipboardList, to: "/admin/ordenes" },
  { label: "Auditoría", icon: ShieldCheck, to: "/admin/auditoria" },
  { label: "Reporte Personalizado", icon: BarChart3, to: "/admin/ordenes" },
]

function TarjetaKpi({ icon: Icon, label, valor, detalle }) {
  return (
    <div className="flex-1 rounded-card border border-ink-soft/10 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-ink-soft">
        <Icon size={17} strokeWidth={1.75} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-ink">{valor}</p>
      <p className="mt-1 text-xs text-ink-soft">{detalle}</p>
    </div>
  )
}

export default function DashboardAdmin() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    dashboardService.getResumenAdministrador().then(setDatos)
  }, [])

  if (!datos) {
    return (
      <AppShell titulo="Inicio" subtitulo="Resumen general del sistema">
        <p className="text-sm text-ink-soft">Cargando…</p>
      </AppShell>
    )
  }

  const { kpis, actividad_7_dias, ordenes_por_tipo, pendientes_por_area, alertas_sistema } = datos

  return (
    <AppShell titulo="Hola, Administrador" subtitulo="Resumen general del sistema">
      <div className="mb-6 flex gap-4">
        <TarjetaKpi icon={ClipboardList} label="Órdenes de Hoy" valor={kpis.ordenes_hoy.total} detalle={kpis.ordenes_hoy.detalle} />
        <TarjetaKpi icon={FlaskConical} label="Estudios Pendientes" valor={kpis.estudios_pendientes.total} detalle={kpis.estudios_pendientes.detalle} />
        <TarjetaKpi icon={Building2} label="Empresas Activas" valor={kpis.empresas_activas.total} detalle={kpis.empresas_activas.detalle} />
        <TarjetaKpi icon={IdCard} label="Personas Registradas" valor={kpis.personas_registradas.total.toLocaleString("es-AR")} detalle={kpis.personas_registradas.detalle} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Actividad del Sistema — últimos 7 días</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={actividad_7_dias}>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ordenes_creadas" name="Órdenes creadas" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="estudios_cargados" name="Estudios cargados" stroke="var(--color-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Órdenes por Tipo de Examen</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={ordenes_por_tipo} dataKey="cantidad" nameKey="tipo" innerRadius={45} outerRadius={70}>
                {ordenes_por_tipo.map((_, i) => (
                  <Cell key={i} fill={COLORES_TORTA[i % COLORES_TORTA.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-soft">
            {ordenes_por_tipo.map((o, i) => (
              <li key={o.tipo} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COLORES_TORTA[i % COLORES_TORTA.length] }}
                />
                {o.tipo} — {o.porcentaje}% ({o.cantidad})
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <Users size={16} /> Pendientes por Área
          </p>
          <ul className="flex flex-col gap-3">
            {pendientes_por_area.map((a) => (
              <li key={a.area} className="text-xs text-ink-soft">
                <div className="mb-1 flex justify-between">
                  <span>{a.area}</span>
                  <span className="font-medium text-ink">{a.pendientes}</span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-soft/10">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, a.pendientes)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Alertas del Sistema</p>
          <ul className="flex flex-col gap-3">
            {alertas_sistema.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="flex items-start gap-2 text-ink-soft">
                  {a.tipo === "backup" ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                  )}
                  {a.texto}
                </span>
                {a.accion && (
                  <button className="shrink-0 text-primary hover:underline">{a.accion}</button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Accesos Rápidos</p>
          <div className="grid grid-cols-2 gap-2">
            {ACCESOS_RAPIDOS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex flex-col items-start gap-2 rounded-md border border-ink-soft/10 p-3 text-left text-xs text-ink hover:border-primary/40"
              >
                <Icon size={16} className="text-primary" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
