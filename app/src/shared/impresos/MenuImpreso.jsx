import { useEffect, useRef, useState } from "react"
import { Printer, Download, Share2, ChevronDown } from "lucide-react"

/* ---------------------------------------------------------------------
   Un botón por documento (Hoja de ruta / Protocolo) que despliega las
   tres formas de sacarlo: Imprimir, Descargar PDF, Compartir.

   Ojo con esto — no son tres motores distintos. Las tres abren el
   mismo diálogo de impresión del navegador (imprimirComponente): un
   navegador no tiene forma de generar un PDF silencioso, sin diálogo,
   con la misma calidad que imprimir de verdad — es una limitación real
   de la plataforma. Hubo una versión que sí tenía un motor aparte para
   "Descargar" (html2canvas + jsPDF, una captura de pantalla convertida
   en imagen) y se sacó porque el texto salía borroso, muy por debajo
   de lo que se ve al imprimir. Las opciones quedan igual de visibles
   que antes; lo que cambió es que las tres llevan al mismo lugar bueno.
   --------------------------------------------------------------------- */

export default function MenuImpreso({ etiqueta, destacado, onImprimir }) {
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

  function elegir() {
    setAbierto(false)
    onImprimir()
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
        <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-md border-2 border-ink-soft/15 bg-white py-1 shadow-lg">
          <button
            onClick={elegir}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
          >
            <Printer size={14} className="text-ink-soft" /> Imprimir
          </button>
          <button
            onClick={elegir}
            title='Elegí "Guardar como PDF" como destino en el diálogo'
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
          >
            <Download size={14} className="text-ink-soft" /> Descargar PDF
          </button>
          <button
            onClick={elegir}
            title='Guardalo como PDF desde el diálogo y adjuntalo donde lo necesites'
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-ink hover:bg-ink-soft/5"
          >
            <Share2 size={14} className="text-ink-soft" /> Compartir
          </button>
        </div>
      )}
    </div>
  )
}
