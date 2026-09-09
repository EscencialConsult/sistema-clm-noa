#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Casos de prueba bloqueantes · 04_Casos_de_Prueba

   Los marcados ★ en el documento: si alguno falla, la entrega no se
   acepta. Son siete los que se pueden correr solos. El octavo, CP-24
   —una jornada completa real sin que la administración vuelva a tipear
   nada— se hace con la operadora, no con un script.

   Uso:
     node scripts/probar-casos.js

   CÓMO ESTÁ ESCRITO, Y POR QUÉ IMPORTA
   ------------------------------------
   Todas las comprobaciones van por la API HTTP, con la sesión real del
   rol que corresponde. Ninguna va por psql.

   No es un detalle. Probando por psql, con el usuario dueño de la base,
   los controles de acceso no se aplican: el caso «recepción no puede
   fijar la aptitud» pasa aunque recepción sí pueda. Ya nos pasó — CP-21
   dio verde probando un UPDATE directo, mientras la misma operación por
   RPC estaba abierta hasta para quien no había iniciado sesión.

   El alta y la limpieza de datos sí van por psql, como las haría el
   operador del servidor. Pero eso es preparar la mesa, no la prueba.

   El script se crea sus propios usuarios, con contraseñas al azar que
   viven en memoria, y los borra al terminar. No toca las cuentas reales
   ni deja nada anotado.
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { spawnSync } = require("child_process")

const RAIZ = path.resolve(__dirname, "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)
const API = process.env.CMLNOA_API || "http://localhost:8000"

/* Datos de referencia que ya están en el catálogo cargado */
const EMPRESA = 1                 // ACSO
const PLANTILLA_DROGAS = 3        // BASICO + COLUMNA + DROGAS
const CAT_HEMOGRAMA = 2
const CAT_RADIOGRAFIAS = 7
const MARCA = "ZZPRUEBA"          // por acá se reconoce y se borra lo del script

/* ------------------------------------------------------------------ */
/*  utilidades                                                         */
/* ------------------------------------------------------------------ */
function sql(texto) {
  const r = spawnSync("docker", [
    "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
  ], { cwd: RAIZ, encoding: "utf8", input: texto })
  if (r.status !== 0) throw new Error("psql: " + (r.stderr || "").slice(0, 300))
  return (r.stdout || "").trim()
}

async function pedir(ruta, { token, metodo = "GET", cuerpo, prefer } = {}) {
  const cab = {
    apikey: env.ANON_KEY,
    Authorization: `Bearer ${token || env.ANON_KEY}`,
    "Content-Type": "application/json",
  }
  if (prefer) cab.Prefer = prefer
  const r = await fetch(`${API}${ruta}`, {
    method: metodo, headers: cab,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const txt = await r.text()
  let datos = null
  try { datos = txt ? JSON.parse(txt) : null } catch { datos = txt }
  return { estado: r.status, datos }
}

const rpc = (fn, cuerpo, token) =>
  pedir(`/rest/v1/rpc/${fn}`, { token, metodo: "POST", cuerpo })

async function entrar(email, clave) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: clave }),
  })
  const d = await r.json()
  if (!d.access_token) throw new Error(`no pude entrar como ${email}: ${d.msg || JSON.stringify(d)}`)
  return d.access_token
}

/* mensaje de error de PostgREST, venga como venga */
const porQue = (r) =>
  (r.datos && (r.datos.message || r.datos.msg || r.datos.hint)) || `HTTP ${r.estado}`

/* ------------------------------------------------------------------ */
/*  usuarios de prueba: se crean, se usan y se borran                  */
/* ------------------------------------------------------------------ */
const USUARIOS = [
  { clave: "admin",  usuario: `${MARCA}_admin`,  rol: "R1", profesional: null },
  { clave: "recep",  usuario: `${MARCA}_recep`,  rol: "R2", profesional: null },
  { clave: "medico", usuario: `${MARCA}_medico`, rol: "R3", profesional: 1 },
  { clave: "labo",   usuario: `${MARCA}_labo`,   rol: "R5", profesional: null },
]
const sesion = {}

