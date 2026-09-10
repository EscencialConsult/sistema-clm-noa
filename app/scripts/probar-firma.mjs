/* =====================================================================
   Quién puede cerrar una orden, y con la matrícula de quién.

   El sistema arrancó permitiéndoselo sólo al médico laboral. Parecía lo
   correcto —RF22 dice "el Médico laboral dictamina"— pero confundía dos
   cosas: quién DECIDE y quién TIPEA. En la clínica lo dice la operadora
   en el relevamiento:

       "Y acá nosotros cargamos la aptitud. Una vez que el doctor lo
        informa, yo pongo si ella está apta o no apta."

   Con la versión anterior el circuito se cortaba en el último paso.
   Desde la migración 023 recepción puede transcribirla, pero tiene que
   decir de quién es la firma: la matrícula del protocolo es la del
   médico, no la de quien tipea.

   Esta prueba fija las dos mitades: que recepción pueda, y que no pueda
   firmar por sí misma ni saltearse nada.

       node scripts/probar-firma.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const MARCA = "ZZFIRMA"
let fallas = 0
const ok = (b, t, d = "") => { console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`); if (!b) fallas++ }
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }

const psql = (t) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: t }
).trim()

/* Por psql: el sistema no permite borrar una orden, y está bien. */

/* ------------------------------------------------------------------
   Usuarios propios.

   No se usan las cuentas de la máquina de desarrollo: en una
   instalación limpia no existe ninguna, y el CI corre siempre sobre
   una base recién creada. Cada batería crea las suyas, con contraseña
   al azar que vive en memoria, y las borra al terminar.
   ------------------------------------------------------------------ */
const API = "http://localhost:8000"

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

async function crearUsuario(nombre, rol, profesional) {
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  /* El filtro va acá y no en la URL: GoTrue ignora ?email= y devuelve la
     lista entera. Confiar en él borraría todas las cuentas. Ya pasó. */
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) {
    console.log(`\n  No se pudo crear ${email}: ${JSON.stringify(creado).slice(0, 200)}`)
    process.exit(1)
  }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, profesional_id, debe_cambiar)
        VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', ${profesional ?? "NULL"}, false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass, authId: creado.id }
}

async function entrar(u) {
  const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
  if (error) { console.log(`\n  No se pudo entrar como ${u.email}: ${error.message}`); process.exit(1) }
  return c
}

const borrarUsuarios = async (us) => {
  for (const u of us) await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })
}

