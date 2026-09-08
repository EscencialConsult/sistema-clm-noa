import { createRoot } from "react-dom/client"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"

/* ---------------------------------------------------------------------
   RF23: "El sistema genera el documento final de la orden, en formato
   de archivo". El botón de imprimir ya cubre esto en la práctica —
   cualquier navegador deja "Guardar como PDF" en el diálogo de
   impresión — pero acá va la versión de un clic que lo descarga
   directo, sin pasar por ese diálogo.

   Renderiza el mismo componente que se usa para imprimir (nunca dos
   layouts distintos para lo mismo) en un contenedor oculto, lo
   rasteriza con html2canvas y arma un PDF A4 con jsPDF, paginando si el
   contenido no entra en una sola hoja.
   --------------------------------------------------------------------- */

const A4_MM = { w: 210, h: 297 }

export async function descargarComoPdf(elemento, nombreArchivo) {
  const contenedor = document.createElement("div")
  // Ancho fijo tipo A4 a 96dpi aprox., fuera de la vista pero renderizado.
  contenedor.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;"
  document.body.appendChild(contenedor)

  const root = createRoot(contenedor)
  root.render(elemento)
  // Esperar a que React pinte antes de rasterizar.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  try {
    const canvas = await html2canvas(contenedor, { scale: 2, backgroundColor: "#ffffff" })
    const pdf = new jsPDF({ unit: "mm", format: "a4" })

    const imgAnchoMm = A4_MM.w
    const imgAltoMm = (canvas.height * imgAnchoMm) / canvas.width
    const paginaAltoMm = A4_MM.h

    if (imgAltoMm <= paginaAltoMm) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgAnchoMm, imgAltoMm)
    } else {
      // Paginado: una porción de A4 de alto por página, recortada del canvas original.
      const pxPorMm = canvas.width / imgAnchoMm
      const altoPaginaPx = Math.floor(paginaAltoMm * pxPorMm)
      let restante = canvas.height
      let offset = 0
      let primera = true
      while (restante > 0) {
        const alto = Math.min(altoPaginaPx, restante)
        const trozo = document.createElement("canvas")
        trozo.width = canvas.width
        trozo.height = alto
        trozo.getContext("2d").drawImage(canvas, 0, offset, canvas.width, alto, 0, 0, canvas.width, alto)
        if (!primera) pdf.addPage()
        pdf.addImage(trozo.toDataURL("image/png"), "PNG", 0, 0, imgAnchoMm, (alto * imgAnchoMm) / canvas.width)
        offset += alto
        restante -= alto
        primera = false
      }
    }

    pdf.save(nombreArchivo)
  } finally {
    root.unmount()
    contenedor.remove()
  }
}
