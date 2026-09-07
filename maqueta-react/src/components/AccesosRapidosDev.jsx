import { LogIn } from "lucide-react"

// Solo dev: entra directo con un usuario de prueba sin tipear nada.
// Estilo sólido y grande a propósito — Facundo pidió que se vean bien, no discretos.
const ACCESOS = [
  { label: "Admin", usuario: "admin", contrasena: "admin" },
  { label: "Médico Laboral", usuario: "mlopez", contrasena: "1234" },
]

export default function AccesosRapidosDev({ onEntrar, cargando }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-primary-deep px-4 py-3 shadow-lg">
      <LogIn size={18} className="shrink-0 text-white/70" />
      <span className="text-sm text-white/70">dev · entrar como</span>
      {ACCESOS.map((a) => (
        <button
          key={a.usuario}
          type="button"
          disabled={cargando}
          onClick={() => onEntrar(a.usuario, a.contrasena)}
          className="rounded-md bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
