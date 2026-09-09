/** Espera a que todas las <img> de un contenedor terminen de cargar
 *  (el logo del encabezado, sobre todo). Sin esto, tanto window.print()
 *  como html2canvas pueden disparar antes de que la imagen llegue —
 *  React ya pintó el <img>, pero el archivo todavía no bajó — y el
 *  encabezado sale sin logo la primera vez que se imprime o descarga. */
export function esperarImagenes(contenedor) {
  const imgs = [...contenedor.querySelectorAll("img")]
  return Promise.all(
    imgs.map((img) => {
      if (img.complete) return img.decode?.().catch(() => {}) ?? Promise.resolve()
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true })
        img.addEventListener("error", resolve, { once: true })
      })
    })
  )
}
