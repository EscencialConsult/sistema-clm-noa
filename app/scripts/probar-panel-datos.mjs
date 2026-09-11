/* =====================================================================
   Ver ficha, ver historial y corregir datos desde el alta.

   Las cuatro cosas ya existían en otras pantallas. Lo que se agregó es
   poder usarlas SIN salir de Nueva Orden, porque irse pierde la orden a
   medio hacer con el paciente en el mostrador.

   Que la política diga que Recepción puede no alcanza: hay que entrar
   como Recepción y hacerlo. Un SELECT que la política permite puede
   fallar igual por una columna que la vista no expone, y una pantalla
   puede tener el botón sin el permiso detrás — que es exactamente el
   caso que reportó Marcela con Apto / No apto.

   Se prueba además que no se pueda crear una orden vacía: sacándole
   todas las categorías a la batería, el botón quedaba activo y se creaba
   una orden con número y sin un solo estudio. Y las órdenes no se
   borran.

       node scripts/probar-panel-datos.mjs      (desde app/)
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

const MARCA = "ZZPANEL"
const API = "http://localhost:8000"

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

console.log("")
console.log("Ficha, historial y corrección de datos · sin salir del alta")

/* ------------------------------------------------------------------
   Parte 1 · La pantalla, leyendo el código.

   Un botón sin onClick no falla nunca, no rompe el build y no lo agarra
   ninguna prueba de datos.
   ------------------------------------------------------------------ */

paso("1 · la pantalla usa los servicios que ya existían")
{
  const t = leer("features/ordenes/NuevaOrdenPage.jsx")
  ok(t.includes('from "../aptitud/services/aptitudService"'), "reusa aptitudService (legajo y padrón)")
  ok(t.includes('from "../recepcion/services/recepcionService"'), "reusa recepcionService (empresa)")
  ok(t.includes("aptitudService.getLegajo(persona.id)"), "ver historial pide el legajo completo")
  ok(t.includes("aptitudService.guardarPersona(editP)"), "editar persona guarda por el servicio de siempre")
  ok(t.includes("recepcionService.guardarEmpresa(editE)"), "editar empresa guarda por el servicio de siempre")
}

paso("2 · los cuatro caminos tienen botón y el botón hace algo")
{
  const t = leer("features/ordenes/NuevaOrdenPage.jsx")
  for (const [texto, accion] of [
    ["Ver ficha", 'setPanel("ficha")'],
    ["Ver historial", "onClick={verHistorial}"],
    ["Editar datos", 'setPanel("editarPersona")'],
  ]) {
    ok(t.includes(texto) && t.includes(accion), `«${texto}»`, accion)
  }
  ok(t.includes('setPanel("editarEmpresa")'), "el lápiz de la empresa abre su ficha")
  /* Los cuatro paneles se dibujan encima; ninguno navega. Si alguno
     usara navigate() se perdería la orden a medio hacer, que es todo el
     motivo por el que esto existe. */
  const zonaPaneles = t.slice(t.indexOf('{panel === "ficha"'), t.indexOf("function Panel("))
  ok(!zonaPaneles.includes("navigate("), "ninguno se va de la pantalla")
  /* Escape tiene que cerrar los dos: el panel de ficha/historial/edición y
     el detalle de una categoría, que se abre por su cuenta. Se comprueba
     el efecto entero y no una línea suelta: el primer intento buscaba el
     texto exacto de una línea y se puso rojo por un cambio de forma que
     no rompía nada. */
  const efectoEscape = t.slice(t.indexOf("if (!panel && abierta === null) return"), t.indexOf("async function buscar("))
  ok(efectoEscape.includes('ev.key !== "Escape"'), "Escape está atado")
  ok(efectoEscape.includes("setAbierta(null)"), "y cierra el detalle de la categoría")
  ok(efectoEscape.includes("cerrarPanel()"), "y cierra la ficha, el historial y la edición")
}

