/* =====================================================================
   Conceptos facturables — la pantalla donde se decide qué se cobra.

   Es la única del sistema donde un error no se ve: si un concepto queda
   sin estudios, o un estudio sin concepto, todo sigue andando —la orden
   se crea, el papel sale, el profesional carga— y lo único que pasa es
   que se factura de menos. Nadie se entera hasta el cierre del mes.

   --- Por qué esta batería está escrita así ---

   La primera versión comprobaba clases de CSS y frases exactas
   («max-h-72», «Se cobra sólo si la orden tiene»). Al rediseñar la
   pantalla se puso en rojo DIEZ veces sin que nada estuviera roto: el
   comportamiento seguía, escrito de otra forma. Una prueba que se cae
   con cada cambio de redacción no protege nada y entrena a ignorarla.

   Ahora se comprueba lo que tiene que seguir siendo cierto:
     · los dos problemas se calculan y se muestran;
     · ninguna lista larga puede crecer sin límite;
     · la grilla no tiene columnas fijas;
     · la regla de todo-o-nada está dicha en alguna parte;
     · y el impacto de precio sale de la base, no de una cuenta a ojo.

       node scripts/probar-conceptos.mjs      (desde app/)
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
const dato = (t) => console.log(`     · ${t}`)
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

const psql = (sql) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: sql }
).trim()

console.log("")
console.log("Conceptos facturables")

const p = leer("features/catalogo/ConceptosPage.jsx")
const s = leer("features/catalogo/services/conceptosService.js")

paso("1 · los dos problemas se calculan y se muestran")
{
  /* Un estudio sin concepto se pide, se hace y suma $0. Un concepto sin
     estudios tiene precio y no se cobra nunca. Las dos cosas son
     invisibles mirando una orden: sólo aparecen acá. */
  ok(/const rotos = conceptos\.filter\(.*cantidad\) === 0\)/.test(p),
    "se calculan los conceptos activos sin estudios")
  ok(s.includes("getSinConcepto"), "y los estudios sin concepto")

  /* Se cuentan los usos en el JSX en vez de buscar una frase: el texto
     cambia con cada rediseño, que haya un lugar donde se muestren no. */
  const usosRotos = (p.match(/rotos\.length|rotos\.map|rotos\.reduce/g) ?? []).length
  const usosHuerfanos = (p.match(/huerfanos\.length|huerfanos\.map/g) ?? []).length
  ok(usosRotos >= 3, "los rotos se muestran en más de un lugar", `${usosRotos} usos`)
  ok(usosHuerfanos >= 3, "los huérfanos también", `${usosHuerfanos} usos`)

  /* Y que el total en pesos esté: es lo que hace que alguien lo arregle.
     Una lista sola se mira y se sigue de largo. */
  ok(/rotos\.reduce\(\(s, c\) => s \+ Number\(c\.precio\)/.test(p),
    "y se dice cuánta plata es",
    "sin el número, la lista se mira y se sigue de largo")
}

paso("2 · «sin estudios» no se mezcla con activo/inactivo")
{
  /* Es el error que más costó: un concepto puede estar ACTIVO y sin
     estudios a la vez, y ése es justamente el caso grave. Metiéndolo en
     la misma columna que el estado, se perdía la mitad del dato. */
  const zonaTabla = p.slice(p.indexOf("<thead>"), p.indexOf("</tbody>"))
  ok(/>Estado</.test(zonaTabla), "hay columna de estado")
  ok(/>Alertas</.test(zonaTabla), "y una de alertas, aparte")
  const zonaEstado = zonaTabla.slice(zonaTabla.indexOf("c.activo ? ("))
  ok(!/Sin estudios/.test(zonaEstado.slice(0, 600)),
    "«sin estudios» no vive en la columna de estado")
}

paso("3 · ninguna lista larga crece sin límite")
{
  /* «Básico de ley» son 52 estudios, los huérfanos 30 y los conceptos
     33. Cualquiera de las tres, suelta, empuja la pantalla entera. */
  const contenidas = (p.match(/overflow-y-auto/g) ?? []).length
  ok(contenidas >= 3, "las listas tienen scroll propio", `${contenidas} con overflow`)
  ok(p.includes("paginar(") && p.includes("<Paginador"),
    "y la de conceptos está paginada", "son 33")
}

