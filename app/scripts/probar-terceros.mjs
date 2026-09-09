/* El circuito de un informe de tercero, de punta a punta.
   Se corre desde app/: node scripts/_tmp-terceros.mjs */
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
const sql = (t) => execFileSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
], { cwd: RAIZ, encoding: "utf8", input: t }).trim()

const pasos = []
const paso = (n, ok, d) => { pasos.push(ok); console.log(`  ${ok ? "✔" : "✘"}  ${n}\n        ${d}`) }

/* Se crea su propio usuario en vez de depender de una contraseña real
   escrita acá: eso ata la prueba a una instalación concreta y se rompe en
   cuanto alguien la cambia o se reinstala de cero. */
const MARCA = "ZZTERC"
const admin = async (ruta, opts = {}) => {
  const r = await fetch(`${API}${ruta}`, { ...opts, headers: {
    apikey: env.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json" } })
  const t = await r.text()
  try { return t ? JSON.parse(t) : null } catch { return t }
}

const email = `${MARCA.toLowerCase()}@cmlnoa.local`
const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
const todas = await admin("/auth/v1/admin/users")
for (const u of todas?.users ?? []) {
  if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
}
sql(`DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
     DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
     DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
     DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';`)
sql(`DELETE FROM auditoria WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
     DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
     DELETE FROM usuario WHERE usuario ILIKE '${MARCA}%';`)
const creado = await admin("/auth/v1/admin/users", {
  method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }) })
if (!creado?.id) { console.error("no pude crear el usuario de prueba"); process.exit(1) }
sql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
     VALUES ('${MARCA}', 'Prueba terceros', '${creado.id}', false);
     INSERT INTO usuario_rol (usuario_id, rol_codigo)
     SELECT id, 'R2' FROM usuario WHERE auth_id='${creado.id}';`)

const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eL } = await c.auth.signInWithPassword({ email, password: pass })
if (eL) { console.error("login:", eL.message); process.exit(1) }

/* --- preparar: la prueba crea su propia orden ---
   Antes buscaba una orden que hubiera dejado otra prueba. Sobre una base
   recién instalada no hay ninguna y la prueba se cortaba sin comprobar
   nada. Una prueba que depende de la basura de otra no es una prueba. */

const { data: persona, error: eP } = await c.from("persona").insert({
  tipo_doc: "DNI", nro_doc: "90900001", apellido: `${MARCA} DERIVADO`,
  nombre: "CARLOS", sexo: "M",
}).select().single()
if (eP) { console.error("persona:", eP.message); process.exit(1) }

const { data: empresa } = await c.from("empresa").select("id").eq("activo", true).limit(1).single()
const { data: ordenId, error: eO } = await c.rpc("crear_orden", {
  p_persona: persona.id, p_empresa: empresa.id, p_plantilla: 3 })
if (eO) { console.error("crear_orden:", eO.message); process.exit(1) }

const id = sql(`SELECT id FROM orden_estudio WHERE orden_id=${ordenId} AND estado='PENDIENTE' LIMIT 1;`)
sql(`UPDATE orden_estudio SET estado='DERIVADO' WHERE id=${id};`)

/* 1 · aparece entre los que esperan informe */
const { data: der, error: e1 } = await c.from("orden_estudio")
  .select("id, estado, orden_id, estudio:estudio_id ( nombre )")
  .eq("estado", "DERIVADO")
paso("un estudio derivado aparece esperando informe (RF19)",
  !e1 && der.some((x) => String(x.id) === id),
  e1 ? e1.message : `${der.length} esperando · ${der.find((x)=>String(x.id)===id)?.estudio?.nombre}`)

const item = der.find((x) => String(x.id) === id)

/* 2 · con un derivado, la orden no se puede informar */
const faltan = sql(`SELECT count(*) FROM orden_estudio WHERE orden_id=${item.orden_id} AND estado <> 'CARGADO';`)
paso("mientras no vuelva, la orden no se puede cerrar", Number(faltan) > 0,
  `${faltan} estudios sin cargar en la orden`)

/* 3 · incorporar el informe */
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "latin1")
const ruta = `${item.orden_id}/${item.id}/${Date.now()}-ecg.pdf`
const { error: e3 } = await c.storage.from("informes")
  .upload(ruta, pdf, { contentType: "application/pdf" })
paso("se incorpora el informe tal como llegó", !e3, e3 ? e3.message : ruta)

/* 4 · y el estudio queda cargado en la misma acción */
const { error: e4 } = await c.from("orden_estudio")
  .update({ estado: "CARGADO", resultado: "NORMAL - VER INFORME" }).eq("id", item.id)
const estado = sql(`SELECT estado||' · '||coalesce(resultado,'—') FROM orden_estudio WHERE id=${item.id};`)
paso("el estudio pasa a cargado con el informe", !e4 && estado.startsWith("CARGADO"),
  e4 ? e4.message : estado)

/* 5 · el archivo se puede volver a mirar, con URL temporal */
const { data: firmada, error: e5 } = await c.storage.from("informes").createSignedUrl(ruta, 60)
let bytes = 0
if (firmada?.signedUrl) {
  const r = await fetch(firmada.signedUrl.startsWith("http") ? firmada.signedUrl : API + firmada.signedUrl)
  if (r.ok) bytes = (await r.arrayBuffer()).byteLength
}
paso("se puede volver a abrir con una URL temporal", !e5 && bytes > 0,
  e5 ? e5.message : `${bytes} bytes`)

/* 6 · pero no se puede borrar (RNF-28) */
const { data: borr } = await c.storage.from("informes").remove([ruta])
const sigue = await c.storage.from("informes").list(`${item.orden_id}/${item.id}`)
paso("un informe incorporado no se borra (RNF-28)",
  (sigue.data ?? []).some((a) => ruta.endsWith(a.name)),
  `el archivo sigue estando (borrado devolvió ${(borr ?? []).length} filas)`)

/* 7 · sin sesión no se ve nada */
const anon = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { data: verAnon } = await anon.storage.from("informes").list(`${item.orden_id}/${item.id}`)
paso("sin sesión no se lista ningún informe", (verAnon ?? []).length === 0,
  `${(verAnon ?? []).length} archivos`)



/* La orden primero: la creó este usuario y la referencia no lo deja borrar.
   Es la auditoría y las órdenes haciendo lo que tienen que hacer. */
sql(`DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
     DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
     DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
     DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';`)
sql(`DELETE FROM auditoria WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
     DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
     DELETE FROM usuario WHERE usuario ILIKE '${MARCA}%';`)
await admin(`/auth/v1/admin/users/${creado.id}`, { method: "DELETE" })

const mal = pasos.filter((x) => !x).length
console.log("")
console.log(mal ? `FALLAN ${mal} de ${pasos.length}` : `Los ${pasos.length} pasos andan.`)
process.exitCode = mal ? 1 : 0
