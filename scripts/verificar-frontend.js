#!/usr/bin/env node
/* ---------------------------------------------------------------------
   ¿El frontend y la base hablan de lo mismo?

   Uso:  node scripts/verificar-frontend.js

   Lee el código de app/src, saca cada tabla, columna y función que
   nombra, y las compara contra la base de verdad.

   Existe porque el error más caro de este proyecto no es el que rompe la
   compilación: es el que compila perfecto y devuelve vacío. Una columna
   renombrada, una vista sin la columna que la pantalla pide, una función
   sin GRANT. Nada de eso lo detecta `npm run build`, y en pantalla se ve
   como «no hay datos».

   Sobre el análisis: el archivo se parte por cada `.from(`, así el
   `.select()` que se mira es siempre el de ESA consulta y no el de la
   siguiente. Las relaciones anidadas —persona:persona_id ( ... ),
   usuario_rol(rol_codigo)— se descartan: son otra tabla, no columnas de
   esta. La primera versión no hacía ninguna de las dos cosas y reportó
   41 problemas que no existían.
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const RAIZ = path.resolve(__dirname, "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

const sql = (t) => execFileSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA",
], { cwd: RAIZ, encoding: "utf8", input: t }).trim()

/* ---------- lo que dice la base ---------- */
const relaciones = new Map()
for (const linea of sql(`
  SELECT c.relname || '|' || a.attname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v','p');`).split("\n")) {
  const [rel, col] = linea.split("|")
  if (!rel) continue
  if (!relaciones.has(rel)) relaciones.set(rel, new Set())
  relaciones.get(rel).add(col)
}

const funciones = new Set(
  sql(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public';`).split("\n").filter(Boolean)
)
const ejecutables = new Set(
  sql(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE');`).split("\n").filter(Boolean)
)
const sinRls = sql(`SELECT tablename FROM pg_tables
                     WHERE schemaname='public' AND NOT rowsecurity;`).split("\n").filter(Boolean)

/* ---------- lo que pide el frontend ---------- */
function archivos(dir) {
  const salida = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) salida.push(...archivos(p))
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) salida.push(p)
  }
  return salida
}

/** Separa la lista de un select respetando los paréntesis, y se queda
 *  sólo con lo que es realmente una columna de la tabla consultada. */
function columnasPedidas(seleccion) {
  const partes = []
  let nivel = 0
  let actual = ""
  for (const ch of seleccion) {
    if (ch === "(") nivel++
    if (ch === ")") nivel--
    if (ch === "," && nivel === 0) { partes.push(actual); actual = "" }
    else actual += ch
  }
  partes.push(actual)

  return partes
    .map((c) => c.trim())
    .filter((c) => c && c !== "*" && !c.includes("(") && !c.includes("$"))
    .map((c) => c.replace(/!inner|!left/g, "").trim())
    .map((c) => (c.includes(":") ? c.split(":")[1] : c).trim())
    .filter(Boolean)
}

const problemas = []
const usadas = new Set()
const rpcs = new Set()

for (const f of archivos(path.join(RAIZ, "app", "src"))) {
  const src = fs.readFileSync(f, "utf8")
  const corto = f.replace(path.join(RAIZ, "app", "src") + path.sep, "").replace(/\\/g, "/")

  for (const m of src.matchAll(/\.rpc\(\s*["'`](\w+)["'`]/g)) {
    const fn = m[1]
    rpcs.add(fn)
    if (!funciones.has(fn)) problemas.push(`${corto}: llama a ${fn}(), que no existe`)
    else if (!ejecutables.has(fn)) problemas.push(`${corto}: ${fn}() existe pero authenticated no la puede ejecutar`)
  }

  for (const trozo of src.split(".from(").slice(1)) {
    const tabla = trozo.match(/^\s*["'`]([\w.]+)["'`]/)?.[1]
    if (!tabla) continue
    usadas.add(tabla)
    if (!relaciones.has(tabla)) {
      problemas.push(`${corto}: usa "${tabla}", que no existe en la base`)
      continue
    }
    const sel = trozo.match(/\.select\(\s*(["'`])([\s\S]*?)\1/)
    if (!sel) continue
    for (const nombre of columnasPedidas(sel[2])) {
      if (!relaciones.get(tabla).has(nombre)) {
        problemas.push(`${corto}: ${tabla}.${nombre} no existe`)
      }
    }
  }
}

/* ---------- informe ---------- */
console.log("Tablas y vistas que usa el frontend")
for (const t of [...usadas].sort()) console.log(`  ${relaciones.has(t) ? "✔" : "✘"} ${t}`)

console.log("")
console.log("Funciones que llama")
for (const f of [...rpcs].sort()) {
  console.log(`  ${funciones.has(f) && ejecutables.has(f) ? "✔" : "✘"} ${f}()`)
}

console.log("")
if (sinRls.length) {
  problemas.push(`tablas sin RLS: ${sinRls.join(", ")}`)
  console.log(`✘ ${sinRls.length} tablas sin RLS: ${sinRls.join(", ")}`)
} else {
  console.log("✔ Todas las tablas de public tienen RLS activo")
}

console.log("")
if (problemas.length === 0) {
  console.log("El frontend y la base dicen lo mismo.")
} else {
  console.log(`${problemas.length} desajustes:`)
  problemas.forEach((p) => console.log(`  · ${p}`))
  process.exitCode = 1
}
