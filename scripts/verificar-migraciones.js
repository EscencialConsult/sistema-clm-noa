#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Compara los INSERT de las migraciones contra las columnas que de
   verdad tiene cada tabla en 001_esquema.sql.

   Existe porque al simplificar el esquema de 29 a 18 tablas se quitaron
   columnas (concepto.rubro, plantilla.sigla, usuario.clave_hash) y los
   archivos de datos siguieron insertándolas. Eso no se ve leyendo:
   revienta recién al levantar la base, con la migración a medio aplicar.

   Uso:  node scripts/verificar-migraciones.js
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")

const DIR = path.resolve(__dirname, "..", "supabase", "migrations")
const esquema = fs.readFileSync(path.join(DIR, "001_esquema.sql"), "utf8")

/** Las columnas reales de cada tabla, según el CREATE TABLE. */
function columnasDe(tabla) {
  const re = new RegExp("CREATE TABLE " + tabla + "\\s*\\(([\\s\\S]*?)\\n\\);", "m")
  const m = esquema.match(re)
  if (!m) return null
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"))
    .map((l) => l.split(/[\s(]+/)[0])
    .filter((c) => c && !/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE)$/i.test(c))
}

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()
let problemas = 0
let revisados = 0

for (const archivo of archivos) {
  if (archivo === "001_esquema.sql") continue
  const texto = fs.readFileSync(path.join(DIR, archivo), "utf8")

  for (const m of texto.matchAll(/INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)/gi)) {
    const tabla = m[1]
    const reales = columnasDe(tabla)
    if (!reales) continue                       // tabla de otro esquema (auth, storage)
    revisados++
    const usadas = m[2].split(",").map((s) => s.trim()).filter(Boolean)
    const faltan = usadas.filter((c) => !reales.includes(c))
    if (faltan.length) {
      problemas++
      const linea = texto.slice(0, m.index).split("\n").length
      console.log(`${archivo}:${linea}  ${tabla} → no existe: ${faltan.join(", ")}`)
    }
  }
}

/* Las marcas que abren y cierran el cuerpo de una función tienen que
   estar balanceadas. Un escapado del shell puede comerse una, el archivo
   queda roto y NO se nota leyéndolo: revienta al aplicar la migración,
   a mitad de camino y con la base a medio armar. Pasó dos veces. */
const MARCA = "$".repeat(2)
let rotas = 0
for (const archivo of archivos) {
  const texto = fs.readFileSync(path.join(DIR, archivo), "utf8")
  const n = texto.split(MARCA).length - 1
  if (n % 2 !== 0) {
    rotas++
    console.log(`${archivo}  →  ${n} marcas ${MARCA}: impar, hay una función sin cerrar`)
  }
}

console.log("")
console.log(`${revisados} sentencias INSERT revisadas · ${archivos.length} migraciones`)
if (problemas || rotas) {
  if (problemas) console.log(`${problemas} INSERT con columnas inexistentes.`)
  if (rotas) console.log(`${rotas} archivo(s) con funciones sin cerrar.`)
  console.log("La migración va a fallar. Corregilo antes de levantar la base.")
  process.exit(1)
}
console.log("Todo en orden: columnas existentes y funciones bien cerradas.")
