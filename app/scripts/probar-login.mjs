/* Prueba de humo del login: entra igual que el navegador, con la clave
   pública anon, y muestra qué ve cada rol. Uso: node scripts/probar-login.mjs */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const ROL_A_CLAVE = { R1: "administrador", R2: "recepcion", R3: "medico_laboral",
  R4: "medico_clinico", R5: "laboratorio", R6: "rayos", R7: "audiometria", R8: "psicologia" }

async function login(usuario, contrasena) {
  const email = usuario.includes("@") ? usuario : usuario.trim() + "@cmlnoa.local"
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena })
  if (error) return { error: "Usuario o contraseña incorrectos." }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error: e2 } = await supabase
    .from("usuario")
    .select("id, usuario, nombre, debe_cambiar, activo, usuario_rol(rol_codigo), profesional(especialidad, matricula_prov, matricula_nac)")
    .eq("auth_id", user.id)
    .single()
  if (e2 || !data) return { error: "sin fila en usuario: " + (e2?.message ?? "") }

  const codigos = (data.usuario_rol ?? []).map((r) => r.rol_codigo)
  return {
    sesion: {
      id: data.id, usuario: data.usuario, nombre_completo: data.nombre,
      rol: ROL_A_CLAVE[codigos[0]], roles: codigos,
      debe_cambiar_contrasena: data.debe_cambiar,
    },
  }
}

/* El admin va primero a propósito: ve a TODOS los usuarios, así que si
   alguien saca el filtro por auth_id, .single() falla solo con él. */
console.log("=== login admin (ve a todos los usuarios) ===")
console.log(JSON.stringify(await login("admin", "cambiar-en-el-primer-ingreso"), null, 2))

console.log("\n=== login correcto: recepcion ===")
console.log(JSON.stringify(await login("recepcion", "W6ImKpbnZLsW"), null, 2))

console.log("\n=== contraseña equivocada ===")
console.log(JSON.stringify(await login("recepcion", "cualquiera")))

console.log("\n=== usuario que no existe ===")
console.log(JSON.stringify(await login("nadie", "1234")))

/* Lo que ve recepción una vez adentro */
await supabase.auth.signInWithPassword({ email: "recepcion@cmlnoa.local", password: "W6ImKpbnZLsW" })
const { data: cats } = await supabase.from("categoria").select("nombre").order("orden").limit(4)
const { data: ords } = await supabase.from("orden").select("numero, estado, importe")
const { data: aud } = await supabase.from("auditoria").select("tabla").limit(1)
console.log("\n=== ya adentro, con la sesión de recepción ===")
console.log("  categorías:", cats?.map((c) => c.nombre).join(", "))
console.log("  órdenes:   ", JSON.stringify(ords))
console.log("  auditoría: ", JSON.stringify(aud), "← vacío: es del administrador")
