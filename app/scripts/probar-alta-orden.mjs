/* ---------------------------------------------------------------------
   Admisión y alta de orden, contra el sistema andando · CU-05, CU-06

   Uso:  node scripts/probar-alta-orden.mjs      (desde app/)

   Usa el MISMO cliente que el navegador y una sesión real de recepción.
   Recorre lo que hace la pantalla: buscar un documento que no está, dar
   de alta, que no deje duplicarlo, previsualizar la batería y crear la
   orden. Se crea sus propios usuarios y borra todo al terminar.
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
const comoISOLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const MARCA = "ZZALTA"

const sql = (t) => execFileSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
], { cwd: RAIZ, encoding: "utf8", input: t }).trim()

const admin = async (ruta, opts = {}) => {
  const r = await fetch(`${API}${ruta}`, {
    ...opts,
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  const t = await r.text()
  try { return t ? JSON.parse(t) : null } catch { return t }
}

const pasos = []
const paso = (n, ok, det) => {
  pasos.push({ n, ok })
  console.log(`  ${ok ? "✔" : "✘"}  ${n}\n        ${det}`)
}

function limpiar() {
  sql(`
    DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
    DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';
    DELETE FROM empresa        WHERE razon_social LIKE '${MARCA}%';
    DELETE FROM orden_estudio  WHERE estudio_id IN (SELECT id FROM estudio WHERE nombre LIKE '${MARCA}%');
    DELETE FROM estudio        WHERE nombre LIKE '${MARCA}%';
    DELETE FROM orden_categoria WHERE categoria_id IN (SELECT id FROM categoria WHERE nombre LIKE '${MARCA}%');
    DELETE FROM categoria      WHERE nombre LIKE '${MARCA}%';
    DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario LIKE '${MARCA}%');
    DELETE FROM usuario     WHERE usuario LIKE '${MARCA}%';
  `)
}

async function crearUsuario(nombre, rol) {
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  /* El filtro va acá y no en la URL: GoTrue ignora ?email= y devuelve la
     lista entera, así que confiar en él borraría todas las cuentas. */
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado?.id) throw new Error(`no se creó ${email}: ${JSON.stringify(creado)}`)
  sql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
       VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', false);
       INSERT INTO usuario_rol (usuario_id, rol_codigo)
       SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: pass })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return { cliente: c, authId: creado.id }
}