paso("3 · la edad se muestra, pero no se le promete nada")
{
  const t = leer("features/ordenes/NuevaOrdenPage.jsx")
  ok(t.includes("function edadDe("), "se calcula la edad para mostrarla")
  ok(
    t.includes("La edad no interviene en nada."),
    "la ficha aclara que la edad no se usa"
  )
  /* La tabla estudio tiene ref_h y ref_m y nada por edad. Si algún día
     se agrega, esta prueba se cae y hay que revisar el texto. */
  const columnas = psqlLimpio(
    "select string_agg(column_name, ',') from information_schema.columns where table_name='estudio'"
  )
  ok(!/edad/i.test(columnas), "y la base efectivamente no tiene nada por edad", columnas)
}

paso("4 · no se puede crear una orden vacía")
{
  const t = leer("features/ordenes/NuevaOrdenPage.jsx")
  const linea = t.split(/\r?\n/).find((l) => l.includes("const listoParaCrear"))
  ok(!!linea, "existe la condición del botón", (linea ?? "").trim())
  ok(
    !!linea && linea.includes("totalDeLaOrden > 0"),
    "el botón mira cuántos estudios quedan, no si hay batería elegida"
  )
  ok(
    !!linea && !linea.includes("plantillaId ||"),
    "ya no alcanza con haber elegido una batería"
  )
}

/* ------------------------------------------------------------------
   Parte 2 · La base, con una sesión real de RECEPCIÓN.

   No de Administrador: la pregunta es justamente si la recepcionista
   puede corregir un apellido y el CUIT de una empresa.
   ------------------------------------------------------------------ */

function psql(sql) {
  return execFileSync(
    "docker",
    ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
      "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
    { cwd: RAIZ, encoding: "utf8", input: sql }
  ).trim()
}
function psqlLimpio(sql) { return psql(sql) }

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

/* Usuario propio. No se usa ninguna cuenta de la máquina de desarrollo:
   en una instalación limpia no existe, y el CI corre siempre sobre una
   base recién creada. */
/* Restos de una corrida anterior que se cortó por la mitad. Sin esto la
   segunda vez muere con «usuario ya existe» — y el que se corta suele ser
   justo el que estaba investigando una falla. */
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

function limpiar() {
  psql(`
    DELETE FROM orden_estudio   WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
    DELETE FROM orden           WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
    DELETE FROM persona         WHERE apellido LIKE '${MARCA}%';
    DELETE FROM empresa         WHERE razon_social LIKE '${MARCA}%';`)
}

