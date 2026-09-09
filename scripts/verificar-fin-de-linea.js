/* =====================================================================
   Comprueba que lo que se monta adentro de un contenedor Linux no tenga
   finales de línea de Windows.

   Por qué importa: git para Windows convierte a CRLF al clonar. Un .sh
   con "#!/bin/bash\r" adentro del contenedor da:

       bad interpreter: /bin/bash^M: no such file or directory

   y la instalación falla entera, con un mensaje que no explica nada. Le
   pasó a este proyecto: no se veía en la máquina donde se escribió el
   archivo, sólo al clonar de cero — que es exactamente lo que hace
   quien instala.

   El .gitattributes lo previene. Esto comprueba que siga siendo cierto.

   Va en Node y no en un grep del CI a propósito: la primera versión era
   `grep -lU $'\r'` y en Git Bash marcaba como rotos cuatro archivos que
   estaban perfectos. Un control que avisa sin motivo enseña a ignorarlo.
   Leyendo los bytes no hay ambigüedad, y se puede probar en la misma
   máquina donde uno trabaja.

       node scripts/verificar-fin-de-linea.js
   ===================================================================== */
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const OMITIR = new Set(["node_modules", ".git", "dist", "backups", ".vite"])

/* Sólo lo que cruza al contenedor. El resto puede tener CRLF sin que
   pase nada. */
const CUENTA = (nombre) =>
  nombre.endsWith(".sh") ||
  nombre.endsWith(".conf") ||
  nombre === "Dockerfile" ||
  nombre.endsWith(".sql")

function recorrer(dir, encontrados = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (OMITIR.has(entrada.name)) continue
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) recorrer(completo, encontrados)
    else if (CUENTA(entrada.name)) encontrados.push(completo)
  }
  return encontrados
}

const archivos = recorrer(RAIZ)
const conCR = []

for (const a of archivos) {
  if (fs.readFileSync(a).includes(0x0d)) conCR.push(path.relative(RAIZ, a))
}

console.log("")
if (conCR.length) {
  console.log("Estos archivos entran a un contenedor Linux y tienen finales de línea de Windows:")
  console.log("")
  for (const a of conCR) console.log(`    ${a.split(path.sep).join("/")}`)
  console.log("")
  console.log("  Adentro del contenedor eso rompe la instalación.")
  console.log("  Se corrige con:  git add --renormalize .")
  console.log("")
  process.exit(1)
}

console.log(`Los ${archivos.length} archivos que van al contenedor están con LF.`)
console.log("")
