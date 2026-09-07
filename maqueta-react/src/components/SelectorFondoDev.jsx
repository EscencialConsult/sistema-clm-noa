import { useEffect, useRef, useState } from "react"
import { Image as ImageIcon } from "lucide-react"

// Herramienta SOLO de maqueta: elegir con miniaturas reales cuál imagen de
// fondo queda mejor, antes de tener la foto de la fachada del CML NOA.
// Popover trigger-anchored: scale(0.95→1) + opacity, ease-out fuerte, 150ms
// (ver animate skill — dropdowns 150–250ms, origen en el trigger).
export default function SelectorFondoDev({ fondos, indiceActual, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function alClickAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener("mousedown", alClickAfuera)
    return () => document.removeEventListener("mousedown", alClickAfuera)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 rounded border border-dashed border-white/40 px-2.5 py-1.5 text-[11px] text-white/80 hover:border-white/70 hover:text-white"
        title="Solo dev — elegir fondo candidato"
      >
        <ImageIcon size={13} />
        fondo {indiceActual + 1}/{fondos.length}
      </button>

      <div
        className="absolute right-0 top-full z-30 mt-1.5 flex origin-top-right gap-1.5 rounded-md border border-dashed border-white/40 bg-black/85 p-1.5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          transform: abierto ? "scale(1)" : "scale(0.95)",
          opacity: abierto ? 1 : 0,
          pointerEvents: abierto ? "auto" : "none",
        }}
      >
        {fondos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              onCambiar(i)
              setAbierto(false)
            }}
            title={f.label}
            className={`overflow-hidden rounded border-2 transition-colors ${
              i === indiceActual ? "border-accent" : "border-transparent hover:border-white/50"
            }`}
          >
            {f.src ? (
              <img src={f.src} alt={f.label} className="h-11 w-16 object-cover" />
            ) : (
              <div className="h-11 w-16 bg-linear-to-br from-primary-deep to-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