async function main() {
  limpiar()
  const recep = await crearUsuario("recep", "R2")
  const labo = await crearUsuario("labo", "R5")
  const cAdmin2 = (await crearUsuario("adm", "R1")).cliente
  const c = recep.cliente
  const DOC = "90700001"

  /* 1 · un documento que no está */
  const { data: vacio, error: e1 } = await c.from("persona")
    .select("id").eq("tipo_doc", "DNI").eq("nro_doc", DOC).maybeSingle()
  paso("buscar un documento que no está", !e1 && vacio === null,
    e1 ? e1.message : "devuelve null, sin romper")

  /* 2 · alta */
  const { data: persona, error: e2 } = await c.from("persona").insert({
    tipo_doc: "DNI", nro_doc: DOC, apellido: `${MARCA} ADMISION`, nombre: "LAURA",
    sexo: "F", fecha_nac: "1992-03-15", telefono: "381-555-0000",
  }).select().single()
  paso("dar de alta a la persona", !e2 && !!persona?.id,
    e2 ? e2.message : `id ${persona.id}`)

  /* 3 · no deja duplicar el documento (CP-03) */
  const { error: e3 } = await c.from("persona").insert({
    tipo_doc: "DNI", nro_doc: DOC, apellido: `${MARCA} OTRA`, nombre: "REPETIDA", sexo: "M",
  })
  paso("el mismo documento no se puede cargar dos veces", e3?.code === "23505",
    e3 ? `${e3.code} — la base lo rechaza` : "NO lo rechazó")

  /* 4 · ahora sí la encuentra */
  const { data: hallada } = await c.from("persona")
    .select("id, apellido, nombre, sexo").eq("tipo_doc", "DNI").eq("nro_doc", DOC).maybeSingle()
  paso("buscarla otra vez la trae", hallada?.id === persona.id,
    `${hallada?.apellido}, ${hallada?.nombre} · ${hallada?.sexo}`)

  /* 5 · empresas y baterías del formulario */
  const { data: empresas, error: e5 } = await c.from("empresa")
    .select("id, codigo, razon_social").eq("activo", true).order("razon_social")
  const { data: baterias, error: e6 } = await c.from("plantilla").select("id, nombre").order("id")
  paso("el formulario carga empresas y baterías", !e5 && !e6 && empresas.length > 0 && baterias.length > 0,
    (e5 || e6) ? (e5 ?? e6).message : `${empresas.length} empresas · ${baterias.length} baterías`)

  /* 6 · vista previa por sexo (CP-07) */
  const previa = async (sexo) => {
    const { data, error } = await c.from("plantilla_item")
      .select("sexo_aplica, estudio:estudio_id!inner ( id, nombre, activo, categoria:categoria_id ( id, nombre, orden ) )")
      .eq("plantilla_id", 3).in("sexo_aplica", ["A", sexo]).eq("estudio.activo", true)
    if (error) throw new Error(error.message)
    return data
  }
  const pF = await previa("F")
  const pM = await previa("M")
  const tieneBeta = (a) => a.some((x) => x.estudio.nombre.toUpperCase().includes("SUB UNIDAD BETA"))
  paso("la vista previa cambia según el sexo",
    pF.length === 56 && pM.length === 55 && tieneBeta(pF) && !tieneBeta(pM),
    `mujer ${pF.length} con subunidad beta · varón ${pM.length} sin ella`)

  /* 7 · crear */
  const { data: ordenId, error: e7 } = await c.rpc("crear_orden", {
    p_persona: persona.id, p_empresa: empresas[0].id, p_plantilla: 3,
    p_tarea: "OPERARIA DE DEPOSITO", p_tipo_examen: "PRELABORAL",
  })
  paso("crear la orden", !e7 && typeof ordenId === "number",
    e7 ? e7.message : `id ${ordenId}`)

  /* 8 · lo que muestra la pantalla después */
  const { data: creada, error: e8 } = await c.from("orden")
    .select(`id, numero, fecha, fecha_vencimiento, importe, tipo_examen, tarea,
             persona:persona_id ( apellido, nombre, tipo_doc, nro_doc ),
             empresa:empresa_id ( razon_social )`)
    .eq("id", ordenId).single()
  paso("la orden creada trae número, importe y vencimiento",
    !e8 && !!creada?.numero && Number(creada.importe) === 160000 && !!creada.fecha_vencimiento,
    e8 ? e8.message : `N° ${creada.numero} · $${creada.importe} · vence ${creada.fecha_vencimiento}`)

  /* 9 · con los estudios que corresponden */
  const { count: cuantos } = await c.from("orden_estudio")
    .select("*", { count: "exact", head: true }).eq("orden_id", ordenId)
  paso("se abrieron los estudios de la batería", cuantos === 56, `${cuantos} estudios`)

  /* 10 · el historial ya la muestra */
  const { data: hist } = await c.from("orden")
    .select("id, numero, fecha_vencimiento, empresa:empresa_id ( razon_social )")
    .eq("persona_id", persona.id).order("fecha", { ascending: false })
  paso("el historial de la persona la incluye", hist?.length === 1,
    `${hist?.length} orden · ${hist?.[0]?.empresa?.razon_social}`)

  /* 11 · quien no es recepción no abre órdenes */
  const { error: e11 } = await labo.cliente.rpc("crear_orden", {
    p_persona: persona.id, p_empresa: empresas[0].id, p_plantilla: 3,
  })
  paso("laboratorio no puede abrir una orden",
    !!e11 && /Recepción o el Administrador/.test(e11.message),
    e11 ? e11.message : "LA CREÓ, no debería")

  /* ---------- agregar y quitar estudios · RF11 (c) ---------- */

  const contarEstudios = async () =>
    (await c.from("orden_estudio").select("*", { count: "exact", head: true }).eq("orden_id", ordenId)).count

  const antesN = await contarEstudios()

  /* 12 · agregar un estudio suelto que la batería no traía */
  const { data: suelto } = await c.from("estudio")
    .select("id, nombre, categoria:categoria_id ( id, nombre )")
    .eq("activo", true).ilike("nombre", "%CAMPIMETRIA%").limit(1).maybeSingle()
  await c.from("orden_categoria").upsert(
    { orden_id: ordenId, categoria_id: suelto.categoria.id },
    { onConflict: "orden_id,categoria_id", ignoreDuplicates: true })
  const { error: e12 } = await c.from("orden_estudio").insert({ orden_id: ordenId, estudio_id: suelto.id })
  const despuesN = await contarEstudios()
  paso("recepción agrega un estudio suelto (RF11 c)", !e12 && despuesN === antesN + 1,
    e12 ? e12.message : `${antesN} → ${despuesN} estudios (${suelto.nombre})`)

  /* 13 · el mismo estudio no entra dos veces */
  const { error: e13 } = await c.from("orden_estudio").insert({ orden_id: ordenId, estudio_id: suelto.id })
  paso("el mismo estudio no se agrega dos veces", e13?.code === "23505",
    e13 ? `${e13.code} — la base lo rechaza` : "lo dejó duplicar")

  /* 14 · quitarlo deja la orden como estaba */
  const { data: fila } = await c.from("orden_estudio").select("id")
    .eq("orden_id", ordenId).eq("estudio_id", suelto.id).single()
  const { data: borradas, error: e14 } = await c.from("orden_estudio").delete().eq("id", fila.id).select()
  const finalN = await contarEstudios()
  paso("quitar un estudio pendiente", !e14 && (borradas ?? []).length === 1 && finalN === antesN,
    e14 ? e14.message : `${despuesN} → ${finalN} estudios`)

  /* 15 · un estudio YA CARGADO no se puede quitar: se corrige */
  const { data: unos } = await c.from("orden_estudio").select("id").eq("orden_id", ordenId).limit(1)
  await cAdmin2.from("orden_estudio").update({ estado: "CARGADO", resultado: "NORMAL" }).eq("id", unos[0].id)
  const { data: noBorra } = await c.from("orden_estudio").delete().eq("id", unos[0].id).select()
  paso("un estudio ya cargado NO se puede quitar", (noBorra ?? []).length === 0,
    `${(noBorra ?? []).length} filas borradas — se corrige, no se quita`)

  /* 16 · el importe se recalcula, y recepción puede */
  const { data: imp, error: e16 } = await c.rpc("calcular_presupuesto", { p_orden: ordenId })
  paso("recepción puede recalcular el importe", !e16 && Number(imp) > 0,
    e16 ? e16.message : "importe " + imp)

  /* ---------- las otras tres pantallas de recepción ---------- */

  /* 12 · alta de empresa (CU-05) */
  const { data: emp, error: f12 } = await c.from("empresa").insert({
    razon_social: `${MARCA} TRANSPORTES`, codigo: "ZZT", cuit: "30-99999999-9",
    domicilio: "Ruta 9 km 1300", telefono: "381-555-1111", activo: true,
  }).select().single()
  paso("recepción da de alta una empresa", !f12 && !!emp?.id,
    f12 ? f12.message : `id ${emp.id}`)

  /* 13 · desactivar en vez de borrar */
  const { error: f13 } = await c.from("empresa").update({ activo: false }).eq("id", emp.id)
  const { data: activas } = await c.from("empresa").select("id").eq("activo", true).eq("id", emp.id)
  paso("una empresa desactivada deja de ofrecerse", !f13 && (activas?.length ?? 0) === 0,
    f13 ? f13.message : "ya no figura entre las activas, pero sigue existiendo")

  /* 14 · pendientes del día (CP-26) */
  /* la fecha LOCAL, igual que la base: corre en la zona de la clínica.
     Con toISOString() esto fallaba después de las 21:00 (ver 012). */
  const hoy = comoISOLocal(new Date())
  const { data: pend, error: f14 } = await c.from("v_orden_avance").select("*")
    .eq("fecha", hoy).neq("estado", "INFORMADA").order("numero", { ascending: false })
  const nuestra = pend?.find((o) => o.id === ordenId)
  /* No se fija en cuántos van cargados: los pasos de arriba dejan uno
     cargado a propósito. Lo que importa acá es que la orden aparezca con
     su avance y que la cuenta la haga la vista, no la pantalla. */
  paso("pendientes del día trae la orden con su avance",
    !f14 && !!nuestra && nuestra.estudios === 56 && nuestra.cargados < nuestra.estudios,
    f14 ? f14.message : `${pend.length} sin informar · la nuestra ${nuestra?.cargados}/${nuestra?.estudios}`)

  /* 15 · listado por empresa con importes (CP-25) */
  const { data: listado, error: f15 } = await c.from("v_orden_avance").select("*")
    .gte("fecha", hoy).lte("fecha", hoy).eq("empresa", empresas[0].razon_social)
    .order("numero", { ascending: false })
  const total = (listado ?? []).reduce((s2, o) => s2 + Number(o.importe ?? 0), 0)
  paso("el listado filtra por empresa y suma importes",
    !f15 && listado.some((o) => o.id === ordenId) && total >= 160000,
    f15 ? f15.message : `${listado.length} de ${empresas[0].razon_social} · ${total}`)

  /* ---------- RF07 · catálogo desde recepción ---------- */

  /* 17 · crear una categoría */
  const { data: cat, error: g1 } = await c.from("categoria").insert({
    nombre: `${MARCA} CATEGORIA`, orden: 98, rol_carga: "R5", valor_defecto: "NORMAL",
  }).select().single()
  paso("recepción crea una categoría (RF07)", !g1 && !!cat?.id,
    g1 ? g1.message : `id ${cat.id} · la carga R5 · arranca en NORMAL`)

  /* 18 · con un estudio adentro, con referencias por sexo (RF08) */
  const { data: est, error: g2 } = await c.from("estudio").insert({
    codigo: "ZZA", nombre: `${MARCA} ESTUDIO`, categoria_id: cat.id,
    orden: 98, unidad: "mg/dl", ref_h: "70-110", ref_m: "70-110",
  }).select().single()
  paso("y un estudio con referencias por sexo (RF08)", !g2 && est?.ref_h === "70-110",
    g2 ? g2.message : `${est.nombre} · ${est.unidad} · H ${est.ref_h} · M ${est.ref_m}`)

  /* 19 · el estudio nuevo no está en ningún concepto: no se cobra */
  const { data: cubre } = await c.from("concepto_estudio").select("concepto_id").eq("estudio_id", est.id)
  paso("un estudio nuevo no se cobra hasta engancharlo a un concepto",
    (cubre ?? []).length === 0,
    "0 conceptos lo cubren — la pantalla lo marca «no se cobra»")

  /* 20 · pero los precios NO los toca recepción */
  const { error: g4 } = await c.from("concepto").insert({ nombre: `${MARCA} CONCEPTO`, precio: 1 })
  paso("recepción no puede fijar precios", g4?.code === "42501",
    g4 ? `${g4.code} — los conceptos son del Administrador` : "pudo, y no debería")

  /* 21 · el estudio nuevo ya se puede pedir en una orden */
  await c.from("orden_categoria").upsert(
    { orden_id: ordenId, categoria_id: cat.id }, { onConflict: "orden_id,categoria_id", ignoreDuplicates: true })
  const { error: g5 } = await c.from("orden_estudio").insert({ orden_id: ordenId, estudio_id: est.id })
  paso("el estudio recién creado ya se puede pedir, sin desarrollo (RF07)", !g5,
    g5 ? g5.message : "entra en la orden apenas se crea")

  /* limpieza */
  limpiar()
  for (const u of [recep, labo]) await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })

  const mal = pasos.filter((p) => !p.ok)
  console.log("")
  console.log(mal.length ? `FALLAN ${mal.length} de ${pasos.length}` : `Los ${pasos.length} pasos andan.`)
  process.exitCode = mal.length ? 1 : 0
}

main().catch((e) => {
  console.error("\nSe cortó:", e.message)
  try { limpiar() } catch {}
  process.exitCode = 1
})
