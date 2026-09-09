import { useEffect, useRef, useState } from "react"
import { Printer, Download, Share2, ChevronDown } from "lucide-react"

/* ---------------------------------------------------------------------
   Un botón por documento (Hoja de ruta / Protocolo), no tres sueltos.
   Al tocarlo se abren las opciones: Imprimir, Descargar PDF y, cuando
   el navegador puede de verdad (Web Share API con archivos, contexto
   seguro), Compartir.
   --------------------------------------------------------------------- */

export default function MenuImpreso({ etiqueta, destacado, disponibleCompartir, onImprimir, onDescargar, onCompartir }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    function alTocarAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener("mousedown", alTocarAfuera)
    return () => document.removeEventListener("mousedown", alTocarAfuera)
  }, [abierto])

  function elegir(accion) {
    setAbierto(false)
    accion()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md border-2 px-3 py-2 text-xs font-medium ${
          destacado
            ? "border-primary/50 text-primary hover:bg-primary/5"
            : "border-ink-soft/15 text-ink-soft hover:border-primary/50 hover:text-primary"
        }`}
      >
        <Printer size={15} /> {etiqueta} <ChevronDown size={13} className={abierto ? "rotate-180" : undefined} />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-md border-2 border-ink-soft/15 bg-white py-1 shadow-lg">
          <button
            onClick={() => elegir(onImprimir)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
          >
            <Printer size={14} className="text-ink-soft" /> Imprimir
          </button>
          <button
            onClick={() => elegir(onDescargar)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
          >
            <Download size={14} className="text-ink-soft" /> Descargar PDF
          </button>
          {disponibleCompartir && (
            <button
              onClick={() => elegir(onCompartir)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
            >
              <Share2 size={14} className="text-ink-soft" /> Compartir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
