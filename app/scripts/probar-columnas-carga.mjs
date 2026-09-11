/* =====================================================================
   Valor y Referencia sólo cuando hay algo que medir.

   ORINA COMPLETA son dieciséis estudios sin unidad y sin referencias:
   la pantalla de carga mostraba dieciséis casillas vacías y dieciséis
   guiones. En HEMOGRAMA las mismas dos columnas son imprescindibles.

   Lo que se prueba es que la decisión salga del DATO y no de una lista
   de nombres de categoría. Importa por dos motivos opuestos:

     · si mañana la bioquímica carga las referencias del hepatograma,
       las columnas tienen que volver solas;
     · y si alguien saca `unidad` o `ref_h` del select del servicio, la
       pantalla escondería las columnas en TODAS las categorías —
       incluida la del hemograma — sin un solo error a la vista.

   El segundo es el que motiva la mitad de las comprobaciones.

       node scripts/probar-columnas-carga.mjs      (desde app/)
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
console.log("Valor y Referencia sólo cuando hay algo que medir")

paso("1 · la decisión sale del dato, no del nombre de la categoría")
{
  const t = leer("features/carga/CargaPage.jsx")
  ok(t.includes("const mide = "), "se calcula si la categoría mide")
  ok(
    t.includes("[e.unidad, e.ref_h, e.ref_m]"),
    "mirando unidad y las dos referencias de sus estudios"
  )
  /* Una lista de nombres se desactualiza el día que la clínica crea una
     categoría nueva, y no falla: simplemente muestra las columnas mal. */
  ok(
    !/mide\s*=\s*\[?\s*"(ORINA|HEMOGRAMA|HEPATOGRAMA)/.test(t),
    "y no contra una lista de nombres escrita a mano"
  )
}

paso("2 · las columnas y las celdas se esconden juntas")
{
  const t = leer("features/carga/CargaPage.jsx")
  ok(t.includes('<th className="py-2.5">Valor</th>'), "existe la columna Valor")
  /* Si se escondiera sólo el encabezado o sólo la celda, la tabla queda
     corrida: los datos aparecen bajo el título equivocado. */
  const enc = t.slice(t.indexOf("<th className=\"py-2.5\">Resultado</th>"), t.indexOf("</thead>"))
  ok(enc.includes("{mide && ("), "el encabezado la esconde cuando no se mide")
  ok(t.includes("      {mide && (") && t.includes("{referencia}</td>"),
    "y las celdas de cada fila también")
  ok(t.includes("colSpan={mide ? 5 : 3}"),
    "la fila de «devuelto» ajusta su ancho", "si no, se sale de la tabla")
}

paso("3 · «Poner en» no ofrece un campo que no está")
{
  const t = leer("features/carga/CargaPage.jsx")
  ok(t.includes('COLUMNAS_APLICABLES.filter((c) => mide || c.key !== "detalle")'),
    "el desplegable saca «Valor» cuando no se mide")
  /* Sin el reseteo, el desplegable muestra «Resultado» (la primera
     opción) mientras el estado sigue en "detalle": el texto se escribe
     en Valor, en varias filas a la vez, sin que nadie lo vea. */
  ok(t.includes('if (!mide && columnaAplicar === "detalle") setColumnaAplicar("resultado")'),
    "y si estaba elegido, vuelve a Resultado al cambiar de categoría")
}

paso("4 · el servicio sigue trayendo con qué decidir")
{
  const s = leer("features/carga/services/ordenesService.js")
  for (const campo of ["unidad", "ref_h", "ref_m"]) {
    ok(new RegExp(`estudio:estudio_id \\([^)]*${campo}`, "s").test(s),
      `el select trae \`${campo}\``)
  }
}

paso("5 · contra el catálogo real")
{
  const filas = psql(`
    SELECT c.nombre,
           count(*) FILTER (WHERE coalesce(btrim(e.unidad),'')<>''
                              OR coalesce(btrim(e.ref_h),'')<>''
                              OR coalesce(btrim(e.ref_m),'')<>''),
           count(*)
      FROM categoria c JOIN estudio e ON e.categoria_id = c.id
     WHERE c.activo
     GROUP BY c.id, c.nombre ORDER BY c.orden;`)
    .split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))

  ok(filas.length > 0, "se leyeron las categorías", `${filas.length}`)

  const miden = filas.filter(([, con]) => Number(con) > 0)
  const noMiden = filas.filter(([, con]) => Number(con) === 0)

  for (const [nombre, con, total] of filas) {
    console.log(`     ${Number(con) > 0 ? "muestra" : "esconde"}  ${nombre.padEnd(24)} ${con}/${total} con medida`)
  }

  /* Dos anclas concretas. Si alguna cambia, no es que la prueba esté
     mal: cambió el catálogo, y hay que mirar por qué. */
  const hemograma = filas.find(([n]) => n === "HEMOGRAMA")
  ok(hemograma && Number(hemograma[1]) === Number(hemograma[2]),
    "HEMOGRAMA mide todo: las columnas se muestran",
    hemograma ? `${hemograma[1]}/${hemograma[2]}` : "no está")

  const orina = filas.find(([n]) => n === "ORINA COMPLETA")
  ok(orina && Number(orina[1]) === 0,
    "ORINA COMPLETA no mide nada: las columnas se esconden",
    orina ? `${orina[1]}/${orina[2]}` : "no está")

  ok(miden.length > 0 && noMiden.length > 0,
    "hay de las dos clases, así que esconderlas siempre o nunca estaría mal",
    `${miden.length} muestran · ${noMiden.length} esconden`)
}

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: las columnas aparecen sólo donde hay algo que comparar."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
