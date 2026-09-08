import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Printer, AlertTriangle, RefreshCw } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { recepcionService } from "./services/recepcionService"
import { ETIQUETA_ESTADO } from "../../types/dominio"
import { imprimirHojaDeRuta } from "../ordenes/imprimir/HojaDeRuta"

/* ---------------------------------------------------------------------
   Pendientes del día — CU-13 · CP-26.

   «Distingue en curso de completa». Es la pregunta que recepción hace
   veinte veces por día: quién está todavía dando vueltas por los
   consultorios y quién ya terminó y espera al médico laboral.

   Las cuentas de estudios salen de v_orden_avance, no se recuentan acá.
   --------------------------------------------------------------------- */

export default function PendientesDelDiaPage() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function recargar() {
    setCargando(true)
    try {
      setOrdenes(await recepcionService.getPendientesDelDia())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { recargar() }, [])

  const enCurso = ordenes.filter((o) => o.estado !== "COMPLETA")
  const completas = ordenes.filter((o) => o.estado === "COMPLETA")

  return (
    <AppShell titulo="Pendientes del día" subtitulo="Lo que todavía no se informó">
      {error && (
        <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={recargar}
          className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 px-3 py-2 text-xs text-ink-soft hover:text-ink"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
        {!cargando && (
          <span className="text-xs text-ink-soft">
            {enCurso.length} en curso · {completas.length} esperando al médico
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Bloque
          titulo="Dando vueltas"
          vacio="Nadie con estudios pendientes hoy."
          descripcion="Todavía les falta pasar por algún puesto."
          ordenes={enCurso}
          cargando={cargando}
          onAbrir={(o) => navigate(`/carga/${o.id}`)}
        />
        <Bloque
          titulo="Completas, esperando al médico laboral"
          vacio="Ninguna esperando dictamen."
          descripcion="Tienen todos los estudios cargados. Falta la aptitud."
          ordenes={completas}
          cargando={cargando}
          onAbrir={(o) => navigate(`/aptitud/${o.id}`)}
        />
      </div>
    </AppShell>
  )
}

function Bloque({ titulo, descripcion, vacio, ordenes, cargando, onAbrir }) {
  return (
    <section className="rounded-card border border-ink-soft/10 bg-white p-5">
      <p className="text-sm font-medium text-ink">
        {titulo} ({ordenes.length})
      </p>
      <p className="mb-4 text-xs text-ink-soft">{descripcion}</p>

      {!cargando && ordenes.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-soft">{vacio}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-soft">
              <th className="pb-2 font-normal">N°</th>
              <th className="pb-2 font-normal">Paciente</th>
              <th className="pb-2 font-normal">Empresa</th>
              <th className="pb-2 font-normal">Avance</th>
              <th className="pb-2 font-normal">Estado</th>
              <th className="pb-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr
                key={o.id}
                onClick={() => onAbrir(o)}
                className="cursor-pointer border-t border-ink-soft/10 hover:bg-ink-soft/5"
              >
                <td className="py-2.5 text-ink-soft">{o.numero}</td>
                <td className="py-2.5">
                  <p className="text-ink">{o.paciente}</p>
                  <p className="text-xs text-ink-soft">{o.documento}</p>
                </td>
                <td className="py-2.5 text-ink-soft">{o.empresa}</td>
                <td className="py-2.5">
                  <span className="text-ink">{o.cargados}</span>
                  <span className="text-ink-soft"> / {o.estudios}</span>
                  {o.fuera_de_rango > 0 && (
                    <span className="ml-2 text-xs text-warning">
                      {o.fuera_de_rango} fuera de rango
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-xs text-ink-soft">{ETIQUETA_ESTADO[o.estado]}</td>
                <td className="py-2.5 text-right">
                  <button
                    title="Reimprimir hoja de ruta"
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
      )}
    </section>
  )
}
