/* ---------------------------------------------------------------------
   Matriz de permisos: qué puede hacer cada rol, de verdad y por la API.

   Uso:  node scripts/probar-permisos.mjs      (desde app/)

   Cada rol intenta las nueve operaciones sensibles del sistema, con su
   propia sesión, y se compara contra lo que los requisitos dicen que
   debería poder. Una celda que no coincide se marca con «!».

   Cada intento usa datos propios —su documento, su nombre de categoría—
   porque si todos escriben lo mismo, el segundo choca contra el índice
   único y parece que no tuviera permiso. La primera versión de esta
   prueba reportó ocho problemas por eso, y ninguno era real.

   Y «ver usuarios» no se mide con «vio algo»: cualquiera ve SU propia
   fila, eso es correcto. Se mide con cuántas ve.
   --------------------------------------------------------------------- */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { execFileSync } from "child_process"

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)
const API = "http://localhost:8000"
const MARCA = "ZZMAT"

const sql = (t) => execFileSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
], { cwd: RAIZ, encoding: "utf8", input: t }).trim()

const admin = async (ruta, opts = {}) => {
  const r = await fetch(`${API}${ruta}`, { ...opts, headers: {
    apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json" } })
  const t = await r.text()
  try { return t ? JSON.parse(t) : null } catch { return t }
}

const ROLES = [["R1", "admin"], ["R2", "recep"], ["R3", "medico"], ["R5", "labo"], ["R6", "rayos"]]

function limpiar() {
  sql(`DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
       DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
       DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
       DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';
       DELETE FROM auditoria      WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
       DELETE FROM usuario_rol    WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
       DELETE FROM usuario        WHERE usuario ILIKE '${MARCA}%';
       DELETE FROM categoria      WHERE nombre LIKE '${MARCA}%';
       DELETE FROM empresa        WHERE razon_social LIKE '${MARCA}%';`)
}

limpiar()
for (const u of (await admin("/auth/v1/admin/users"))?.users ?? []) {
  if (u.email?.startsWith(MARCA.toLowerCase())) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
}

const sesiones = {}
const authIds = []
for (const [rol, nombre] of ROLES) {
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }) })
  if (!creado?.id) { console.error("no pude crear", email); process.exit(1) }
  authIds.push(creado.id)
  sql(`INSERT INTO usuario (usuario, nombre, auth_id, profesional_id, debe_cambiar)
       VALUES ('${MARCA}_${nombre}', 'Matriz', '${creado.id}', ${rol === "R3" ? 1 : "NULL"}, false);
       INSERT INTO usuario_rol (usuario_id, rol_codigo)
       SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: pass })
  if (error) { console.error("login", email, error.message); process.exit(1) }
  sesiones[nombre] = c
}

/* Una orden con la que probar la aptitud: sin datos, «no pudo» no
   distingue entre no tener permiso y no tener a qué aplicarlo. */
const { data: per } = await sesiones.admin.from("persona").insert({
  tipo_doc: "DNI", nro_doc: "90850000", apellido: `${MARCA} ORDEN`, nombre: "BASE", sexo: "M",
}).select().single()
const { data: emp } = await sesiones.admin.from("empresa").select("id").eq("activo", true).limit(1).single()
const { data: ordenId } = await sesiones.admin.rpc("crear_orden", {
  p_persona: per.id, p_empresa: emp.id, p_plantilla: 1 })

const totalUsuarios = Number(sql("SELECT count(*) FROM usuario;"))

/* Cada intento devuelve true si LOGRÓ hacer lo que intentaba. Los datos
   llevan el nombre del rol, para que dos roles no choquen entre sí. */
const intentos = {
  "alta de persona": (c, q) => c.from("persona").insert({
    tipo_doc: "DNI", nro_doc: `9086000${q.i}`, apellido: `${MARCA} ${q.rol}`, nombre: "X", sexo: "M" }).select(),
  "alta de empresa": (c, q) => c.from("empresa").insert({ razon_social: `${MARCA} SA ${q.rol}` }).select(),
  "alta de categoría": (c, q) => c.from("categoria").insert({
    nombre: `${MARCA} CAT ${q.rol}`, orden: 90 + q.i, rol_carga: "R5", valor_defecto: "NORMAL" }).select(),
  "cambiar un precio": (c) => c.from("concepto").update({ precio: 55000 }).eq("id", 1).select(),
  "fijar una aptitud": (c) => c.from("orden").update({ aptitud: "APTO" }).eq("id", ordenId).select(),
  "borrar auditoría": (c) => c.from("auditoria").delete().gt("id", 0).select(),
  "darse otro rol": (c, q) => c.from("usuario_rol").insert({
    usuario_id: Number(sql(`SELECT id FROM usuario WHERE usuario='${MARCA}_${q.rol}';`)), rol_codigo: "R7" }).select(),
  "leer la auditoría": (c) => c.from("auditoria").select("id").limit(1),
}

const esperado = {
  "alta de persona": ["admin", "recep"],
  "alta de empresa": ["admin", "recep"],
  "alta de categoría": ["admin", "recep"],
  "cambiar un precio": ["admin"],
  /* Desde 019 NADIE la fija a mano, ni el médico: sólo
     emitir_protocolo(), que verifica que no falte nada (SEG-01). */
  "fijar una aptitud": [],
  "borrar auditoría": [],
  "darse otro rol": ["admin"],
  "leer la auditoría": ["admin"],
}

console.log("")
console.log("  operación                 " + ROLES.map(([, n]) => n.padEnd(8)).join(""))
let fallas = 0

for (const [nombre, fn] of Object.entries(intentos)) {
  const fila = []
  let i = 0
  for (const [, quien] of ROLES) {
    i++
    const { data, error } = await fn(sesiones[quien], { rol: quien, i })
    const pudo = !error && (data ?? []).length > 0
    const deberia = esperado[nombre].includes(quien)
    if (pudo !== deberia) { fila.push((pudo ? "SÍ!" : "no!").padEnd(8)); fallas++ }
    else fila.push((pudo ? "sí" : "·").padEnd(8))
  }
  console.log("  " + nombre.padEnd(26) + fila.join(""))
}

/* Ver usuarios: todos ven su propia fila. Lo que importa es si alguien
   ve las de los demás. */
const fila = []
for (const [, quien] of ROLES) {
  const { data } = await sesiones[quien].from("usuario").select("id")
  const ve = (data ?? []).length
  const deberia = quien === "admin" ? totalUsuarios : 1
  if (ve !== deberia) { fila.push(`${ve}!`.padEnd(8)); fallas++ }
  else fila.push(String(ve).padEnd(8))
}
console.log("  " + "usuarios que ve".padEnd(26) + fila.join(""))
console.log(`  ${" ".repeat(26)}(el admin los administra: ve ${totalUsuarios}; el resto, sólo el suyo)`)

limpiar()
for (const id of authIds) await admin(`/auth/v1/admin/users/${id}`, { method: "DELETE" })

console.log("")
console.log(fallas === 0
  ? "  Cada rol puede exactamente lo que le corresponde, y nada más."
  : `  ${fallas} celdas no coinciden con lo esperado (marcadas con !)`)
process.exitCode = fallas ? 1 : 0
