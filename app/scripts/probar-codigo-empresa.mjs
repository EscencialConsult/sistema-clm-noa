/* =====================================================================
   El código de empresa se asigna solo (migración 024).

   Se prueba con sesión de RECEPCIÓN y no de administrador, porque el
   riesgo concreto está ahí: `numerador` tiene RLS con una sola política
   —la de lectura—, así que un trigger común correría con los permisos
   de quien inserta, el UPDATE del contador afectaría cero filas y la
   empresa se guardaría sin código. Probándolo como dueño de la base eso
   da verde igual.

       node scripts/probar-codigo-empresa.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")
const RAIZ = path.resolve(APP, "..")

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const API = "http://localhost:8000"
const MARCA = "ZZCODEMP"

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }

const psql = (sql) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: sql }
).trim()

const admin = async (ruta, opts) => {
  const r = await fetch(`${API}${ruta}`, {
    ...opts,
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  return r.json()
}

function limpiar() {
  psql(`DELETE FROM empresa WHERE razon_social LIKE '${MARCA}%';`)
}
function purgarUsuarios() {
  psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
}

async function crearUsuario(nombre, rol) {
  purgarUsuarios()
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) {
    console.log(`  No se pudo crear ${email}: ${JSON.stringify(creado).slice(0, 200)}`)
    process.exit(1)
  }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
        VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass, authId: creado.id }
}

console.log("")
console.log("El código de empresa se asigna solo")

const u = await crearUsuario("recepcion", "R2")
const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
if (eLogin) { console.log(`  No se pudo entrar como Recepción: ${eLogin.message}`); process.exit(1) }

limpiar()

/* El contador se guarda para dejarlo como estaba: esta prueba consume
   números, y no hay motivo para que la clínica vea saltos en la
   numeración por haberla corrido. */
const contadorAntes = psql("SELECT proximo_valor FROM numerador WHERE codigo='EMPRESA'")

const alta = (razon, codigo) =>
  c.from("empresa").insert({ razon_social: razon, ...(codigo !== undefined ? { codigo } : {}), activo: true })
    .select().single()

paso("1 · sin código, lo pone el sistema")
const esperado = Number(contadorAntes)
{
  const { data, error } = await alta(`${MARCA} UNO`)
  ok(!error && !!data, "Recepción puede dar de alta la empresa", error?.message ?? "")
  ok(data?.codigo === String(esperado), `sale con el ${esperado}`, `codigo = ${data?.codigo}`)
}
{
  const { data } = await alta(`${MARCA} DOS`)
  ok(data?.codigo === String(esperado + 1), "la siguiente es la que sigue", `codigo = ${data?.codigo}`)
}

paso("2 · con el campo vacío, igual que sin código")
{
  /* La pantalla manda "" cuando el usuario no escribe nada, no null.
     Si el trigger sólo mirara NULL, esa empresa quedaría con el código
     en blanco y ninguna otra podría quedar en blanco después: la
     columna es UNIQUE y '' choca contra ''. */
  const { data, error } = await alta(`${MARCA} TRES`, "")
  ok(!error, "no la rechaza", error?.message ?? "")
  ok(data?.codigo === String(esperado + 2), "y le pone el que sigue", `codigo = ${data?.codigo}`)
}

paso("3 · si lo escriben a mano, se respeta")
{
  const aMano = String(esperado + 40)
  const { data } = await alta(`${MARCA} CUATRO`, aMano)
  ok(data?.codigo === aMano, `queda el ${aMano}`, `codigo = ${data?.codigo}`)

  /* Y el contador se corre. Sin esto la próxima automática saldría con
     un número menor, y la de después chocaría contra la de a mano. */
  const { data: sig } = await alta(`${MARCA} CINCO`)
  ok(sig?.codigo === String(Number(aMano) + 1),
    "y la próxima automática arranca después", `codigo = ${sig?.codigo}`)
}

paso("4 · un código que no es número no arrastra el correlativo")
{
  const antes = psql("SELECT proximo_valor FROM numerador WHERE codigo='EMPRESA'")
  const { data, error } = await alta(`${MARCA} SEIS`, "MUNI-01")
  ok(!error && data?.codigo === "MUNI-01", "se puede usar un código propio", error?.message ?? "")
  const despues = psql("SELECT proximo_valor FROM numerador WHERE codigo='EMPRESA'")
  ok(antes === despues, "y el contador no se movió", `${antes} → ${despues}`)
}

paso("5 · el contador nunca queda atrás de lo que ya existe")
{
  const atras = psql(`
    SELECT count(*) FROM numerador n
     WHERE n.codigo='EMPRESA'
       AND n.proximo_valor <= (SELECT coalesce(max(codigo::bigint),0) FROM empresa WHERE codigo ~ '^[0-9]+$')`)
  ok(atras === "0", "ninguna empresa tiene un código que el contador vaya a repetir")
}

limpiar()
psql(`UPDATE numerador SET proximo_valor = ${Number(contadorAntes)} WHERE codigo='EMPRESA';`)
const quedo = psql("SELECT proximo_valor FROM numerador WHERE codigo='EMPRESA'")
ok(quedo === contadorAntes, "el contador quedó donde estaba", `${quedo}`)

purgarUsuarios()
await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: el código sale solo, se puede pisar a mano, y no se repite."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
