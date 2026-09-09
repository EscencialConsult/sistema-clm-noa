import { createRoot } from "react-dom/client"
import { esperarImagenes } from "./esperarImagenes"

/* ---------------------------------------------------------------------
   Mismo patrón que el prototipo viejo (CML-Prelaborales.html: un <div
   id="print"> oculto que se llena y se manda a window.print() con
   @media print) — acá el "innerHTML armado a mano" se reemplaza por un
   componente React de verdad, montado en un nodo fuera de #root.

   El CSS que lo esconde/muestra vive en index.css (.hoja-impresion-root).
   --------------------------------------------------------------------- */
export function imprimirComponente(elemento) {
  let contenedor = document.getElementById("hoja-impresion-root")
  if (!contenedor) {
    contenedor = document.createElement("div")
    contenedor.id = "hoja-impresion-root"
    document.body.appendChild(contenedor)
  }

  const root = createRoot(contenedor)
  root.render(elemento)

  const limpiar = () => {
    window.removeEventListener("afterprint", limpiar)
    root.unmount()
  }
  window.addEventListener("afterprint", limpiar)

  // Dos frames para que React monte y el navegador pinte, más esperar el
  // logo del encabezado — si no, la primera impresión de la sesión sale
  // sin él (el <img> todavía no había terminado de bajar).
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      await esperarImagenes(contenedor)
      window.print()
    })
  })
}
