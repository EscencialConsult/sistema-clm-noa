/* =====================================================================
   Deja tres prelaborales de ejemplo, uno en cada estado, para poder
   recorrer el circuito completo en pantalla sin inventar datos.

   Sirve para dos cosas: probar el circuito antes de la instalación, y
   mostrárselo a la clínica el día de la capacitación con casos que se
   ven distintos entre sí.

   IMPORTANTE: en esta fase RECEPCIÓN es quien carga los resultados
   (CU-07). Cada profesional pasa a cargarlos directo recién en Fase 2.
   Por eso el script hace todo con una sesión de Recepción y no de
   laboratorio, rayos ni médico: si con ese rol no se puede, en el
   mostrador tampoco se va a poder.

       node scripts/ejemplo-prelaboral.mjs           (desde app/)
       node scripts/ejemplo-prelaboral.mjs --borrar  (los saca)
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
/* Apellido con el que se reconocen los de ejemplo, para poder sacarlos
   después sin tocar nada real. */
const MARCA = "EJEMPLO"
const BORRAR = process.argv.includes("--borrar")

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

/* Las órdenes NO se borran por la API —no hay política de DELETE, y está
   bien: una orden clínica se corrige, no se elimina—. Para sacar los
   ejemplos se entra por psql como dueño de la base, que es la única vía. */
function borrarEjemplos() {
  psql(`
    DELETE FROM orden_estudio   WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden           WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
    DELETE FROM persona         WHERE apellido LIKE '${MARCA}%';`)
}

console.log("")
if (BORRAR) {
  borrarEjemplos()
  psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email?.startsWith(MARCA.toLowerCase())) {
      await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
    }
  }
  console.log("  Ejemplos borrados.")
  process.exit(0)
}

/* Cuenta propia de Recepción. No se usa una cuenta de la clínica: así
   corre igual en una instalación recién hecha, donde todavía no hay
   ninguna. */
async function crearRecepcion() {
  const email = `${MARCA.toLowerCase()}_recepcion@cmlnoa.local`
  const pass = "Ejemplo-" + Math.random().toString(36).slice(2, 10)
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) {
    console.log(`  No se pudo crear la cuenta: ${JSON.stringify(creado).slice(0, 200)}`)
    process.exit(1)
  }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
        VALUES ('${MARCA}_recepcion', 'Recepción de ejemplo', '${creado.id}', false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, 'R2' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass }
}

borrarEjemplos()
const u = await crearRecepcion()
const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
if (eLogin) { console.log(`  No se pudo entrar: ${eLogin.message}`); process.exit(1) }

const { data: empresa } = await c.from("empresa")
  .select("id, razon_social").eq("activo", true).order("razon_social").limit(1).single()
const { data: bateria } = await c.from("plantilla").select("id, nombre").eq("id", 1).single()
const { data: medico } = await c.from("profesional")
  .select("id, apellido_nombre, matricula_prov").eq("activo", true).order("id").limit(1).single()

console.log("Tres prelaborales de ejemplo")
console.log(`  empresa: ${empresa.razon_social}   ·   batería: ${bateria.nombre}`)
console.log("")

async function nuevaPersona(nombre, doc, sexo) {
  const { data, error } = await c.from("persona").insert({
    tipo_doc: "DNI", nro_doc: doc, apellido: `${MARCA} ${nombre}`, nombre: "Caso",
    sexo, fecha_nac: "1990-05-20",
  }).select().single()
  if (error) { console.log(`  falló el alta de ${nombre}: ${error.message}`); process.exit(1) }
  return data
}

async function nuevaOrden(persona, tarea) {
  const { data: id, error } = await c.rpc("crear_orden", {
    p_persona: persona.id, p_empresa: empresa.id, p_plantilla: bateria.id,
    p_tarea: tarea, p_tipo_examen: "PRELABORAL",
  })
  if (error) { console.log(`  falló crear_orden: ${error.message}`); process.exit(1) }
  const { data: o } = await c.from("orden").select("id, numero, importe, estado").eq("id", id).single()
  return o
}