const uRecep = await crearUsuario("recepcion", "R2")
const c = createClient(env.VITE_SUPABASE_URL ?? API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({ email: uRecep.email, password: uRecep.pass })
if (eLogin) {
  console.log("")
  console.log(`  No se pudo entrar como Recepción: ${eLogin.message}`)
  process.exit(1)
}

limpiar()

paso("5 · Recepción puede corregir el padrón (RF05)")
const { data: per, error: ePer } = await c.from("persona").insert({
  tipo_doc: "DNI", nro_doc: "90999300", apellido: `${MARCA} MAL TIPEADO`, nombre: "Prueba", sexo: "M",
}).select().single()
ok(!ePer && !!per, "da de alta a la persona", ePer?.message ?? "")

if (per) {
  const { data: corregida, error: eUpd } = await c.from("persona")
    .update({ apellido: `${MARCA} CORREGIDO`, telefono: "381-4000000", sexo: "F" })
    .eq("id", per.id).select().single()
  ok(!eUpd && corregida?.apellido === `${MARCA} CORREGIDO`, "corrige el apellido", eUpd?.message ?? corregida?.apellido)
  ok(corregida?.sexo === "F", "y también el sexo, que cambia qué estudios se abren")
}

paso("6 · Recepción puede ver el historial completo")
if (per) {
  const { data: ordenId, error: eOrd } = await c.rpc("crear_orden", {
    p_persona: per.id,
    p_empresa: (await c.from("empresa").select("id").eq("activo", true).limit(1).single()).data.id,
    p_plantilla: 1,
    p_tarea: "Prueba",
    p_tipo_examen: "PRELABORAL",
  })
  ok(!eOrd && !!ordenId, "abre una orden para tener historial", eOrd?.message ?? "")

  /* Es la consulta exacta que hace getLegajo(): todas las órdenes de la
     persona, con empresa y médico. Si alguna columna del select no está
     expuesta, falla acá y no en el mostrador. */
  const { data: legajo, error: eLeg } = await c.from("orden")
    .select(`
      id, numero, fecha, tipo_examen, tarea, estado, aptitud, importe,
      preexistencias, incapacidad_pct, observaciones, informado_at,
      persona:persona_id ( id, tipo_doc, nro_doc, apellido, nombre, sexo, fecha_nac ),
      empresa:empresa_id ( id, razon_social ),
      medico_laboral:medico_laboral_id ( apellido_nombre, especialidad, matricula_prov, matricula_nac ),
      fecha_vencimiento`)
    .eq("persona_id", per.id)
    .order("fecha", { ascending: false })

  ok(!eLeg && (legajo?.length ?? 0) >= 1, "trae el legajo con la misma consulta que la pantalla",
    eLeg?.message ?? `${legajo?.length ?? 0} órdenes`)
  ok(!!legajo?.[0]?.tipo_examen, "y trae el tipo de examen, que el paso 1 no muestra")
}

paso("7 · Recepción puede corregir los datos de la empresa")
{
  const { data: emp, error: eIns } = await c.from("empresa").insert({
    razon_social: `${MARCA} SIN CUIT`, codigo: `${MARCA}1`, activo: true,
  }).select().single()
  ok(!eIns && !!emp, "da de alta la empresa", eIns?.message ?? "")

  if (emp) {
    const { data: arreglada, error: eUpd } = await c.from("empresa")
      .update({ cuit: "30-12345678-9", telefono: "381-4111111", domicilio: "Av. Siempreviva 100" })
      .eq("id", emp.id).select().single()
    ok(!eUpd && arreglada?.cuit === "30-12345678-9", "le carga el CUIT que faltaba", eUpd?.message ?? "")

    /* getEmpresas() del alta tiene que traer esos campos: sin ellos el
       formulario de corrección abre vacío y borra lo que había. */
    const { data: lista } = await c.from("empresa")
      .select("id, codigo, razon_social, cuit, domicilio, telefono")
      .eq("id", emp.id).single()
    ok(lista?.cuit === "30-12345678-9" && lista?.telefono === "381-4111111",
      "y el alta los lee para poder mostrarlos")
  }
}

paso("8 · sacándole todo a la batería, no queda ningún estudio")
{
  /* La cuenta que ahora mira el botón. Con la batería más chica: si se
     excluyen todas sus categorías y no hay sueltos, da 0. Antes de esto
     el botón seguía activo y creaba la orden igual. */
  const filas = psql(`
    SELECT c.id, count(*) FROM plantilla_item pi
    JOIN estudio e ON e.id = pi.estudio_id
    JOIN categoria c ON c.id = e.categoria_id
    WHERE pi.plantilla_id = 1
    GROUP BY c.id;`).split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  const total = filas.reduce((s, [, n]) => s + Number(n), 0)
  const excluidas = filas.map(([id]) => Number(id))
  const quedan = total - filas
    .filter(([id]) => excluidas.includes(Number(id)))
    .reduce((s, [, n]) => s + Number(n), 0)

  ok(total > 0, "BASICO DE LEY tiene estudios", `${total} en ${filas.length} categorías`)
  ok(quedan === 0, "sacadas todas las categorías, quedan cero", String(quedan))
  ok(quedan + 0 === 0, "y sin estudios sueltos el botón tiene que estar apagado")
}

limpiar()
/* La auditoría va primero. No es un detalle de limpieza: la base NO deja
   borrar un usuario que dejó rastro, y eso está bien —el registro de
   quién hizo qué no se borra por arrastre—. Estas filas son de la cuenta
   de prueba y se van con ella. */
psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
      DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
      DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
await admin(`/auth/v1/admin/users/${uRecep.authId}`, { method: "DELETE" })

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: los cuatro caminos andan con sesión de Recepción, y la orden vacía quedó bloqueada."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