async function crearUsuarios() {
  for (const u of USUARIOS) {
    u.email = `${u.usuario.toLowerCase()}@cmlnoa.local`
    u.pass = crypto.randomBytes(12).toString("base64url")
    const r = await fetch(`${API}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: env.SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: u.email, password: u.pass, email_confirm: true }),
    })
    const d = await r.json()
    if (!d.id) throw new Error(`no pude crear ${u.email}: ${d.msg || JSON.stringify(d)}`)
    u.authId = d.id
    sql(`
      INSERT INTO usuario (usuario, nombre, auth_id, profesional_id, debe_cambiar)
      VALUES ('${u.usuario}', 'Prueba automática', '${d.id}',
              ${u.profesional === null ? "NULL" : u.profesional}, false);
      INSERT INTO usuario_rol (usuario_id, rol_codigo)
      SELECT id, '${u.rol}' FROM usuario WHERE auth_id = '${d.id}';
    `)
    sesion[u.clave] = await entrar(u.email, u.pass)
  }
}

async function borrarUsuarios() {
  for (const u of USUARIOS) {
    if (!u.authId) continue
    sql(`DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE auth_id='${u.authId}');
         DELETE FROM usuario WHERE auth_id='${u.authId}';`)
    await fetch(`${API}/auth/v1/admin/users/${u.authId}`, {
      method: "DELETE",
      headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` },
    })
  }
}

function limpiarDatos() {
  sql(`
    DELETE FROM orden_estudio  WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden          WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
    DELETE FROM persona        WHERE apellido LIKE '${MARCA}%';
    DELETE FROM estudio        WHERE nombre LIKE '${MARCA}%';
    DELETE FROM categoria      WHERE nombre LIKE '${MARCA}%';
  `)
}

/* ------------------------------------------------------------------ */
/*  los casos                                                          */
/* ------------------------------------------------------------------ */
const casos = []
const caso = (id, titulo, fn) => casos.push({ id, titulo, fn })

/* --- CP-03 ★ · el padrón no duplica --------------------------------- */
caso("CP-03", "Se vuelve a ingresar el mismo documento: no se crea un segundo registro", async (ctx) => {
  const doc = { tipo_doc: "DNI", nro_doc: "90000001", apellido: `${MARCA} DUPLICADO`,
                nombre: "PRIMERO", sexo: "M" }

  const a = await pedir("/rest/v1/persona", { token: sesion.recep, metodo: "POST", cuerpo: doc,
                                              prefer: "return=representation" })
  if (a.estado !== 201) return { ok: false, detalle: `el alta falló: ${porQue(a)}` }

  const b = await pedir("/rest/v1/persona", { token: sesion.recep, metodo: "POST",
    cuerpo: { ...doc, nombre: "SEGUNDO" }, prefer: "return=representation" })
  if (b.estado === 201) return { ok: false, detalle: "dejó cargar la misma persona dos veces" }
  if (b.datos?.code !== "23505")
    return { ok: false, detalle: `rechazó, pero por otro motivo: ${porQue(b)}` }

  const c = await pedir(`/rest/v1/persona?nro_doc=eq.90000001&select=id,nombre`, { token: sesion.recep })
  if (!Array.isArray(c.datos) || c.datos.length !== 1)
    return { ok: false, detalle: `el documento devuelve ${c.datos?.length} filas` }

  ctx.personaRepetida = c.datos[0].id
  return { ok: true, detalle: `rechazado con 23505; el documento sigue trayendo una sola ficha` }
})

/* --- CP-07 ★ · la batería se abre según el sexo --------------------- */
caso("CP-07", "La misma batería abre coca y marihuana al varón, y subunidad beta a la mujer", async (ctx) => {
  for (const [k, sexo, nombre] of [["h", "M", "VARON"], ["m", "F", "MUJER"]]) {
    const p = await pedir("/rest/v1/persona", { token: sesion.recep, metodo: "POST",
      cuerpo: { tipo_doc: "DNI", nro_doc: `9000010${k === "h" ? 0 : 1}`,
                apellido: `${MARCA} BATERIA`, nombre, sexo },
      prefer: "return=representation" })
    if (p.estado !== 201) return { ok: false, detalle: `no pude cargar a ${nombre}: ${porQue(p)}` }
    ctx[`persona_${k}`] = p.datos[0].id

    const o = await rpc("crear_orden", {
      p_persona: ctx[`persona_${k}`], p_empresa: EMPRESA, p_plantilla: PLANTILLA_DROGAS,
    }, sesion.recep)
    if (typeof o.datos !== "number") return { ok: false, detalle: `no se creó la orden de ${nombre}: ${porQue(o)}` }
    ctx[`orden_${k}`] = o.datos
  }

  const nombres = async (orden) => {
    const r = await pedir(
      `/rest/v1/orden_estudio?orden_id=eq.${orden}&select=estudio(nombre)`, { token: sesion.recep })
    return (r.datos || []).map((x) => x.estudio.nombre)
  }
  const h = await nombres(ctx.orden_h)
  const m = await nombres(ctx.orden_m)
  ctx.estudios_h = h.length
  ctx.estudios_m = m.length

  const tiene = (arr, t) => arr.some((n) => n.toUpperCase().includes(t))
  const fallas = []
  if (!tiene(h, "COCAINA"))        fallas.push("al varón no se le abrió COCAINA")
  if (!tiene(h, "MARIHUANA"))      fallas.push("al varón no se le abrió MARIHUANA")
  if (tiene(h, "SUB UNIDAD BETA")) fallas.push("al varón se le abrió SUB UNIDAD BETA")
  if (!tiene(m, "SUB UNIDAD BETA")) fallas.push("a la mujer no se le abrió SUB UNIDAD BETA")

  return fallas.length
    ? { ok: false, detalle: fallas.join("; ") }
    : { ok: true, detalle: `varón ${h.length} estudios · mujer ${m.length}, sin tildar nada a mano` }
})

