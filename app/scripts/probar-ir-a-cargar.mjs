/* =====================================================================
   Del dictamen a la casilla que falta, sin buscarla.

   La pantalla de aptitud dice cuáles estudios faltan, pero para
   cargarlos había que volver, entrar a la orden y encontrar la categoría
   entre nueve. Con el paciente esperando, ese recorrido se hace mal.

   Son tres atajos que tienen que llevar al MISMO lugar: el del aviso del
   dictamen, el de la cabecera de la categoría y el del renglón del
   estudio. Y la pantalla de carga tiene que saber recibirlos.

   Lo que se comprueba con más cuidado es lo que pasa cuando el enlace no
   sirve: una categoría que no es de esa orden, o un texto cualquiera en
   la URL. Si eso dejara la pantalla sin ninguna categoría elegida, se
   vería como «la carga no abre» y nadie sabría por qué.

       node scripts/probar-ir-a-cargar.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

console.log("")
console.log("«Ir a cargarlo» · del dictamen a la casilla que falta")

const carga = leer("features/carga/CargaPage.jsx")
const dictamen = leer("features/aptitud/DictamenPage.jsx")

paso("1 · la pantalla de carga sabe recibir la categoría")
{
  ok(carga.includes("useSearchParams"), "lee la URL")
  ok(carga.includes('params.get("categoria")'), "y saca de ahí qué categoría abrir")

  /* Number("hola") es NaN, y NaN nunca va a coincidir con ningún id, así
     que un texto cualquiera se comporta como si no viniera nada. */
  ok(carga.includes('Number(params.get("categoria")) || null'),
    "un valor que no es número queda en nulo", "Number(\"hola\") || null === null")
}

paso("2 · se aplica cuando hay categorías, no al montar")
{
  /* Al montar, `categorias` está vacío: aplicar ahí no elegiría nada y el
     parámetro se perdería para siempre. Por eso el efecto depende de las
     categorías y no del montaje. */
  const i = carga.indexOf("if (!categoriaPedida || categoriaSel !== null) return")
  ok(i >= 0, "el efecto existe")
  if (i >= 0) {
    const bloque = carga.slice(i, i + 400)
    ok(bloque.includes("categorias.some((c) => c.id === categoriaPedida)"),
      "sólo si esa categoría es de esta orden")
    ok(bloque.includes("elegirCategoria(categoriaPedida)"),
      "y entonces la abre")
    ok(/\}, \[categorias, categoriaPedida\]\)/.test(bloque),
      "y espera a que lleguen las categorías", "depende de `categorias`")
  }

  /* No pisa lo que el usuario ya eligió: si entró por el atajo y después
     cambió de categoría a mano, una recarga de datos no puede devolverlo
     al principio. */
  ok(carga.includes("categoriaSel !== null) return"),
    "y no pisa la categoría que el usuario haya elegido después")
}

paso("3 · los tres atajos llevan al mismo lugar")
{
  const enlaces = [...dictamen.matchAll(/\/carga\/\$\{ordenId\}[^`]*/g)].map((m) => m[0])
  ok(enlaces.length >= 3, `hay ${enlaces.length} atajos`, enlaces.join("  ·  "))
  ok(enlaces.every((e) => e.includes("?categoria=") || e.includes("primeraSinCargar")),
    "todos apuntan a una categoría concreta, no a la orden pelada")

  ok(dictamen.includes("Ir a cargarlo"), "el de la cabecera de la categoría")
  ok(dictamen.includes("Ir a cargarlos"), "el del aviso del dictamen")
  ok(dictamen.includes("{!informada && falta && ("), "el del renglón del estudio")
}

paso("4 · no aparece donde no corresponde")
{
  /* Una orden informada no se toca: los resultados quedan bloqueados por
     la política de la base, así que ofrecer el atajo sería mandar a una
     pantalla donde no se puede escribir. */
  const atajos = [...dictamen.matchAll(/\{[^}]*navigate\(`\/carga\/\$\{ordenId\}/g)]
  ok(dictamen.split("Ir a cargarlo").length - 1 >= 1, "el atajo existe")
  const sinGuardia = dictamen
    .split(/\n/)
    .filter((l) => l.includes("Ir a cargarlo"))
  ok(sinGuardia.length >= 2, `${sinGuardia.length} botones de texto`)

  for (const marca of ["{r.faltan > 0 && !informada && (", "{!informada && falta && (", "{!informada && ("]) {
    ok(dictamen.includes(marca), `protegido con «${marca.trim()}»`)
  }
}

paso("5 · el destino sale de las categorías, no del primer item")
{
  /* Cavando en `sinCargar[0].estudio.categoria.id` esto seguiría
     compilando el día que el servicio deje de anidar la categoría, y
     mandaría a una URL sin categoría. */
  ok(dictamen.includes("const primeraSinCargar = categorias.find("),
    "se busca la primera categoría con algo sin cargar")
  ok(!dictamen.includes("sinCargar[0].estudio.categoria"),
    "y no se cava en el primer item")
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: los tres atajos llevan a la categoría que falta."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
