import { useEffect, useState } from "react"
import { Printer, X, AlertTriangle } from "lucide-react"
import { getDatosParaImprimir } from "../../../shared/impresos/datosImpresionService"
import { imprimirComponente } from "../../../shared/impresos/imprimir"
import { HojaDeRuta } from "./HojaDeRuta"

/* ---------------------------------------------------------------------
   Elegir qué páginas de la hoja de ruta se imprimen.

   La hoja de ruta sale con UNA PÁGINA POR CATEGORÍA, para que cada
   puesto se quede con la suya. El básico de ley son seis; el de
   conductor, nueve. Cuando el paciente ya trae hechas las radiografías,
   o va a hacer el laboratorio otro día, esas hojas se imprimen para
   tirarlas.

   No se filtra en el diálogo del navegador —«páginas 2-4»— porque ahí
   hay que saber de antemano qué número le tocó a cada categoría, y ese
   número cambia con cada batería.
   --------------------------------------------------------------------- */

export default function ElegirPaginas({ ordenId, onCerrar }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [fuera, setFuera] = useState([])
  const [unaPorPagina, setUnaPorPagina] = useState(false)

  useEffect(() => {
    getDatosParaImprimir(ordenId).then(setDatos).catch((e) => setError(e.message))
  }, [ordenId])

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === "Escape") onCerrar() }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [onCerrar])

  const categorias = datos?.categorias ?? []
  const elegidas = categorias.filter((c) => !fuera.includes(c.id))

  function alternar(id) {
    setFuera((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /* Se imprime la MISMA hoja de ruta, con menos categorías adentro. No
     hay una segunda versión del documento que pueda quedar distinta de
     la original. */
  function imprimir() {
    if (elegidas.length === 0) return
    imprimirComponente(<HojaDeRuta datos={{ ...datos, categorias: elegidas }} unaPorPagina={unaPorPagina} />)
    onCerrar()
  }

  return (
    <div
      onMouseDown={onCerrar}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-card border-2 border-ink-soft/15 bg-white shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-ink-soft/15 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Qué páginas imprimir</p>
            <p className="text-xs text-ink-soft">
              La hoja de ruta sale con una página por categoría.
            </p>
          </div>
          <button
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 rounded p-1 text-ink-soft hover:bg-ink-soft/10 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : !datos ? (
            <p className="text-sm text-ink-soft">Trayendo la orden…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-1.5">
                {categorias.map((c) => {
                  const va = !fuera.includes(c.id)
                  /* El número es el que va a tener la página impresa, no el
                     lugar en esta lista: sacando una del medio, las de
                     abajo se corren. Es lo que se va a ver en el papel. */
                  const pagina = elegidas.findIndex((x) => x.id === c.id) + 1
                  return (
                    <button
                      key={c.id}
                      onClick={() => alternar(c.id)}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${
                        va
                          ? "border-ink-soft/20 bg-white text-ink"
                          : "border-dashed border-ink-soft/25 bg-ink-soft/[0.04] text-ink-soft/60"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[10px] font-semibold ${
                          va ? "border-primary bg-primary text-white" : "border-ink-soft/30"
                        }`}
                      >
                        {va ? pagina : ""}
                      </span>
                      <span className={`min-w-0 flex-1 ${va ? "" : "line-through"}`}>{c.nombre}</span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {c.items.length} estudio{c.items.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Por defecto se aprovecha la hoja. Queda la opción de
                  volver a una por página para quien no quiera cortar. */}
              <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-ink-soft/15 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={unaPorPagina}
                  onChange={(e) => setUnaPorPagina(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs text-ink">
                  Una categoría por hoja
                  <span className="block text-[11px] text-ink-soft">
                    Sin marcar, las categorías cortas comparten hoja y el papel
                    sale con una línea de corte entre una y otra.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 border-t border-ink-soft/10 pt-3">
                {fuera.length > 0 && (
                  <button
                    onClick={() => setFuera([])}
                    className="rounded-md border-2 border-ink-soft/20 px-3 py-2 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  onClick={imprimir}
                  disabled={elegidas.length === 0}
                  className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Printer size={15} />
                  {unaPorPagina
                    ? (elegidas.length === categorias.length
                        ? `Imprimir las ${categorias.length} páginas`
                        : `Imprimir ${elegidas.length} de ${categorias.length}`)
                    : `Imprimir ${elegidas.length} categoría${elegidas.length === 1 ? "" : "s"}`}
                </button>
              </div>

              {elegidas.length === 0 && (
                <p className="mt-2 text-right text-[11px] text-ink-soft">
                  Marcá al menos una para poder imprimir.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
