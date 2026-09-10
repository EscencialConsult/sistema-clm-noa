import { ChevronLeft, ChevronRight } from "lucide-react"

export const FILAS_POR_PAGINA = 10

/* ---------------------------------------------------------------------
   Tira de páginas (1 2 3 … 28) para que las tablas no se vayan al
   infinito. Pedido directo: "hay partes donde se va al infinito, ponele
   tipo hojas 1,2,3,4,5".

   Nació adentro de la Bandeja del Día y se sacó acá cuando aparecieron
   las otras: Pendientes del Día trae 271 estudios y el Listado de
   Órdenes crece con el mes. Una sola implementación, así todas se ven y
   se manejan igual.

   La diferencia con la primera versión es la ventana. Aquella dibujaba
   TODOS los números: con 271 filas son 28 botones en una fila, y en
   Auditoría —casi tres mil registros— serían 293. Acá se muestran los
   de alrededor de la página actual, con la primera y la última siempre
   a mano, que es lo que uno necesita: moverse de a poco, o irse al
   principio o al final de una.
   --------------------------------------------------------------------- */

/** Qué números mostrar. Devuelve números y "…" donde hay un salto. */
function ventana(pagina, total, aLosCostados = 2) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const desde = Math.max(2, pagina - aLosCostados)
  const hasta = Math.min(total - 1, pagina + aLosCostados)

  const paginas = [1]
  if (desde > 2) paginas.push("…")
  for (let n = desde; n <= hasta; n++) paginas.push(n)
  if (hasta < total - 1) paginas.push("…")
  paginas.push(total)
  return paginas
}

export default function Paginador({ pagina, totalPaginas, onCambiar, cuantos }) {
  if (totalPaginas <= 1) return null

  return (
    <div className="mt-3 flex items-center justify-center gap-1">
      <button
        onClick={() => onCambiar(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
        className="rounded-md p-1 text-ink-soft hover:bg-ink-soft/10 disabled:opacity-30"
      >
        <ChevronLeft size={14} />
      </button>

      {ventana(pagina, totalPaginas).map((n, i) =>
        n === "…" ? (
          <span key={`s${i}`} className="px-1 text-xs text-ink-soft/60">…</span>
        ) : (
          <button
            key={n}
            onClick={() => onCambiar(n)}
            className={`h-6 min-w-6 rounded-md px-1.5 text-xs font-medium ${
              n === pagina ? "bg-primary text-white" : "text-ink-soft hover:bg-ink-soft/10"
            }`}
          >
            {n}
          </button>
        )
      )}

      <button
        onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}
        disabled={pagina === totalPaginas}
        className="rounded-md p-1 text-ink-soft hover:bg-ink-soft/10 disabled:opacity-30"
      >
        <ChevronRight size={14} />
      </button>

      {/* Cuántas filas hay en total: sin esto, "página 3 de 28" no dice
          si son 280 estudios o 2.800. */}
      {typeof cuantos === "number" && (
        <span className="ml-2 text-[11px] text-ink-soft/70">{cuantos} en total</span>
      )}
    </div>
  )
}

/** Corta la lista para la página actual y dice cuántas páginas hay. */
export function paginar(filas, pagina, porPagina = FILAS_POR_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina))
  /* Si la lista se achicó (un filtro), la página actual puede quedar
     más allá del final: se muestra la última en vez de una vacía. */
  const actual = Math.min(pagina, totalPaginas)
  return {
    totalPaginas,
    pagina: actual,
    filas: filas.slice((actual - 1) * porPagina, actual * porPagina),
  }
}
