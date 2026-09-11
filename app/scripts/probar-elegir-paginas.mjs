/* =====================================================================
   Elegir qué páginas de la hoja de ruta se imprimen.

   La hoja sale con UNA PÁGINA POR CATEGORÍA, para que cada puesto se
   quede con la suya: seis en el básico de ley, nueve en el de conductor.
   Cuando el paciente ya trae hechas las radiografías, esas hojas se
   imprimen para tirarlas.

   Lo que más importa comprobar es que se imprima EL MISMO documento con
   menos categorías adentro, y no una segunda versión de la hoja de ruta.
   Dos plantillas del mismo papel terminan siempre igual: una se corrige
   y la otra no, y nadie se entera hasta que la ART rechaza el legajo.

       node scripts/probar-elegir-paginas.mjs      (desde app/)
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
console.log("Elegir qué páginas de la hoja de ruta imprimir")

const elegir = leer("features/ordenes/imprimir/ElegirPaginas.jsx")
const hoja = leer("features/ordenes/imprimir/HojaDeRuta.jsx")
const menu = leer("shared/impresos/MenuImpreso.jsx")

paso("1 · se imprime la hoja de siempre, no una copia")
{
  ok(elegir.includes('import { HojaDeRuta } from "./HojaDeRuta"'),
    "usa el mismo componente de la hoja de ruta")
  /* Se comprueba QUÉ le pasa, no la línea entera: el día que la hoja
     reciba una opción más, esto no tiene por qué ponerse en rojo. */
  ok(/<HojaDeRuta[^>]*categorias: elegidas/.test(elegir),
    "y sólo le pasa menos categorías")
  /* Si esto tuviera su propio JSX de cabecera o de tabla, sería una
     segunda versión del papel que se corrige por separado. */
  ok(!elegir.includes("CabeceraImpreso") && !elegir.includes("TablaEstudios"),
    "no arma su propio papel")
  ok(elegir.includes("getDatosParaImprimir"),
    "y los datos salen de la misma fuente que el papel entero")
}

paso("2 · no se puede mandar a imprimir la nada")
{
  ok(elegir.includes("disabled={elegidas.length === 0}"), "el botón se apaga sin ninguna marcada")
  ok(elegir.includes("if (elegidas.length === 0) return"),
    "y la función también corta", "por si el botón se habilita por otra vía")
  ok(elegir.includes("Marcá al menos una"), "y dice por qué no se puede")
}

paso("3 · el número que se ve es el que va a salir en el papel")
{
  /* Mostrar la posición en la lista sería mentir apenas se saca una del
     medio: quedaría 1, 3, 4 en pantalla y 1, 2, 3 en el papel. */
  ok(elegir.includes("const pagina = elegidas.findIndex((x) => x.id === c.id) + 1"),
    "se numera sobre lo elegido, no sobre la lista entera")
  ok(!/\{va \? i \+ 1 :/.test(elegir), "y no sobre el índice del listado")
}

paso("4 · la opción aparece sólo donde tiene sentido")
{
  ok(menu.includes("onElegirPaginas"), "el menú de impresión la acepta")
  ok(menu.includes("{onElegirPaginas && ("),
    "y la muestra sólo si quien lo usa la ofrece",
    "el protocolo es un documento entero: no se recorta")

  const alta = leer("features/ordenes/NuevaOrdenPage.jsx")
  const carga = leer("features/carga/CargaPage.jsx")
  ok(alta.includes("onElegirPaginas={() => setEligiendoPaginas(true)}"), "está en Nueva Orden")
  ok(carga.includes("onElegirPaginas={() => setEligiendoPaginas(true)}"), "y en la pantalla de carga")

  /* El protocolo no la ofrece: es un documento legal completo. */
  const dictamen = leer("features/aptitud/DictamenPage.jsx")
  ok(!dictamen.includes("onElegirPaginas"), "el protocolo NO se puede recortar")
}

paso("5 · una página por categoría, en el orden de la categoría")
{
  ok(hoja.includes("datos.categorias.map((cat, i) =>"), "la hoja recorre las categorías")
  ok(hoja.includes("imp-salto-pagina"), "y corta página entre una y otra")
  /* El salto va en todas menos la última: una hoja en blanco al final es
     papel tirado, y en el mostrador se nota. Se comprueba que exista la
     comparación contra la última, sin atarse a cómo esté escrita. */
  ok(/i < ultima|i < datos.categorias.length - 1/.test(hoja),
    "salvo después de la última", "si no, sale una hoja en blanco")

  const orden = leer("shared/impresos/datosImpresionService.js")
  ok(orden.includes("sort((a, b) => a.orden - b.orden)"),
    "y salen en el orden de recorrido de la clínica")
}

paso("6 · cuántas páginas es esto en la práctica")
{
  const filas = psql(`
    SELECT p.nombre, count(DISTINCT c.id)
      FROM plantilla p
      JOIN plantilla_item pi ON pi.plantilla_id = p.id
      JOIN estudio e ON e.id = pi.estudio_id
      JOIN categoria c ON c.id = e.categoria_id
     GROUP BY p.id, p.nombre ORDER BY count(DISTINCT c.id) DESC;`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  ok(filas.length > 0, "se leyeron las baterías", `${filas.length}`)
  for (const [nombre, cats] of filas) {
    console.log(`     ${String(cats).padStart(2)} páginas   ${nombre}`)
  }
  const peor = Math.max(...filas.map(([, n]) => Number(n)))
  ok(peor >= 6, "hay baterías de seis páginas o más: por eso hace falta elegir",
    `la más larga son ${peor}`)
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: se eligen las páginas y el papel sigue siendo el mismo."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
