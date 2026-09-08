import { createRoot } from "react-dom/client"

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

  // Dos frames: uno para que React monte, otro para que el navegador pinte
  // antes de abrir el diálogo de impresión.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
}