/* Carga TODOS los estudios de la orden, categoría por categoría, con la
   misma función que aprieta el botón «Cargar toda en NORMAL» de la
   pantalla de carga. Es lo que hace recepción en el mostrador cuando la
   planilla del puesto vino toda normal. */
async function cargarTodo(ordenId) {
  const { data: cats } = await c.from("orden_estudio")
    .select("estudio:estudio_id ( categoria_id )").eq("orden_id", ordenId)
  const ids = [...new Set((cats ?? []).map((x) => x.estudio?.categoria_id).filter(Boolean))]
  for (const cat of ids) {
    const { error } = await c.rpc("cargar_categoria_normal", { p_orden: ordenId, p_categoria: cat })
    if (error) { console.log(`  falló la categoría ${cat}: ${error.message}`); process.exit(1) }
  }
  return ids.length
}

const pasos = []

/* ---- 1 · recién abierta: nadie pasó por ningún puesto todavía ---- */
{
  const p = await nuevaPersona("ABIERTA", "50000001", "M")
  const o = await nuevaOrden(p, "Operario de depósito")
  const { count } = await c.from("orden_estudio")
    .select("*", { count: "exact", head: true }).eq("orden_id", o.id)
  pasos.push({ n: o.numero, quien: p.apellido, estado: o.estado, det: `${count} estudios sin cargar` })
}

/* ---- 2 · todo cargado, falta la aptitud ---- */
{
  const p = await nuevaPersona("COMPLETA", "50000002", "F")
  const o = await nuevaOrden(p, "Administrativa")
  const cats = await cargarTodo(o.id)
  const { data: d } = await c.from("orden").select("estado").eq("id", o.id).single()
  pasos.push({ n: o.numero, quien: p.apellido, estado: d.estado, det: `${cats} categorías cargadas, sin aptitud` })
}

/* ---- 3 · cerrada y firmada ---- */
{
  const p = await nuevaPersona("INFORMADA", "50000003", "M")
  const o = await nuevaOrden(p, "Chofer")
  await cargarTodo(o.id)
  /* Recepción transcribe la aptitud, pero el protocolo lo firma el
     médico laboral: por eso hay que decir CUÁL (migración 023). */
  const { error } = await c.rpc("emitir_protocolo", {
    p_orden: o.id, p_aptitud: "APTO", p_medico: medico.id,
  })
  if (error) { console.log(`  falló emitir_protocolo: ${error.message}`); process.exit(1) }
  const { data: d } = await c.from("orden")
    .select("estado, aptitud, fecha_vencimiento").eq("id", o.id).single()
  pasos.push({
    n: o.numero, quien: p.apellido, estado: d.estado,
    det: `${d.aptitud} · firma ${medico.apellido_nombre} (MP ${medico.matricula_prov}) · vence ${d.fecha_vencimiento}`,
  })
}

for (const p of pasos) {
  console.log(`  N° ${p.n}  ${p.quien.padEnd(20)} ${p.estado.padEnd(10)} ${p.det}`)
}

/* Se anula el acceso, pero la ficha del usuario queda.

   No es una decisión de comodidad: `orden.creado_por` apunta a ella y la
   base rechaza borrarla mientras existan las órdenes. Está bien que lo
   haga — quién abrió una orden no se borra —. Así que se elimina la
   cuenta de acceso, que es lo que importa por seguridad, y la ficha se
   va recién con las órdenes, en --borrar. */
const todas = await admin("/auth/v1/admin/users")
for (const x of todas?.users ?? []) {
  if (x.email?.startsWith(MARCA.toLowerCase())) {
    await admin(`/auth/v1/admin/users/${x.id}`, { method: "DELETE" })
  }
}
psql(`UPDATE usuario SET activo = false WHERE usuario ILIKE '${MARCA}%';`)

console.log("")
console.log("  Listos. Entrá con tu usuario y buscalos en Pendientes del Día.")
console.log("  Para sacarlos:  node scripts/ejemplo-prelaboral.mjs --borrar")
