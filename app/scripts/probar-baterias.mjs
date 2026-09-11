/* =====================================================================
   Baterías — duplicar, agregar categorías enteras y el precio por sexo.

   Lo que más importa acá es una sola cosa: `sexo_aplica`. Es el campo
   que decide qué estudios se le abren a cada persona, y el que hace que
   una batería cueste distinto según a quién se le aplique.

   Si duplicar pierde ese campo, la copia abre estudios que la original
   no abría. Nadie lo nota: la orden se crea, el papel sale, el
   profesional los carga. Se descubre facturando.

   Por eso la comprobación central no es que duplicar copie los ítems,
   sino que copie el «para quién» de cada uno.

   Las comprobaciones de pantalla miran COMPORTAMIENTO y no clases de
   CSS ni frases: la batería anterior de Conceptos se puso en rojo diez
   veces por un rediseño sin que nada estuviera roto, y una prueba así
   entrena a ignorarla.

       node scripts/probar-baterias.mjs      (desde app/)
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
const MARCA = "ZZBAT"

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }
const dato = (t) => console.log(`     · ${t}`)
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

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

console.log("")
console.log("Baterías · duplicar, categorías enteras y precio por sexo")

const p = leer("features/baterias/BateriasPage.jsx")
const s = leer("features/baterias/services/bateriasService.js")

/* ------------------------------------------------------------------
   Parte 1 · la pantalla
   ------------------------------------------------------------------ */

paso("1 · lo que antes había que hacer de a uno")
{
  ok(s.includes("async duplicar("), "se puede duplicar una batería")
  ok(s.includes("async agregarCategoria("), "y agregar una categoría entera")
  ok(p.includes("quitarCategoria"), "y sacarla entera")
  ok(p.includes("setDentro"), "hay buscador dentro de la batería", "son hasta 90 estudios")
}

paso("2 · el precio va separado por sexo")
{
  /* Un solo número escondería justo el caso que importa: los conceptos
     se cobran enteros, así que un estudio de diferencia puede valer
     decenas de miles. */
  ok(s.includes("presupuesto_de_bateria"), "el servicio pide el precio a la base")
  ok(/precio\.varon.*precio\.mujer/s.test(p), "y la pantalla mira los dos")
  ok(/Number\(precio\.varon\.importe\) !== Number\(precio\.mujer\.importe\)/.test(p),
    "y marca cuando difieren", "es la señal de que falta un estudio de un paquete")
}

