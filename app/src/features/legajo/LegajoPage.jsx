import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Printer, AlertTriangle, FolderOpen } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { aptitudService } from "../aptitud/services/aptitudService"
import { ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"
import { imprimirProtocolo } from "../aptitud/imprimir/Protocolo"

/* ---------------------------------------------------------------------
   Legajo de una persona — RF02 regla b · CP-03.

   Se busca por documento o por apellido y salen TODAS sus órdenes, de la
   más nueva a la más vieja. Es la otra mitad de que el padrón no
   duplique: el documento ya está protegido por una restricción de
   unicidad en la base, y esta pantalla es la que hace que volver a
   ingresarlo sirva para algo — traer el historial en vez de abrir una
   ficha nueva.

   Quién puede ver a quién no se decide acá. La política de la base deja
   ver el padrón completo a Recepción, al Administrador y al médico
   laboral; a los demás, sólo a las personas con una orden en curso. Si
   la búsqueda no devuelve a alguien, probablemente esté funcionando
   bien.
   --------------------------------------------------------------------- */

export default function LegajoPage() {
  const navigate = useNavigate()
  const [texto, setTexto] = useState("")
  const [personas, setPersonas] = useState([])
  const [elegida, setElegida] = useState(null)
  const [ordenes, setOrdenes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [buscoAlgunaVez, setBuscoAlgunaVez] = useState(false)

  async function buscar(e) {
    e?.preventDefault()
    setBuscando(true)
    setError(null)
    setElegida(null)
    setOrdenes([])
    try {
      setPersonas(await aptitudService.buscarPersonas(texto))
      setBuscoAlgunaVez(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuscando(false)
    }
  }

  async function abrirLegajo(p) {
    setElegida(p)
    setError(null)
    try {
      setOrdenes(await aptitudService.getLegajo(p.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AppShell titulo="Legajos" subtitulo="El historial de una persona, por documento o apellido">
      <form onSubmit={buscar} className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Documento o apellido"
            className="w-full rounded-md border border-ink-soft/20 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={texto.trim().length < 2 || buscando}
          className="rounded-md bg-primary px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-card border border-ink-soft/10 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">Personas ({personas.length})</p>
          {buscoAlgunaVez && personas.length === 0 && (
            <p className="text-xs text-ink-soft">
              No hay nadie con ese documento ni con ese apellido.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {personas.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => abrirLegajo(p)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    elegida?.id === p.id ? "bg-primary/5 text-primary" : "text-ink hover:bg-ink-soft/5"
                  }`}
                >
                  <p>{p.apellido_nombre}</p>
                  <p className="text-xs text-ink-soft">{p.documento}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 rounded-card border border-ink-soft/10 bg-white p-5">
          {!elegida ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen size={28} className="mb-2 text-ink-soft/40" strokeWidth={1.5} />
              <p className="text-xs text-ink-soft">
                Elegí una persona para ver todos sus exámenes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm font-medium text-ink">{elegida.apellido_nombre}</p>
                <p className="text-xs text-ink-soft">
                  {elegida.documento} · {elegida.sexo === "F" ? "Femenino" : "Masculino"}
                  {elegida.fecha_nac && ` · nacida/o el ${elegida.fecha_nac}`}
                </p>
              </div>

              {ordenes.length === 0 ? (
                <p className="text-xs text-ink-soft">
                  Está en el padrón pero todavía no tiene ninguna orden.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-ink-soft">
                      <th className="pb-2 font-normal">N°</th>
                      <th className="pb-2 font-normal">Fecha</th>
                      <th className="pb-2 font-normal">Empresa</th>
                      <th className="pb-2 font-normal">Estado</th>
                      <th className="pb-2 font-normal">Aptitud</th>
                      <th className="pb-2 font-normal">Vence</th>
                      <th className="pb-2 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => navigate(`/aptitud/${o.id}`)}
                        className="cursor-pointer border-t border-ink-soft/10 hover:bg-ink-soft/5"
                      >
                        <td className="py-2.5 text-ink-soft">{o.numero}</td>
                        <td className="py-2.5 text-ink-soft">{o.fecha}</td>
                        <td className="py-2.5 text-ink">{o.empresa?.razon_social}</td>
                        <td className="py-2.5 text-xs text-ink-soft">
                          {ETIQUETA_ESTADO[o.estado]}
                        </td>
                        <td className="py-2.5">
                          {o.aptitud === "PENDIENTE" ? (
                            <span className="text-xs text-ink-soft">—</span>
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                o.aptitud === "APTO"
                                  ? "bg-success/10 text-success"
                                  : "bg-danger/10 text-danger"
                              }`}
                            >
                              {ETIQUETA_APTITUD[o.aptitud]}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-ink-soft">
                          {o.fecha_vencimiento ?? "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {o.estado === "INFORMADA" && (
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
