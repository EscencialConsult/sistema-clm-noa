import { useEffect, useState } from "react"
import { ArrowUpCircle } from "lucide-react"
import { supabase } from "../lib/supabase"

/* ---------------------------------------------------------------------
   El pie que dice en qué versión está el sistema.

   Parece un detalle y no lo es: cuando alguien llama desde Tucumán
   diciendo "no me anda", la primera pregunta deja de ser una adivinanza
   —"¿tenés lo último?"— y pasa a ser "¿qué dice abajo?".

   El dato lo escribe el servidor en estado_sistema: la versión sale del
   registro de migraciones, o sea de lo que la base REALMENTE tiene
   aplicado, no de un número en un archivo que alguien se puede olvidar
   de subir.

   El aviso de actualización lo pone una tarea diaria. Sólo avisa: quién
   y cuándo se actualiza lo decide una persona, porque reiniciar el
   sistema a las 10:40 con la sala llena es un problema.
   --------------------------------------------------------------------- */
export default function PieVersion() {
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    let vivo = true
    supabase
      .from("estado_sistema")
      .select("clave, valor")
      .then(({ data, error }) => {
        /* Si falla no se muestra nada. Un pie informativo no puede
           ensuciar la pantalla con un error. */
        if (!vivo || error || !data) return
        setEstado(Object.fromEntries(data.map((f) => [f.clave, f.valor])))
      })
    return () => { vivo = false }
  }, [])

  if (!estado) return null

  const version = estado.version && estado.version !== "sin registrar" ? estado.version : null
  const pendientes = Number(estado.actualizaciones ?? 0)

  if (!version && !pendientes) return null

  return (
    <div className="flex items-center justify-center gap-3 px-8 pb-6 pt-2 text-[11px] text-ink-soft/70">
      <span>CML NOA · Prelaboral{version ? ` · base ${version}` : ""}</span>

      {pendientes > 0 && (
        <span
          className="flex items-center gap-1.5 rounded-full border border-primary/30 px-2 py-0.5 text-primary"
          title="El servidor tiene cambios sin aplicar. Los aplica quien administra el sistema, en un horario sin gente esperando."
        >
          <ArrowUpCircle size={12} />
          {pendientes} actualización{pendientes === 1 ? "" : "es"} sin aplicar
        </span>
      )}
    </div>
  )
}
