/* =====================================================================
   Buscar por DNI en Listado de Órdenes y en Pendientes del Día.

   En el mostrador se busca por el documento que trae el paciente. En el
   Listado había que acordarse del rango de fechas y la empresa; en
   Pendientes no había forma de buscar y se leía la lista entera.

   Dos cosas importan más que el resto:

     · Que el DNI se encuentre escrito como se escribe. Se dicta y se
       tipea de las dos formas —28456712 y 28.456.712— y en la base está
       guardado de una sola. Si hay que escribirlo igual que adentro, la
       mitad de las búsquedas no encuentra nada y quien busca concluye
       que la persona no está.

     · Que las dos pantallas usen el MISMO matcher. Dos copias derivan:
       una aprende a ignorar los puntos y la otra no, y entonces la misma
       búsqueda encuentra en una pantalla y no en la otra.

       node scripts/probar-buscar-dni.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { coincide } from "../src/lib/buscarOrden.js"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")
const RAIZ = path.resolve(APP, "..")

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

const psql = (sql) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: sql }
).trim()

console.log("")
console.log("Buscar por DNI · Listado de Órdenes y Pendientes del Día")

paso("1 · el DNI se encuentra escrito de cualquier forma")
{
  const o = { documento: "DNI 38774102", paciente: "MAMANÍ, Rocío Belén", numero: 38035 }
  const casos = [
    ["38774102", true, "como está guardado"],
    ["38.774.102", true, "con puntos, como se dicta"],
    ["38 774 102", true, "con espacios"],
    ["387", true, "a medias: se va achicando mientras se tipea"],
    ["DNI 38774102", true, "pegando el campo entero"],
    ["99999999", false, "otro documento"],
  ]
  for (const [t, esperado, desc] of casos) {
    ok(coincide(o, t) === esperado, desc, `«${t}»`)
  }
}

paso("2 · también por apellido y por número de orden")
{
  const o = { documento: "DNI 38774102", paciente: "MAMANÍ, Rocío Belén", numero: 38035 }
  /* Sin acento: nadie lo pone al buscar, y MAMANÍ lo lleva. */
  ok(coincide(o, "mamani"), "por apellido sin acento", "«mamani» → MAMANÍ")
  ok(coincide(o, "MAMANÍ"), "y con acento")
  ok(coincide(o, "rocio"), "por nombre")
  ok(coincide(o, "38035"), "por número de orden", "es lo que dice el papel que trae en la mano")
  ok(!coincide(o, "perez"), "y no encuentra a cualquiera")
  ok(coincide(o, ""), "sin texto, coinciden todas", "no esconde nada por accidente")
  ok(coincide(o, "   "), "ni con espacios sueltos")
}

paso("3 · las dos pantallas usan el mismo matcher")
{
  const listado = leer("features/recepcion/ListadoOrdenesPage.jsx")
  const pendientes = leer("features/recepcion/PendientesDelDiaPage.jsx")

  for (const [t, nombre] of [[listado, "Listado"], [pendientes, "Pendientes"]]) {
    ok(t.includes('from "../../lib/buscarOrden"'), `${nombre} lo importa`)
    ok(t.includes("coincide(o, texto)"), `${nombre} lo usa para filtrar`)
    ok(t.includes('placeholder="DNI, apellido o N° de orden"'),
      `${nombre} dice qué se puede buscar`)
  }

  /* Copiado en cada pantalla, uno aprende a ignorar los puntos y el otro
     no: la misma búsqueda encuentra en una y no en la otra. */
  for (const [t, nombre] of [[listado, "Listado"], [pendientes, "Pendientes"]]) {
    ok(!/replace\(\/\\D\/g/.test(t), `${nombre} no tiene su propia copia del matcher`)
  }
}

paso("4 · en Pendientes filtra los tres bloques a la vez")
{
  const t = leer("features/recepcion/PendientesDelDiaPage.jsx")
  /* Se escribe el DNI para ver DÓNDE está esa persona, sin saber de
     antemano si está dando vueltas, completa o arrastrada de ayer. */
  ok(t.includes("const visibles = ordenes.filter((o) => coincide(o, texto))"),
    "las de hoy")
  ok(t.includes("const arrastreVisible = arrastre.filter((o) => coincide(o, texto))"),
    "y las de días anteriores")
  ok(t.includes("ordenes={arrastreVisible}"),
    "el bloque de arrastre muestra lo filtrado")
  ok(t.includes("{arrastreVisible.length} de días anteriores"),
    "y el contador de arriba también",
    "si dijera 12 y abajo se viera una, no se entiende")
}

paso("5 · el Listado vuelve a la primera página al buscar")
{
  const t = leer("features/recepcion/ListadoOrdenesPage.jsx")
  /* Buscando desde la página 3 quedaría la tabla vacía: hay menos
     páginas que antes y nadie entiende por qué no aparece nada. */
  ok(t.includes("useEffect(() => { setPagina(1) }, [estado, aptitud, texto])"),
    "el texto también resetea la paginación")
}

paso("6 · contra los documentos que hay en la base")
{
  const filas = psql(`SELECT documento, paciente, numero FROM v_orden_avance ORDER BY numero;`)
    .split(/\r?\n/).filter(Boolean)
    .map((l) => { const [documento, paciente, numero] = l.split("|"); return { documento, paciente, numero } })

  ok(filas.length > 0, "se leyeron las órdenes", `${filas.length}`)

  /* Cada documento real tiene que encontrarse escribiéndolo sin el
     prefijo «DNI» y con puntos de miles. Es como lo va a escribir quien
     lo tiene delante en el papel. */
  let mal = 0
  for (const f of filas) {
    const nro = f.documento.replace(/\D/g, "")
    const conPuntos = nro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    if (!coincide(f, nro) || !coincide(f, conPuntos)) {
      mal++
      console.log(`     ✘ ${f.documento}  (probado: ${nro} y ${conPuntos})`)
    }
  }
  ok(mal === 0, "los encuentra a todos, con y sin puntos",
    `${filas.length} documentos`)

  /* Y que no sea que encuentra todo siempre: un documento inventado no
     tiene que traer nada. */
  const fantasma = filas.filter((f) => coincide(f, "00000000"))
  ok(fantasma.length === 0, "y un documento que no existe no trae nada")
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: el DNI se encuentra como se escriba, en las dos pantallas."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
