import { LogIn } from "lucide-react"

// Solo dev: entra directo con un usuario de prueba sin tipear nada.
// Reemplaza el texto de "probar con admin/admin..." de antes.
const ACCESOS = [
  { label: "Admin", usuario: "admin", contrasena: "admin" },
  { label: "Médico Laboral", usuario: "mlopez", contrasena: "1234" },
]

export default function AccesosRapidosDev({ onEntrar, cargando }) {
  return (
    <div className="absolute right-4 top-16 z-20 flex flex-col gap-1.5 rounded-md border border-dashed border-white/40 bg-black/30 p-2 backdrop-blur-sm">
      <span className="flex items-center gap-1.5 px-1 text-[10px] text-white/60">
        <LogIn size={12} /> dev · entrar como
      </span>
      {ACCESOS.map((a) => (
        <button
          key={a.usuario}
          type="button"
          disabled={cargando}
          onClick={() => onEntrar(a.usuario, a.contrasena)}
          className="rounded border border-dashed border-white/30 px-2 py-1 text-left text-[11px] text-white/80 hover:border-white/70 hover:text-white disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