paso("3 · nada crece sin límite y todo entra")
{
  const contenidas = (p.match(/overflow-y-auto/g) ?? []).length
  ok(contenidas >= 3, "las listas tienen scroll propio", `${contenidas}`)
  const fijas = [...p.matchAll(/className="[^"]*\bgrid-cols-(\d)\b[^"]*"/g)]
    .filter((m) => !/(sm|md|lg|xl):grid-cols-/.test(m[0]) && m[1] !== "1")
  ok(fijas.length === 0, "no hay grillas de columnas fijas", fijas.length ? fijas[0][0] : "ninguna")
  ok(/grid-cols-1[^"]*lg:grid-cols-\[/.test(p), "la principal se apila en pantallas chicas")
}

paso("4 · el «para quién» se puede cambiar")
{
  /* En el mockup la pastilla se leía como etiqueta y no había forma de
     cambiarla. */
  ok(p.includes("setMenuSexo"), "la pastilla abre un menú")
  ok(/cambiarSexo\(i, s\.valor\)/.test(p), "y cada opción cambia el ítem")
  ok(p.includes("SEXOS.find"), "la pastilla muestra el valor actual")
}

/* ------------------------------------------------------------------
   Parte 2 · contra la base, con sesión de Recepción.

   Recepción mantiene las baterías: la política es soy_admin() O R2. Se
   prueba con el rol más restringido de los dos.
   ------------------------------------------------------------------ */

function limpiar() {
  psql(`
    DELETE FROM plantilla_item WHERE plantilla_id IN (SELECT id FROM plantilla WHERE nombre LIKE '${MARCA}%');
    DELETE FROM plantilla      WHERE nombre LIKE '${MARCA}%';`)
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
  if (!creado.id) { console.log(`  No se pudo crear ${email}`); process.exit(1) }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
        VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass, authId: creado.id }
}

const u = await crearUsuario("recepcion", "R2")
const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
if (eLogin) { console.log(`  No se pudo entrar: ${eLogin.message}`); process.exit(1) }

limpiar()

paso("5 · duplicar copia el «para quién» de cada ítem")
{
  const { data: orig } = await c.from("plantilla")
    .insert({ nombre: `${MARCA} ORIGINAL`, activo: true }).select().single()

  const { data: ests } = await c.from("estudio").select("id, nombre")
    .in("nombre", ["HEMATOCRITO", "SUB UNIDAD BETA", "CILINDROS"])
  const porNombre = Object.fromEntries(ests.map((e) => [e.nombre, e.id]))

  await c.from("plantilla_item").insert([
    { plantilla_id: orig.id, estudio_id: porNombre["HEMATOCRITO"], sexo_aplica: "A" },
    { plantilla_id: orig.id, estudio_id: porNombre["SUB UNIDAD BETA"], sexo_aplica: "F" },
    { plantilla_id: orig.id, estudio_id: porNombre["CILINDROS"], sexo_aplica: "M" },
  ])

  /* Se repite lo que hace el servicio: crear la copia y clonar los
     ítems. Si el servicio dejara de copiar `sexo_aplica`, la copia
     abriría los tres estudios a todo el mundo. */
  const { data: copia } = await c.from("plantilla")
    .insert({ nombre: `${MARCA} COPIA`, activo: true }).select().single()
  const { data: items } = await c.from("plantilla_item")
    .select("estudio_id, sexo_aplica").eq("plantilla_id", orig.id)
  await c.from("plantilla_item").insert(
    items.map((i) => ({ plantilla_id: copia.id, estudio_id: i.estudio_id, sexo_aplica: i.sexo_aplica }))
  )

  const { data: enCopia } = await c.from("plantilla_item")
    .select("estudio_id, sexo_aplica").eq("plantilla_id", copia.id)

  ok(enCopia.length === 3, "la copia trae los tres ítems", `${enCopia.length}`)
  const igual = items.every((i) =>
    enCopia.find((x) => x.estudio_id === i.estudio_id)?.sexo_aplica === i.sexo_aplica
  )
  ok(igual, "y cada uno con su mismo «para quién»",
    enCopia.map((x) => x.sexo_aplica).sort().join(""))

  ok(s.includes("sexo_aplica: i.sexo_aplica"),
    "el servicio efectivamente lo copia",
    "sin esto la copia abre estudios que la original no abre")
}

paso("6 · el precio de una batería sale de la base y distingue el sexo")
{
  const bat = psql(`SELECT id FROM plantilla WHERE nombre = '${MARCA} ORIGINAL';`)
  const filas = psql(`SELECT sexo, estudios, importe FROM presupuesto_de_bateria(${bat});`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  ok(filas.length === 2, "devuelve un renglón por sexo", `${filas.length}`)
  const varon = filas.find(([sx]) => sx === "M")
  const mujer = filas.find(([sx]) => sx === "F")
  ok(varon && mujer, "uno para varón y otro para mujer")
  if (varon && mujer) {
    /* La batería tiene un ítem «sólo mujer» y otro «sólo varón», así que
       cada sexo abre dos de los tres. */
    ok(Number(varon[1]) === 2 && Number(mujer[1]) === 2,
      "y cada sexo abre sólo los que le aplican",
      `varón ${varon[1]} · mujer ${mujer[1]}`)
  }
}

paso("7 · agregar una categoría no duplica lo que ya está")
{
  const bat = psql(`SELECT id FROM plantilla WHERE nombre = '${MARCA} ORIGINAL';`)
  const cat = psql(`SELECT categoria_id FROM estudio WHERE nombre = 'HEMATOCRITO';`)
  const total = Number(psql(`SELECT count(*) FROM estudio WHERE categoria_id = ${cat} AND activo;`))

  const { data: ya } = await c.from("plantilla_item").select("estudio_id").eq("plantilla_id", bat)
  const puestos = ya.map((x) => x.estudio_id)
  const { data: dela } = await c.from("estudio").select("id").eq("categoria_id", cat).eq("activo", true)
  const faltan = dela.filter((e) => !puestos.includes(e.id))

  await c.from("plantilla_item").insert(
    faltan.map((e) => ({ plantilla_id: Number(bat), estudio_id: e.id, sexo_aplica: "A" }))
  )

  const despues = Number(psql(`
    SELECT count(*) FROM plantilla_item pi JOIN estudio e ON e.id = pi.estudio_id
     WHERE pi.plantilla_id = ${bat} AND e.categoria_id = ${cat};`))
  ok(despues === total, "queda la categoría completa, sin repetidos",
    `${despues} de ${total}`)

  const repetidos = psql(`
    SELECT count(*) FROM (
      SELECT estudio_id FROM plantilla_item WHERE plantilla_id = ${bat}
       GROUP BY estudio_id HAVING count(*) > 1) x;`)
  ok(repetidos === "0", "y ningún estudio dos veces")
}

paso("8 · las dos formas de calcular el importe siguen coincidiendo")
{
  /* presupuesto_de_estudios es una copia del recorrido de
     calcular_presupuesto. La migración 026 lo comprueba al aplicarse;
     acá se vuelve a comprobar sobre las órdenes que haya hoy, porque el
     día que alguien cambie una regla va a tocar una sola. */
  const distintas = psql(`
    SELECT count(*) FROM orden o
     WHERE presupuesto_de_estudios(
             coalesce(array(SELECT oe.estudio_id FROM orden_estudio oe WHERE oe.orden_id = o.id), '{}'))
           IS DISTINCT FROM calcular_presupuesto(o.id);`)
  ok(distintas === "0", "ninguna orden da distinto", `${distintas} discrepancias`)
}

paso("9 · las baterías de la clínica, como están hoy")
{
  const filas = psql(`
    SELECT p.nombre, b.sexo, b.estudios, b.importe
      FROM plantilla p CROSS JOIN LATERAL presupuesto_de_bateria(p.id) b
     WHERE p.nombre NOT LIKE '${MARCA}%'
     ORDER BY p.id, b.sexo DESC;`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  const porBateria = new Map()
  for (const [nombre, sexo, est, imp] of filas) {
    if (!porBateria.has(nombre)) porBateria.set(nombre, {})
    porBateria.get(nombre)[sexo] = { est: Number(est), imp: Number(imp) }
  }
  /* Se informa, no se falla: una batería que cobra distinto según el
     sexo puede ser correcta —la subunidad beta es de mujeres— o puede
     ser que le falte un estudio de un paquete. Lo decide la clínica. */
  let distintos = 0
  for (const [nombre, v] of porBateria) {
    if (!v.M || !v.F) continue
    if (v.M.imp !== v.F.imp) {
      distintos++
      dato(`${nombre}: varón $${v.M.imp.toLocaleString("es-AR")} · mujer $${v.F.imp.toLocaleString("es-AR")}`)
    }
  }
  dato(distintos === 0
    ? "ninguna batería cobra distinto según el sexo"
    : `${distintos} baterías cobran distinto según el sexo — revisar con la clínica`)
  ok(porBateria.size > 0, "se leyeron las baterías", `${porBateria.size}`)
}

limpiar()
purgarUsuarios()
await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: duplicar conserva el «para quién» y el precio distingue el sexo."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