paso("4 · la pantalla entra en cualquier ancho")
{
  /* Una grilla de N columnas sin versión de una sola columna no entra en
     una notebook con el navegador a media pantalla. */
  const fijas = [...p.matchAll(/className="[^"]*\bgrid-cols-(\d)\b[^"]*"/g)]
    .filter((m) => !/(sm|md|lg|xl):grid-cols-/.test(m[0]) && m[1] !== "1")
  ok(fijas.length === 0, "no hay grillas de columnas fijas",
    fijas.length ? fijas[0][0] : "ninguna")
  ok(/grid-cols-1[^"]*\b(lg|xl):grid-cols-\[/.test(p),
    "la principal se apila en pantallas chicas")
}

paso("5 · la regla de todo-o-nada está dicha")
{
  /* Sumarle un estudio a un concepto lo vuelve MÁS DIFÍCIL de cobrar.
     Es contraintuitivo y es el error caro de esta pantalla. */
  ok(/TODOS sus estudios|todos estos estudios|todos sus estudios/i.test(p),
    "se explica que se cobra sólo con todos")
  ok(/más difícil de cobrar/.test(p),
    "y que sumar uno juega en contra")
  ok(/ahora una orden tiene que incluirlo/.test(p),
    "y se repite al agregar uno")
}

paso("6 · el impacto de precio sale de la base")
{
  /* Contar «órdenes que tienen todos sus estudios» da doce veces el
     número real para el I.M.C.: el Básico de ley se lo lleva. Si la
     pantalla hiciera esa cuenta, se cambiarían precios mirando un
     número inventado. */
  ok(s.includes("uso_de_conceptos"), "el servicio llama a la función de la base")
  ok(p.includes("uso[conceptoActual.id]"), "y la pantalla muestra ese número")
  ok(/no toca lo ya facturado|se congela/.test(p),
    "y aclara que cambiar el precio no toca lo ya facturado",
    "si no, alguien cree que va a recuperar plata de lo que ya salió")
}

paso("7 · el estudio inactivo adentro del concepto")
{
  /* Si un estudio del paquete está inactivo, la orden no lo va a
     incluir y el concepto no se cobra nunca. Es el mismo problema que
     un concepto vacío, pero escondido adentro. */
  ok(p.includes("const inactivosDentro"), "se detectan")
  ok(/inactivosDentro\.length > 0 &&/.test(p), "y se avisan")
}

paso("8 · al asignar el último huérfano no queda una pestaña fantasma")
{
  ok(/pestana === "huerfanos" && huerfanos\.length === 0/.test(p),
    "vuelve sola a la lista de conceptos")
}

paso("9 · contra los precios reales")
{
  const filas = psql(`
    SELECT c.nombre, c.precio, count(ce.estudio_id)
      FROM concepto c LEFT JOIN concepto_estudio ce ON ce.concepto_id = c.id
     WHERE c.activo GROUP BY c.id, c.nombre, c.precio ORDER BY c.precio DESC;`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  ok(filas.length > 0, "se leyeron los conceptos", `${filas.length} activos`)

  /* Esto se informa, no se falla: es un dato para corregir con la
     clínica, no un defecto del código. */
  const sinEstudios = filas.filter(([, , n]) => Number(n) === 0)
  for (const [nombre, precio] of sinEstudios) {
    dato(`«${nombre}» $${Number(precio).toLocaleString("es-AR")} y ningún estudio`)
  }
  const perdido = sinEstudios.reduce((acc, [, pr]) => acc + Number(pr), 0)
  if (sinEstudios.length) {
    dato(`${sinEstudios.length} conceptos no se pueden cobrar: $${perdido.toLocaleString("es-AR")} inalcanzables`)
  }
  const huerfanos = psql(`
    SELECT count(*) FROM estudio e
     WHERE NOT EXISTS (SELECT 1 FROM concepto_estudio ce WHERE ce.estudio_id = e.id);`)
  dato(`${huerfanos} estudios no están en ningún concepto: suman $0`)

  /* Lo que sí se comprueba: que el paquete grande siga siendo el más
     caro entre los que agrupan. calcular_presupuesto recorre de mayor a
     menor, y es lo que hace que el paquete gane sobre las partes. */
  const basico = filas.find(([n]) => n === "Básico de ley")
  ok(!!basico, "existe el «Básico de ley»")
  if (basico) {
    const masCaros = filas.filter(([n, pr]) => n !== "Básico de ley" && Number(pr) > Number(basico[1]))
    ok(masCaros.every(([, , n]) => Number(n) <= 1),
      "los conceptos más caros que el básico son de un solo estudio",
      masCaros.length ? masCaros.map(([n]) => n).join(", ") : "ninguno más caro")
  }
}

paso("10 · las dos formas de calcular el importe coinciden")
{
  /* conceptos_cobrados() es una copia del recorrido de
     calcular_presupuesto. La migración 025 lo comprueba al aplicarse,
     pero eso fue una vez: acá se vuelve a comprobar sobre las órdenes
     que haya hoy, porque el día que alguien toque una regla va a tocar
     una sola de las dos. */
  const distintas = psql(`
    SELECT count(*) FROM orden o
     WHERE (SELECT coalesce(sum(c.precio),0)
              FROM conceptos_cobrados(o.id) cc JOIN concepto c ON c.id = cc.concepto_id)
           IS DISTINCT FROM calcular_presupuesto(o.id);`)
  ok(distintas === "0",
    "ninguna orden da distinto entre las dos",
    `${distintas} discrepancias`)
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: los problemas se ven, la pantalla entra, y el impacto es real."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
