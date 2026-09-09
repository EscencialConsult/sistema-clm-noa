/* ---------------------------------------------------------------------
   Fechas locales, no UTC.

   `new Date().toISOString()` siempre devuelve la fecha en UTC. En
   Argentina (UTC-3) eso significa que a partir de las 21:00 ya es
   "mañana": una pantalla que pregunta por las órdenes de hoy se queda
   buscando un día que todavía no llegó y muestra vacío.

   Apareció de verdad — Facundo lo encontró en la Bandeja del Día un
   lunes a la noche (952dd96), y el mismo error estaba repetido en otros
   seis lugares. Por eso vive acá y no copiado en cada servicio: es la
   clase de cosa que se arregla en un archivo y vuelve en el de al lado.

   Todo lo que compare contra `orden.fecha` tiene que usar esto. Esa
   columna es un `date` que la base llena con la fecha del servidor de la
   clínica, no con UTC.
   --------------------------------------------------------------------- */

/** La fecha de hoy como la ve quien está mirando la pantalla: `2026-09-08`. */
export function hoyLocal() {
  return comoISO(new Date())
}

/** La fecha de hace n días, también local. */
export function haceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return comoISO(d)
}

/** El primer día del mes en curso. */
export function primerDiaDelMes() {
  const d = new Date()
  return comoISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Un Date a `YYYY-MM-DD` usando sus campos locales, sin pasar por UTC. */
export function comoISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Para comparar contra una marca de tiempo: `2026-09-08T00:00:00`. */
export const desdeMedianoche = (fecha) => `${fecha}T00:00:00`
