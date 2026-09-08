/* ---------------------------------------------------------------------
   Las consultas de la pantalla de aptitud y del legajo, contra el
   sistema andando · CU-11, RF22/RF23

   Uso:  node scripts/probar-aptitud.mjs      (desde app/)

   Usa el MISMO cliente que el navegador (@supabase/supabase-js) y una
   sesión real de médico laboral. Que la aplicación compile no dice nada
   sobre si las consultas existen: una columna mal escrita o un embed
   que RLS no deja seguir se ve recién acá.

   Recorre el circuito entero: recepción abre la orden, se cargan los
   estudios, el médico dictamina, y después se comprueba que ya no se
   pueda tocar. Se crea sus propios usuarios y borra todo al terminar.
   --------------------------------------------------------------------- */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import { execFileSync } from "child_process"

import path from "path"
import { fileURLToPath } from "url"

/* app/scripts/ → la raíz del proyecto */
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

const MARCA = "ZZAPT"
const pasos = []
const paso = (n, ok, det) => { pasos.push({ n, ok, det }); console.log(`  ${ok ? "✔" : "✘"}  ${n}\n        ${det}`) }

/* ---------- limpiar ---------- */
function limpiar() {
  sql(`
    DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
    DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';
    DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario LIKE '${MARCA}%');
    DELETE FROM usuario     WHERE usuario LIKE '${MARCA}%';
  `)
}

