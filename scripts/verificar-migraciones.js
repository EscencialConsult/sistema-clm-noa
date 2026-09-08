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

console.log("")
console.log(`${revisados} sentencias INSERT revisadas`)
if (problemas) {
  console.log(`${problemas} con columnas inexistentes — la migración va a fallar.`)
  process.exit(1)
}
console.log("Todas las columnas existen.")
