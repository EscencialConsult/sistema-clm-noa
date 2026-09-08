// Simula latencia de red mientras no hay backend real.
// Cuando llegue el backend, este archivo deja de usarse (los services
// pasan a hacer fetch/axios real) — no hace falta borrarlo hasta ese momento.
export function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
