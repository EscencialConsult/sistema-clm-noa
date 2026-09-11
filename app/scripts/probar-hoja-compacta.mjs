/* =====================================================================
   Aprovechar la hoja de ruta: varias categorías por página.

   RADIOGRAFIAS con un solo estudio gastaba una carilla entera.

   La clínica pidió una página por categoría porque «la hoja se corta en
   tiras, una por profesional» (CU-06, alt. 5a). El papel se corta igual,
   así que dos categorías en una hoja son un corte más — no un problema
   nuevo. Pero hay UNA cosa que no puede pasar: que una categoría quede
   partida entre dos páginas. Esa tira saldría cortada al medio por el
   borde de la hoja, y el puesto recibiría media planilla.

   Esa es la comprobación que importa. El resto —la línea de corte, el
   modo «una por hoja»— es comodidad.

       node scripts/probar-hoja-compacta.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

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
console.log("Hoja de ruta compacta · varias categorías por página")

const css = leer("index.css")
const hoja = leer("features/ordenes/imprimir/HojaDeRuta.jsx")
const dialogo = leer("features/ordenes/imprimir/ElegirPaginas.jsx")

paso("1 · una categoría no se puede partir entre dos hojas")
{
  /* Es lo único no negociable: el papel se corta en tiras, y una tira
     cortada por el borde de la página no le sirve a nadie. */
  const i = css.indexOf(".hoja-impresion .imp-bloque {")
  ok(i >= 0, "existe la regla del bloque")
  if (i >= 0) {
    const regla = css.slice(i, css.indexOf("}", i))
    /* Con `includes("break-inside: avoid")` esto daba verde aunque la
       propiedad estuviera borrada: `page-break-inside: avoid` la contiene
       como subcadena. Se descubrió rompiéndola a propósito — la rotura no
       se detectó, y era justo la comprobación que importa. Hace falta que
       la propiedad empiece renglón. */
    ok(/^\s*break-inside:\s*avoid/m.test(regla), "no se parte")
    ok(/^\s*page-break-inside:\s*avoid/m.test(regla),
      "y también en la forma vieja de la propiedad",
      "los navegadores no la soportan todos igual")
  }
  ok(hoja.includes('"imp-bloque"'), "y la hoja se la pone a cada categoría")
}

paso("2 · la guía de corte va arriba, no abajo")
{
  /* Puesta al pie del bloque anterior, quedaría colgada en la página de
     arriba cuando el bloque siguiente se pasa a la próxima hoja: una
     línea de «cortar aquí» sin nada debajo. */
  ok(hoja.includes("{!unaPorPagina && i > 0 && ("),
    "aparece entre bloques, nunca antes del primero")
  const i = hoja.indexOf("{!unaPorPagina && i > 0 && (")
  const bloque = hoja.slice(i, i + 260)
  ok(bloque.includes("imp-corte"), "es la línea de corte")
  const jCorte = hoja.indexOf("imp-corte")
  const jCabecera = hoja.indexOf("<CabeceraImpreso")
  ok(jCorte >= 0 && jCorte < jCabecera,
    "y va antes del encabezado del bloque", "así viaja con él si cambia de página")
}

paso("3 · sigue habiendo un encabezado por categoría")
{
  /* Es lo que hace que la tira cortada siga sabiendo de qué es. Si se
     imprimiera un solo encabezado arriba de todo, la tira de abajo
     quedaría sin número de orden ni nombre de paciente. */
  ok(hoja.includes("categoria={cat.nombre}"), "cada bloque dice su categoría")
  ok(hoja.includes("numero={datos.numero}"), "y repite el número de orden")
  ok(hoja.includes("<DatosOrden orden={datos} />"), "y los datos del paciente")
}

paso("4 · se puede volver a una por hoja")
{
  ok(hoja.includes("unaPorPagina = false"), "el modo compacto es el de por defecto")
  ok(hoja.includes('? (i < ultima ? "imp-salto-pagina" : undefined)'),
    "con la opción puesta, vuelve el salto de página")
  ok(hoja.includes("const ultima = datos.categorias.length - 1"),
    "y nunca después de la última", "si no, sale una hoja en blanco al final")
  ok(dialogo.includes("Una categoría por hoja"), "el diálogo lo ofrece")
  ok(dialogo.includes("unaPorPagina={unaPorPagina}"), "y se lo pasa a la hoja")
}

paso("5 · lo que se ahorra, con el catálogo real")
{
  const filas = psql(`
    SELECT p.nombre, c.nombre, count(*)
      FROM plantilla p
      JOIN plantilla_item pi ON pi.plantilla_id = p.id
      JOIN estudio e ON e.id = pi.estudio_id
      JOIN categoria c ON c.id = e.categoria_id
     WHERE p.id = 1
     GROUP BY p.nombre, c.nombre, c.orden ORDER BY c.orden;`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  ok(filas.length > 0, "se leyó BASICO DE LEY", `${filas.length} categorías`)
  const cortas = filas.filter(([, , n]) => Number(n) <= 2)
  for (const [, cat, n] of filas) {
    console.log(`     ${String(n).padStart(2)} estudio(s)   ${cat}${Number(n) <= 2 ? "   ← gastaba una hoja entera" : ""}`)
  }
  ok(cortas.length > 0,
    "hay categorías de uno o dos estudios: son las que gastaban una hoja",
    `${cortas.length} de ${filas.length}`)
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: se aprovecha la hoja y ninguna categoría queda partida."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
