import { LogIn } from "lucide-react"

// Solo dev: entra directo con un usuario de prueba sin tipear nada.
// Estilo sólido a propósito — Facundo pidió que se vean bien, no discretos.
const ACCESOS = [
  { label: "Admin", usuario: "admin", contrasena: "admin" },
  { label: "Médico Laboral", usuario: "mlopez", contrasena: "1234" },
]

export default function AccesosRapidosDev({ onEntrar, cargando }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-primary-deep px-3 py-2 shadow-lg">
      <LogIn size={15} className="shrink-0 text-white/70" />
      <span className="text-xs text-white/70">dev · entrar como</span>
      {ACCESOS.map((a) => (
        <button
          key={a.usuario}
          type="button"
          disabled={cargando}
          onClick={() => onEntrar(a.usuario, a.contrasena)}
          className="rounded bg-white/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
