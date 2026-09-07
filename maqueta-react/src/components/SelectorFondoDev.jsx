import { Image as ImageIcon } from "lucide-react"

// Herramienta SOLO de maqueta: un botón para ir rotando entre las imágenes
// de fondo candidatas y comparar cuál queda mejor, antes de tener la foto
// real de la fachada. Se distingue a propósito del resto de la UI (borde
// punteado, esquina, chico) — no es un componente final del sistema.
export default function SelectorFondoDev({ fondos, indiceActual, onCambiar }) {
  const fondo = fondos[indiceActual]

  function siguiente() {
    onCambiar((indiceActual + 1) % fondos.length)
  }

  return (
    <button
      type="button"
      onClick={siguiente}
      className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-md border border-dashed border-white/40 bg-black/30 px-3 py-2 text-left text-[11px] text-white/80 backdrop-blur-sm hover:border-white/70 hover:text-white"
      title="Solo dev — rotar fondo candidato"
    >
      <ImageIcon size={14} />
      <span>
        dev · fondo {indiceActual + 1}/{fondos.length} — {fondo.label}
      </span>
    </button>
  )
}
