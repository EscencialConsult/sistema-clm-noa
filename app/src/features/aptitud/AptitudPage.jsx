import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Printer, AlertTriangle } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { aptitudService } from "./services/aptitudService"
import { ETIQUETA_APTITUD } from "../../types/dominio"
import { imprimirProtocolo } from "./imprimir/Protocolo"

/* ---------------------------------------------------------------------
   Lo que el médico laboral tiene para dictaminar hoy — CU-11.

   Arriba, las que están COMPLETA: todas llegaron ahí solas, porque el
   trigger avanza el estado cuando se carga el último estudio (RF16). Si
   una orden no aparece, es que le falta algo — incluido un estudio
   derivado que todavía no volvió (RF19). No hay nada que tildar.

   Abajo, las informadas hoy, nada más que para poder reimprimir un
   protocolo sin ir a buscar la orden.
   --------------------------------------------------------------------- */

export default function AptitudPage() {
  const navigate = useNavigate()
  const [paraInformar, setParaInformar] = useState([])
  const [informadas, setInformadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [a, b] = await Promise.all([
          aptitudService.getOrdenesParaInformar(),
          aptitudService.getInformadasDeHoy(),
        ])
        setParaInformar(a)
        setInformadas(b)
      } catch (e) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  return (
    <AppShell
      titulo="Aptitud"
      subtitulo="Órdenes completas, listas para dictaminar"
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-5 rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <p className="mb-4 text-sm font-medium text-ink">
          Para dictaminar ({paraInformar.length})
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-soft">
              <th className="pb-2 font-normal">N°</th>
              <th className="pb-2 font-normal">Paciente</th>
              <th className="pb-2 font-normal">Empresa</th>
              <th className="pb-2 font-normal">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && paraInformar.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-ink-soft">
                  No hay ninguna orden completa esperando dictamen.
                </td>
              </tr>
            )}
            {paraInformar.map((o) => (
              <tr
                key={o.id}
                onClick={() => navigate(`/aptitud/${o.id}`)}
                className="cursor-pointer border-t border-ink-soft/10 hover:bg-ink-soft/5"
              >
                <td className="py-2.5 text-ink-soft">{o.numero}</td>
                <td className="py-2.5">
                  <p className="text-ink">{o.persona?.apellido_nombre}</p>
                  <p className="text-xs text-ink-soft">{o.persona?.documento}</p>
                </td>
                <td className="py-2.5 text-ink-soft">{o.empresa?.razon_social}</td>
                <td className="py-2.5 text-ink-soft">{o.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <p className="mb-4 text-sm font-medium text-ink">
          Informadas hoy ({informadas.length})
        </p>
        {!cargando && informadas.length === 0 ? (
          <p className="text-xs text-ink-soft">Todavía no se informó ninguna orden hoy.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {informadas.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/aptitud/${o.id}`)}
                  className="cursor-pointer border-t border-ink-soft/10 first:border-t-0 hover:bg-ink-soft/5"
                >
                  <td className="py-2.5 text-ink-soft">{o.numero}</td>
                  <td className="py-2.5 text-ink">{o.persona?.apellido_nombre}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        o.aptitud === "APTO"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {ETIQUETA_APTITUD[o.aptitud]}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      title="Reimprimir protocolo"
                      onClick={(e) => {
                        e.stopPropagation()
                        imprimirProtocolo(o.id)
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
        )}
      </div>
    </AppShell>
  )
}