/* --- CP-08 ★ · el presupuesto de esa misma batería ------------------ */
caso("CP-08", "Presupuesto de esa batería: 140.000 el varón, 160.000 la mujer", async (ctx) => {
  const leer = async (orden) => {
    const r = await pedir(`/rest/v1/orden?id=eq.${orden}&select=importe`, { token: sesion.recep })
    return Number(r.datos?.[0]?.importe)
  }
  const h = await leer(ctx.orden_h)
  const m = await leer(ctx.orden_m)
  const fallas = []
  if (h !== 140000) fallas.push(`el varón dio ${h}, se esperaba 140000`)
  if (m !== 160000) fallas.push(`la mujer dio ${m}, se esperaba 160000`)
  return fallas.length
    ? { ok: false, detalle: fallas.join("; ") }
    : { ok: true, detalle: "140.000 y 160.000, según la cotización vigente" }
})

/* --- CP-05 ★ · el rango depende del sexo ---------------------------- */
caso("CP-05", "Hematocrito 38: normal en la mujer, fuera de rango en el varón", async (ctx) => {
  const cargar = async (orden) => {
    const b = await pedir(
      `/rest/v1/orden_estudio?orden_id=eq.${orden}&estudio_id=eq.21` +
      `&select=id,fuera_de_rango,estudio(nombre)`,
      { token: sesion.labo, metodo: "PATCH",
        cuerpo: { detalle: "38", resultado: "38", estado: "CARGADO" },
        prefer: "return=representation" })
    if (!Array.isArray(b.datos) || b.datos.length !== 1)
      throw new Error(`no pude cargar el hematocrito: ${porQue(b)}`)
    return b.datos[0].fuera_de_rango
  }
  const varon = await cargar(ctx.orden_h)
  const mujer = await cargar(ctx.orden_m)

  const fallas = []
  if (mujer !== false) fallas.push("marcó fuera de rango a la mujer (38 entra en 38-45)")
  if (varon !== true)  fallas.push("no marcó fuera de rango al varón (38 está por debajo de 43-53)")
  return fallas.length
    ? { ok: false, detalle: fallas.join("; ") }
    : { ok: true, detalle: "mismo valor, distinto criterio: el sexo lo decide la base, no quien carga" }
})

/* --- CP-13 ★ · una categoría entera en una sola acción -------------- */
caso("CP-13", "Se marca el hemograma completo como NORMAL en una sola acción", async (ctx) => {
  const antes = await pedir(
    `/rest/v1/orden_estudio?orden_id=eq.${ctx.orden_m}&estado=eq.PENDIENTE` +
    `&select=id,estudio!inner(categoria_id)&estudio.categoria_id=eq.${CAT_HEMOGRAMA}`,
    { token: sesion.labo })
  const pendientes = (antes.datos || []).length
  if (pendientes < 2) return { ok: false, detalle: `esperaba varios pendientes en hemograma, hay ${pendientes}` }

  const r = await rpc("cargar_categoria_normal",
    { p_orden: ctx.orden_m, p_categoria: CAT_HEMOGRAMA }, sesion.labo)
  if (typeof r.datos !== "number")
    return { ok: false, detalle: `la llamada falló: ${porQue(r)}` }
  if (r.datos !== pendientes)
    return { ok: false, detalle: `cargó ${r.datos} de ${pendientes} pendientes` }

  const quedan = await pedir(
    `/rest/v1/orden_estudio?orden_id=eq.${ctx.orden_m}&estado=eq.PENDIENTE` +
    `&select=id,estudio!inner(categoria_id)&estudio.categoria_id=eq.${CAT_HEMOGRAMA}`,
    { token: sesion.labo })
  if ((quedan.datos || []).length !== 0)
    return { ok: false, detalle: `quedaron ${quedan.datos.length} sin cargar` }

  // y la bioquímica no puede hacer lo mismo con las radiografías
  const ajeno = await rpc("cargar_categoria_normal",
    { p_orden: ctx.orden_m, p_categoria: CAT_RADIOGRAFIAS }, sesion.labo)
  if (typeof ajeno.datos === "number")
    return { ok: false, detalle: "laboratorio pudo cargar RADIOGRAFIAS, que no es de su área" }

  return { ok: true, detalle: `${r.datos} estudios en una llamada; y le rechaza una categoría ajena` }
})

