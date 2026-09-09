import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, CalendarClock, Printer } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { supabase } from "../../lib/supabase"
import { imprimirProtocolo } from "./imprimir/Protocolo"

/* ---------------------------------------------------------------------
   Vigencias próximas — RF24.

   Un examen prelaboral vale doce meses. Cuando vence, la empresa tiene
   gente trabajando sin apto vigente, y se entera cuando alguien lo
   reclama.

   La vista v_vencimientos ya acota a los próximos 30 días y sólo trae
   órdenes informadas: un examen sin aptitud no vence, todavía no empezó
   a correr. Acá no se recalcula nada.

   Se agrupa por empresa a propósito. Al que atiende el teléfono no le
   sirve una lista de treinta personas sueltas: le sirve saber que a
   ACSO se le vencen cuatro, para llamar una vez y no cuatro.
   --------------------------------------------------------------------- */

export default function VigenciasPage() {
  const navigate = useNavigate()
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error: e } = await supabase
          .from("v_vencimientos")
          .select("numero, fecha, fecha_vencimiento, paciente, documento, empresa, dias")
          .order("dias", { ascending: true })
        if (e) throw new Error(e.message)
        setFilas(data ?? [])
      } catch (e) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  const porEmpresa = new Map()
  for (const f of filas) {
    if (!porEmpresa.has(f.empresa)) porEmpresa.set(f.empresa, [])
    porEmpresa.get(f.empresa).push(f)
  }
  const empresas = [...porEmpresa.entries()].sort(
    (a, b) => Math.min(...a[1].map((x) => x.dias)) - Math.min(...b[1].map((x) => x.dias))
  )

  const color = (dias) =>
    dias <= 7 ? "text-danger" : dias <= 15 ? "text-warning" : "text-ink-soft"

  return (
    <AppShell titulo="Vigencias próximas" subtitulo="Exámenes que vencen en los próximos 30 días">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!cargando && filas.length === 0 && (
        <div className="rounded-card border-2 border-ink-soft/15 bg-white p-8 text-center">
          <CalendarClock size={26} className="mx-auto mb-2 text-ink-soft/40" strokeWidth={1.5} />
          <p className="text-sm text-ink">No vence ningún examen en los próximos 30 días.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Se cuentan sólo los informados: uno sin aptitud todavía no empezó a correr.
          </p>
        </div>
      )}

      {filas.length > 0 && (
        <p className="mb-4 text-xs text-ink-soft">
          {filas.length} {filas.length === 1 ? "examen vence" : "exámenes vencen"} en{" "}
          {empresas.length} {empresas.length === 1 ? "empresa" : "empresas"}.
          Los de menos de una semana van en rojo.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {empresas.map(([empresa, gente]) => (
          <div key={empresa} className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <div className="mb-3 flex items-baseline gap-3">
              <p className="text-sm font-medium text-ink">{empresa}</p>
              <span className="text-xs text-ink-soft">
                {gente.length} {gente.length === 1 ? "persona" : "personas"}
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] text-ink-soft">
                  <th className="pb-2 font-normal">Paciente</th>
                  <th className="pb-2 font-normal">N°</th>
                  <th className="pb-2 font-normal">Vence</th>
                  <th className="pb-2 font-normal">Faltan</th>
                  <th className="pb-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {gente.map((f) => (
                  <tr key={`${f.numero}`} className="border-t border-ink-soft/10">
                    <td className="py-2.5">
                      <span className="text-ink">{f.paciente}</span>
                      <span className="block text-[11px] text-ink-soft">{f.documento}</span>
                    </td>
                    <td className="py-2.5 text-ink-soft">{f.numero}</td>
                    <td className="py-2.5 text-ink-soft">{f.fecha_vencimiento}</td>
                    <td className={`py-2.5 font-medium ${color(f.dias)}`}>
                      {f.dias === 0 ? "hoy" : `${f.dias} días`}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        title="Reimprimir el protocolo que vence"
                        onClick={() => navigate(`/bandeja/legajos`)}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver legajo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
