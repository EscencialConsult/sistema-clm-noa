import AppShell from "../layouts/AppShell"
import { Construction } from "lucide-react"

// Stub para las pantallas todavía no maquetadas de las 25 catalogadas
// en cerebro-facundo/proyectos/kaplan-cml-noa/proyecto.md — se reemplaza
// pantalla por pantalla, nunca se deja como "componente falso" definitivo.
export default function Placeholder({ titulo }) {
  return (
    <AppShell titulo={titulo} subtitulo="Pantalla pendiente de maquetar">
      <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-soft/25 py-24 text-ink-soft">
        <Construction size={28} strokeWidth={1.5} className="mb-3" />
        <p className="text-sm">Esta pantalla todavía no está maquetada.</p>
      </div>
    </AppShell>
  )
}
