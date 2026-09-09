import { Printer } from "lucide-react"

/* ---------------------------------------------------------------------
   Un solo botón, un solo motor: el de impresión del navegador. Hubo una
   versión con un menú (Imprimir / Descargar PDF / Compartir) donde
   "Descargar" usaba una librería que saca una foto de la pantalla
   (html2canvas) y arma un PDF con esa imagen — texto borroso, no
   comparable a lo que se ve al imprimir de verdad. Un navegador no
   tiene forma de generar un PDF silencioso, sin diálogo, con la misma
   calidad que imprimir: es una limitación real, no algo que faltaba
   afinar. Por eso queda un solo camino para las dos cosas — desde el
   diálogo de impresión, "Guardar como PDF" es una impresora más.
   --------------------------------------------------------------------- */

export default function MenuImpreso({ etiqueta, destacado, onImprimir }) {
  return (
    <button
      onClick={onImprimir}
      title="Imprimir o guardar como PDF — elegilo como destino en el diálogo de impresión"
      className={`flex items-center gap-1.5 rounded-md border-2 px-3 py-2 text-xs font-medium ${
        destacado
          ? "border-primary/50 text-primary hover:bg-primary/5"
          : "border-ink-soft/15 text-ink-soft hover:border-primary/50 hover:text-primary"
      }`}
    >
      <Printer size={15} /> {etiqueta}
    </button>
  )
}
