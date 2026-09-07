import { LogIn } from "lucide-react"

// Solo dev: entra directo con un usuario de prueba sin tipear nada.
const ACCESOS = [
  { label: "Admin", usuario: "admin", contrasena: "admin" },
  { label: "Médico Laboral", usuario: "mlopez", contrasena: "1234" },
]

export default function AccesosRapidosDev({ onEntrar, cargando }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-dashed border-white/40 px-2.5 py-1.5">
      <LogIn size={13} className="shrink-0 text-white/60" />
      {ACCESOS.map((a) => (
        <button
          key={a.usuario}
          type="button"
          disabled={cargando}
          onClick={() => onEntrar(a.usuario, a.contrasena)}
          className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:border-white/60 hover:text-white disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