async function crearUsuario(nombre, rol, profesional) {
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  /* Si quedó una cuenta de una corrida anterior, se borra. El filtro se
     aplica ACÁ y no en la URL: GoTrue ignora ?email= y devuelve la lista
     entera, así que confiar en él borraría todas las cuentas del sistema.
     Ya pasó una vez. */
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) throw new Error("no se creó " + email + ": " + JSON.stringify(creado))
  sql(`INSERT INTO usuario (usuario, nombre, auth_id, profesional_id, debe_cambiar)
       VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', ${profesional ?? "NULL"}, false);
       INSERT INTO usuario_rol (usuario_id, rol_codigo)
       SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass, authId: creado.id }
}

const cliente = () => createClient(API, env.ANON_KEY, { auth: { persistSession: false } })

async function entrar(u) {
  const c = cliente()
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
  if (error) throw new Error("login: " + error.message)
  return c
}

/* ====================== las consultas de aptitudService ====================== */
const SELECT_ORDEN = `
  id, numero, fecha, tipo_examen, tarea, estado, aptitud, importe,
  preexistencias, incapacidad_pct, observaciones, informado_at,
  persona:persona_id ( id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac ),
  empresa:empresa_id ( id, razon_social ),
  medico_laboral:medico_laboral_id ( apellido_nombre, especialidad, matricula_prov, matricula_nac )
`

async function main() {
  limpiar()
  const uRecep  = await crearUsuario("recep",  "R2", null)
  const uAdmin  = await crearUsuario("admin",  "R1", null)
  const uMedico = await crearUsuario("medico", "R3", 1)

  const cRecep  = await entrar(uRecep)
  const cAdmin  = await entrar(uAdmin)
  const cMedico = await entrar(uMedico)

  /* --- preparar: persona + orden + todo cargado --- */
  const { data: per, error: ePer } = await cRecep.from("persona").insert({
    tipo_doc: "DNI", nro_doc: "90500001", apellido: `${MARCA} DICTAMEN`, nombre: "ANA", sexo: "F",
    fecha_nac: "1990-05-10",
  }).select().single()
  if (ePer) throw new Error("persona: " + ePer.message)

  const { data: ordenId, error: eOrd } = await cRecep.rpc("crear_orden", {
    p_persona: per.id, p_empresa: 1, p_plantilla: 3,
  })
  if (eOrd) throw new Error("crear_orden: " + eOrd.message)

  /* --- getOrdenesParaInformar con la orden AÚN incompleta --- */
  let { data: paraInf, error: e1 } = await cMedico.from("orden").select(SELECT_ORDEN)
    .eq("estado", "COMPLETA").order("fecha", { ascending: true })
  if (e1) paso("getOrdenesParaInformar", false, e1.message)
  else paso("getOrdenesParaInformar (orden incompleta)", !paraInf.some((o) => o.id === ordenId),
    `${paraInf.length} para dictaminar; la incompleta no aparece, como debe ser`)

  /* --- getOrden + getEstudiosDeOrden --- */
  const { data: orden, error: e2 } = await cMedico.from("orden").select(SELECT_ORDEN).eq("id", ordenId).single()
  paso("getOrden", !e2, e2 ? e2.message : `orden ${orden.numero} · ${orden.persona.apellido}, ${orden.persona.nombre}`)

  const { data: filas, error: e3 } = await cMedico.from("orden_estudio")
    .select(`id, estado, resultado, detalle, observacion, fuera_de_rango,
             estudio:estudio_id ( id, nombre, unidad, ref_h, ref_m, orden,
               categoria:categoria_id ( id, nombre, orden ) )`)
    .eq("orden_id", ordenId).order("orden", { referencedTable: "estudio", ascending: true })
  paso("getEstudiosDeOrden", !e3, e3 ? e3.message : `${filas?.length} estudios, agrupables por categoría`)

  /* --- CP-19 por la pantalla: emitir con estudios pendientes --- */
  const { error: e4 } = await cMedico.rpc("emitir_protocolo", {
    p_orden: ordenId, p_aptitud: "APTO", p_preexistencias: null, p_incapacidad: null,
  })
  paso("emitir con pendientes (CP-19)", !!e4 && /Quedan \d+ estudios/.test(e4.message),
    e4 ? e4.message : "NO rechazó")

  /* --- completar la orden y dictaminar de verdad --- */
  const { error: e5 } = await cAdmin.from("orden_estudio")
    .update({ estado: "CARGADO", resultado: "NORMAL" }).eq("orden_id", ordenId).neq("estado", "CARGADO")
  if (e5) throw new Error("completar: " + e5.message)

  const { data: paraInf2 } = await cMedico.from("orden").select(SELECT_ORDEN).eq("estado", "COMPLETA")
  paso("la orden completa aparece para dictaminar", paraInf2.some((o) => o.id === ordenId),
    `${paraInf2.length} esperando dictamen`)

  /* --- emitir(): observaciones por PATCH + rpc --- */
  const { error: e6 } = await cMedico.from("orden")
    .update({ observaciones: "Sin novedades de especialidades." }).eq("id", ordenId)
  paso("guardar observaciones (PATCH del médico)", !e6, e6 ? e6.message : "guardadas")

  const { error: e7 } = await cMedico.rpc("emitir_protocolo", {
    p_orden: ordenId, p_aptitud: "APTO",
    p_preexistencias: "HDL levemente bajo", p_incapacidad: 0,
  })
  paso("emitir_protocolo (CP-20: preexistencia con APTO)", !e7, e7 ? e7.message : "emitido")

  /* --- lo que muestra la pantalla después --- */
  const { data: fin } = await cMedico.from("orden").select(SELECT_ORDEN).eq("id", ordenId).single()
  const m = fin?.medico_laboral
  paso("estado y firma tras emitir",
    fin?.estado === "INFORMADA" && fin?.aptitud === "APTO" && !!m?.matricula_prov && !!m?.matricula_nac,
    `${fin?.estado} · ${fin?.aptitud} · ${m?.apellido_nombre} MP ${m?.matricula_prov} MN ${m?.matricula_nac} · preex: ${fin?.preexistencias} · obs: ${fin?.observaciones}`)

  /* --- getInformadasDeHoy --- */
  const hoy = new Date().toISOString().slice(0, 10)
  const { data: inf, error: e8 } = await cMedico.from("orden").select(SELECT_ORDEN)
    .eq("estado", "INFORMADA").gte("informado_at", `${hoy}T00:00:00`)
    .order("informado_at", { ascending: false })
  paso("getInformadasDeHoy", !e8 && inf.some((o) => o.id === ordenId),
    e8 ? e8.message : `${inf.length} informadas hoy`)

  /* --- datos del protocolo impreso --- */
  const { error: e9 } = await cMedico.from("orden_estudio")
    .select(`resultado, detalle, observacion, fuera_de_rango,
             estudio:estudio_id ( nombre, unidad, ref_h, ref_m, orden,
               categoria:categoria_id ( id, nombre, orden ) )`)
    .eq("orden_id", ordenId).order("orden", { referencedTable: "estudio", ascending: true })
  paso("datos del protocolo impreso", !e9, e9 ? e9.message : "la consulta del impreso responde")

  /* --- legajo: buscarPersonas + getLegajo --- */
  const { data: pers, error: e10 } = await cMedico.from("persona")
    .select("id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac")
    .or("nro_doc.ilike.%90500001%").order("apellido", { ascending: true }).limit(25)
  paso("buscarPersonas por documento", !e10 && pers?.length === 1,
    e10 ? e10.message : `${pers?.length} resultado`)

  const { data: pers2, error: e11 } = await cMedico.from("persona")
    .select("id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac")
    .or(`apellido.ilike.%${MARCA}%,nombre.ilike.%${MARCA}%`).order("apellido", { ascending: true }).limit(25)
  paso("buscarPersonas por apellido", !e11 && pers2?.length >= 1,
    e11 ? e11.message : `${pers2?.length} resultado`)

  const { data: leg, error: e12 } = await cMedico.from("orden")
    .select(SELECT_ORDEN + ", fecha_vencimiento").eq("persona_id", per.id)
    .order("fecha", { ascending: false })
  paso("getLegajo", !e12 && leg?.length === 1,
    e12 ? e12.message : `${leg?.length} orden · vence ${leg?.[0]?.fecha_vencimiento}`)

  /* --- y que ya no se pueda tocar --- */
  const { data: retoque } = await cAdmin.from("orden_estudio")
    .update({ resultado: "RETOCADO" }).eq("orden_id", ordenId).select()
  paso("informada: los resultados quedan bloqueados", (retoque ?? []).length === 0,
    `${(retoque ?? []).length} filas modificadas`)

  /* --- limpieza --- */
  limpiar()
  for (const u of [uRecep, uAdmin, uMedico]) await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })

  const mal = pasos.filter((p) => !p.ok)
  console.log("")
  console.log(mal.length ? `FALLAN ${mal.length} de ${pasos.length}` : `Los ${pasos.length} pasos andan.`)
  process.exitCode = mal.length ? 1 : 0
}

main().catch(async (e) => {
  console.error("\nSe cortó:", e.message)
  try { limpiar() } catch {}
  process.exitCode = 1
})