const limpiar = () => psql(`
  DELETE FROM orden_estudio   WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
  DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
  DELETE FROM orden           WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
  DELETE FROM persona         WHERE apellido LIKE '${MARCA}%';
  DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
  DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
  DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)


console.log("")
console.log("Quién cierra la orden, y con qué matrícula")

limpiar()
/* El médico necesita un profesional asociado: sin matrícula no firma. */
const idProf = Number(psql("SELECT id FROM profesional WHERE activo ORDER BY id LIMIT 1;"))
const uAdmin = await crearUsuario("admin", "R1")
const uRecep = await crearUsuario("recep", "R2")
const uMedico = await crearUsuario("medico", "R3", idProf)
const uLabo = await crearUsuario("labo", "R5")
const admin_ = await entrar(uAdmin)
const recep = await entrar(uRecep)
const medico = await entrar(uMedico)

/** Una orden con todo cargado, lista para informar. */
async function ordenLista(n) {
  const { data: per } = await admin_.from("persona").insert({
    tipo_doc: "DNI", nro_doc: `9099930${n}`, apellido: `${MARCA} ${n}`, nombre: "X", sexo: "M",
  }).select().single()
  const { data: emp } = await admin_.from("empresa").select("id").eq("activo", true).limit(1).single()
  const { data: id } = await admin_.rpc("crear_orden", { p_persona: per.id, p_empresa: emp.id, p_plantilla: 1 })
  psql(`UPDATE orden_estudio SET estado='CARGADO', resultado='NORMAL' WHERE orden_id=${id};`)
  return id
}

paso("recepción transcribe, eligiendo el médico")
{
  const id = await ordenLista(1)
  const { data: prof } = await admin_.from("profesional").select("id, apellido_nombre").eq("activo", true).limit(1).single()
  const { error } = await recep.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO", p_medico: prof.id })
  ok(!error, "puede emitir", error?.message ?? "")
  const { data: o } = await admin_.from("orden").select("aptitud, estado, medico_laboral_id").eq("id", id).single()
  ok(o.aptitud === "APTO" && o.estado === "INFORMADA", "la orden queda informada como APTO")
  ok(o.medico_laboral_id === prof.id, "el firmante es el médico elegido, no quien tipeó", prof.apellido_nombre)
  const quien = psql(`SELECT u.usuario FROM auditoria a JOIN usuario u ON u.id=a.usuario_id
                       WHERE a.tabla='orden' AND a.registro_id=${id} AND a.campo='aptitud' LIMIT 1;`)
  /* La comparación va contra el usuario exacto, y de paso comprueba lo
     que de verdad importa: que NO diga el del médico. Quien tipea y
     quien firma tienen que quedar separados. */
  ok(quien === `${MARCA}_recep`, "la auditoría guarda quién lo cargó, no quién firma",
     quien || "(vacío)")
}

paso("recepción sin elegir médico")
{
  const id = await ordenLista(2)
  const { error } = await recep.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO" })
  ok(!!error && /qué médico laboral firma/i.test(error.message), "lo rechaza", error?.message ?? "NO rechazó")
}

paso("recepción con un profesional que no existe")
{
  const id = await ordenLista(3)
  const { error } = await recep.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO", p_medico: 99999 })
  ok(!!error && /no existe/i.test(error.message), "lo rechaza", error?.message ?? "NO rechazó")
}

paso("el médico sigue firmando con SU matrícula")
{
  const id = await ordenLista(4)
  const { data: otro } = await admin_.from("profesional").select("id").eq("activo", true).order("id", { ascending: false }).limit(1).single()
  const { error: e1 } = await medico.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO", p_medico: otro.id })
  ok(!!e1 && /a nombre de otro/i.test(e1.message), "no puede firmar por otro", e1?.message ?? "NO rechazó")
  const { error: e2 } = await medico.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO" })
  ok(!e2, "y sin indicar nadie, firma él", e2?.message ?? "")
}

paso("con estudios sin cargar, nadie puede")
{
  const id = await ordenLista(5)
  psql(`UPDATE orden_estudio SET estado='PENDIENTE'
         WHERE id IN (SELECT id FROM orden_estudio WHERE orden_id=${id} LIMIT 3);`)
  const { data: prof } = await admin_.from("profesional").select("id").eq("activo", true).limit(1).single()
  const { error } = await recep.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO", p_medico: prof.id })
  ok(!!error && /sin cargar/i.test(error.message), "lo rechaza", error?.message ?? "NO rechazó")
}

paso("un rol que no corresponde")
{
  const id = await ordenLista(6)
  const labo = await entrar(uLabo)
  const { data: prof } = await admin_.from("profesional").select("id").eq("activo", true).limit(1).single()
  const { error } = await labo.rpc("emitir_protocolo", { p_orden: id, p_aptitud: "APTO", p_medico: prof.id })
  ok(!!error, "laboratorio no puede emitir", error?.message ?? "NO rechazó")
}

paso("y la aptitud sigue sin poder escribirse a mano")
{
  /* Es SEG-01. Se repite acá porque este cambio es justo el que podría
     reabrir el agujero de la migración 019 sin que nadie lo note. */
  const id = await ordenLista(7)
  const { data: filas } = await recep.from("orden").update({ aptitud: "APTO" }).eq("id", id).select()
  ok((filas ?? []).length === 0, "la base rechaza el UPDATE directo", `${(filas ?? []).length} filas`)
}

limpiar()
await borrarUsuarios([uAdmin, uRecep, uMedico, uLabo])
console.log("")
console.log(fallas === 0
  ? "Todo en verde: recepción transcribe, pero la firma sigue siendo del médico."
  : `${fallas} comprobaciones en rojo`)
process.exit(fallas ? 1 : 0)
