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

/* Con VITE_SUPABASE_URL en «origen» la API se busca en la misma
   dirección desde la que se cargó la pantalla. Eso deja que el mismo
   build sirva en localhost, en el servidor de la clínica y detrás de un
   túnel o un dominio, sin recompilar cada vez que cambia la dirección.

   Requiere que quien sirve la pantalla proxee /auth /rest /storage a
   Kong; el nginx del contenedor `app` ya lo hace. Con una URL completa
   se comporta como siempre. */
const configurada = (import.meta.env.VITE_SUPABASE_URL ?? "").trim()
/* Se acepta con puerto y sin puerto —«origen» y «origen:8000»— porque
   docker-compose le pega SIEMPRE el puerto de Kong al armar la variable,
   incluso cuando se lo pasa vacío. Comparar contra "origen" a secas dejó
   la pantalla en blanco: createClient recibía "origen:8000", que no es
   una URL, y reventaba antes de dibujar nada. */
const mismoOrigen = /^origen(:\d+)?$/.test(configurada)
const url = mismoOrigen ? window.location.origin : configurada
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