/* --- RF07 · quién mantiene el catálogo ------------------------------ */
/* «El Administrador y Recepción crean y mantienen las categorías y los
   estudios.» La política de 005 dejaba sólo al administrador: recepción
   podía armar una batería pero no crear el estudio que iba adentro.
   Corregido en 013. Los precios NO: esos siguen siendo del admin. */
caso("RF07", "Recepción mantiene el catálogo, pero no los precios", async () => {
  const cat = await pedir("/rest/v1/categoria", { token: sesion.recep, metodo: "POST",
    cuerpo: { nombre: `${MARCA} CATEGORIA`, orden: 99, rol_carga: "R5", valor_defecto: "NORMAL" },
    prefer: "return=representation" })
  if (cat.estado !== 201) return { ok: false, detalle: `no pudo crear la categoría: ${porQue(cat)}` }

  const est = await pedir("/rest/v1/estudio", { token: sesion.recep, metodo: "POST",
    cuerpo: { codigo: "ZZ9", nombre: `${MARCA} ESTUDIO`, categoria_id: cat.datos[0].id,
              orden: 99, ref_h: "10-20", ref_m: "8-18" },
    prefer: "return=representation" })
  if (est.estado !== 201) return { ok: false, detalle: `no pudo crear el estudio: ${porQue(est)}` }

  const con = await pedir("/rest/v1/concepto", { token: sesion.recep, metodo: "POST",
    cuerpo: { nombre: `${MARCA} CONCEPTO`, precio: 1 }, prefer: "return=representation" })
  if (con.estado < 400) return { ok: false, detalle: "recepción pudo fijar un precio, y no debería" }

  return { ok: true, detalle: "crea categoría y estudio con sus referencias; el precio lo rechaza" }
})

/* --- CP-19 ★ · no se informa con estudios pendientes ---------------- */
caso("CP-19", "Con un estudio pendiente no deja fijar la aptitud", async (ctx) => {
  const r = await rpc("emitir_protocolo",
    { p_orden: ctx.orden_m, p_aptitud: "APTO" }, sesion.medico)
  if (r.estado < 400)
    return { ok: false, detalle: "informó una orden incompleta" }
  if (!/Quedan \d+ estudios sin cargar/.test(porQue(r)))
    return { ok: false, detalle: `rechazó, pero por otro motivo: ${porQue(r)}` }
  return { ok: true, detalle: porQue(r) }
})

/* --- CP-21 · la aptitud es sólo del médico laboral ------------------ */
/* No está marcado ★, pero se corre igual: es el que dio verde en falso
   la primera vez, porque se había probado el UPDATE directo y no la RPC. */
caso("CP-21", "Ni el Administrador ni Recepción ni anon pueden fijar la aptitud", async (ctx) => {
  const fallas = []

  const adminUpd = await pedir(`/rest/v1/orden?id=eq.${ctx.orden_m}`, {
    token: sesion.admin, metodo: "PATCH", cuerpo: { aptitud: "APTO" },
    prefer: "return=representation" })
  if (adminUpd.estado < 400 && (adminUpd.datos || []).length > 0)
    fallas.push("el Administrador cambió la aptitud con un UPDATE directo")

  for (const [quien, token] of [["el Administrador", sesion.admin],
                                ["Recepción", sesion.recep],
                                ["anon, sin sesión", null]]) {
    const r = await rpc("emitir_protocolo",
      { p_orden: ctx.orden_m, p_aptitud: "APTO" }, token)
    if (r.estado < 400) { fallas.push(`${quien} informó por RPC`); continue }
    const msg = porQue(r)
    const frenoPorRol = /únicamente el Médico laboral/.test(msg) ||
                        /permission denied|no existe la función|does not exist/i.test(msg)
    if (!frenoPorRol) fallas.push(`${quien}: frenó por «${msg}», no por el rol`)
  }

  return fallas.length
    ? { ok: false, detalle: fallas.join("; ") }
    : { ok: true, detalle: "los tres rebotan por rol, antes de mirar la regla de negocio" }
})

