import { createClient } from "@supabase/supabase-js"

/* ---------------------------------------------------------------------
   El ÚNICO lugar del proyecto que crea el cliente de Supabase.
   Todos los servicios de features/ lo importan de acá, para que la
   sesión, el manejo de errores y el "sesión vencida" se resuelvan en un
   solo lugar y no en diez.

   La URL apunta al servidor DE LA CLÍNICA, no a la nube: Supabase corre
   autoalojado en la PC del consultorio (ver Arquitectura, §2).

   Y una advertencia que conviene tener presente al escribir servicios:
   esta clave viaja al navegador y cualquiera puede leerla. No es un
   descuido, es cómo funciona — por eso la seguridad real son las
   políticas RLS dentro de la base (004_politicas_rls.sql), no lo que
   esconda la pantalla.
   --------------------------------------------------------------------- */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
    "Copiá .env.example a .env y completalos con los datos del servidor."
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** El usuario de la sesión, con su rol. Null si no hay sesión. */
export async function getSesion() {
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}