/* --- CP-22 ★ · el protocolo, y el cierre ---------------------------- */
caso("CP-22", "Emitido el protocolo, salen las dos matrículas y los resultados no se editan", async (ctx) => {
  // completar lo que falta: el Administrador puede corregir cualquier categoría
  const resto = await pedir(
    `/rest/v1/orden_estudio?orden_id=eq.${ctx.orden_m}&estado=neq.CARGADO`, {
      token: sesion.admin, metodo: "PATCH",
      cuerpo: { estado: "CARGADO", resultado: "NORMAL" }, prefer: "return=representation" })
  if (resto.estado >= 400) return { ok: false, detalle: `no pude completar la orden: ${porQue(resto)}` }

  const emitido = await rpc("emitir_protocolo",
    { p_orden: ctx.orden_m, p_aptitud: "APTO" }, sesion.medico)
  if (emitido.estado >= 400) return { ok: false, detalle: `no se pudo emitir: ${porQue(emitido)}` }

  const o = await pedir(
    `/rest/v1/orden?id=eq.${ctx.orden_m}` +
    `&select=numero,estado,aptitud,informado_at,importe,` +
    `persona(apellido,nombre,nro_doc),empresa(razon_social),` +
    `profesional(apellido_nombre,matricula_prov,matricula_nac)`,
    { token: sesion.medico })
  const d = o.datos?.[0]
  if (!d) return { ok: false, detalle: "no pude leer la orden emitida" }

  const fallas = []
  if (d.estado !== "INFORMADA") fallas.push(`quedó en ${d.estado}`)
  if (d.aptitud !== "APTO")     fallas.push(`la aptitud quedó en ${d.aptitud}`)
  if (!d.informado_at)          fallas.push("sin fecha de informe")
  if (!d.persona?.apellido || !d.empresa?.razon_social) fallas.push("faltan paciente o empresa")
  if (!d.profesional?.matricula_prov) fallas.push("falta la matrícula provincial")
  if (!d.profesional?.matricula_nac)  fallas.push("falta la matrícula nacional")

  // y ahora ya no se toca
  const retoque = await pedir(`/rest/v1/orden_estudio?orden_id=eq.${ctx.orden_m}&estudio_id=eq.21`, {
    token: sesion.admin, metodo: "PATCH", cuerpo: { resultado: "RETOCADO" },
    prefer: "return=representation" })
  if (retoque.estado < 400 && (retoque.datos || []).length > 0)
    fallas.push("se pudo editar un resultado después de emitido")

  return fallas.length
    ? { ok: false, detalle: fallas.join("; ") }
    : { ok: true, detalle: `orden ${d.numero} · ${d.profesional.apellido_nombre} · MP ${d.profesional.matricula_prov} / MN ${d.profesional.matricula_nac}; los resultados quedaron bloqueados` }
})

/* ------------------------------------------------------------------ */
/*  correr                                                             */
/* ------------------------------------------------------------------ */
async function main() {
  console.log("Casos bloqueantes · contra el sistema andando, por la API")
  console.log(`  ${API}`)
  console.log("")

  limpiarDatos()
  await crearUsuarios()

  const ctx = {}
  const resultados = []
  for (const c of casos) {
    let r
    try { r = await c.fn(ctx) }
    catch (e) { r = { ok: false, detalle: e.message } }
    resultados.push({ ...c, ...r })
    console.log(`  ${r.ok ? "✔" : "✘"}  ${c.id}  ${c.titulo}`)
    console.log(`        ${r.detalle}`)
  }

  /* primero los datos, después los usuarios: la orden guarda quién la
     abrió, así que borrar al usuario antes choca con esa referencia */
  limpiarDatos()
  await borrarUsuarios()

  const mal = resultados.filter((r) => !r.ok)
  console.log("")
  if (mal.length === 0) {
    console.log(`Los ${resultados.length} pasan.`)
    console.log("")
    console.log("Falta CP-24, que no se automatiza: una jornada completa real,")
    console.log("con la operadora, comprobando que no vuelva a tipear ningún")
    console.log("resultado ya cargado. Se hace en la clínica.")
  } else {
    console.log(`FALLAN ${mal.length} de ${resultados.length}:`)
    mal.forEach((r) => console.log(`  ${r.id} · ${r.detalle}`))
    console.log("")
    console.log("Un caso bloqueante en rojo frena la entrega. No se negocia.")
    process.exitCode = 1
  }
}

main().catch(async (e) => {
  console.error("")
  console.error("Se cortó:", e.message)
  try { limpiarDatos(); await borrarUsuarios() } catch {}
  process.exitCode = 1
})
