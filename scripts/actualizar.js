/* =====================================================================
   Actualiza el sistema instalado a lo último que haya en GitHub.

       node scripts/actualizar.js          actualiza
       node scripts/actualizar.js --ver    sólo dice si hay algo nuevo

   El orden importa y no es casual:

     1. backup ANTES de tocar nada. Si algo sale mal a mitad de camino,
        el punto de vuelta es de hace cinco minutos y no de anoche.
     2. bajar los cambios
     3. migraciones pendientes — cada una en su transacción
     4. reconstruir el front, porque la dirección del servidor queda
        grabada adentro al compilar
     5. reiniciar
     6. correr las pruebas contra el sistema ya actualizado

   Se detiene en el primer paso que falle, y dice dónde quedó el backup.
   ===================================================================== */
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const SOLO_VER = process.argv.includes("--ver")

function correr(cmd, args, opciones = {}) {
  return spawnSync(cmd, args, { cwd: RAIZ, encoding: "utf8", ...opciones })
}

function paso(n, titulo) {
  process.stdout.write(`  ${n} · ${titulo.padEnd(16)} `)
}

let backupHecho = null

function morir(mensaje) {
  console.log("")
  console.log("")
  console.log("  Se detuvo acá. " + mensaje)
  if (backupHecho) {
    console.log("")
    console.log(`  El backup de antes de empezar está en:`)
    console.log(`    ${backupHecho}`)
    console.log(`  Para volver atrás:  node scripts/restaurar.js "${backupHecho}"`)
  }
  console.log("")
  process.exit(1)
}

console.log("")
console.log("Actualizar · CML NOA")
console.log("")

/* --- ¿hay algo nuevo? ------------------------------------------------ */

if (correr("git", ["fetch", "origin", "--quiet"]).status !== 0) {
  morir("No se pudo consultar GitHub. ¿Hay internet?")
}

const rama = (correr("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "").trim()

/* Si la rama no existe en GitHub, comparar contra ella devuelve vacío y
   parecería que está todo al día. En el servidor de la clínica esto
   significa que alguien dejó una rama de trabajo puesta. */
if (correr("git", ["rev-parse", "--verify", `origin/${rama}`]).status !== 0) {
  morir(`La rama "${rama}" no existe en GitHub, así que no hay con qué comparar.\n` +
        `  En el servidor tiene que estar puesta la rama principal:  git checkout main`)
}

const nuevos = (correr("git", ["log", "--oneline", `HEAD..origin/${rama}`]).stdout || "").trim()

if (!nuevos) {
  console.log(`  No hay nada nuevo: la rama ${rama} ya está al día.`)
  /* Aun así puede faltar aplicar una migración, si la última vez se
     cortó por la mitad. Se pregunta por el código de salida y no
     leyendo el texto: 2 = faltan. */
  if (correr("node", ["scripts/migrar.js", "--ver"]).status === 2) {
    console.log("")
    console.log("  PERO hay migraciones sin aplicar. Corré: node scripts/migrar.js")
  }
  console.log("")
  process.exit(0)
}

const cuantos = nuevos.split("\n").length
console.log(`  Hay ${cuantos} cambio${cuantos === 1 ? "" : "s"} nuevo${cuantos === 1 ? "" : "s"} en ${rama}:`)
console.log("")
for (const l of nuevos.split("\n").slice(0, 12)) console.log(`    ${l}`)
if (cuantos > 12) console.log(`    ... y ${cuantos - 12} más`)
console.log("")

if (SOLO_VER) {
  console.log("  (--ver: no se actualizó nada. Para hacerlo: node scripts/actualizar.js)")
  console.log("")
  process.exit(0)
}

/* Si hay cosas sin guardar, un git pull las pisa o falla a la mitad. */
const sucio = (correr("git", ["status", "--porcelain"]).stdout || "").trim()
if (sucio) {
  console.log("  Hay cambios sin guardar en el servidor:")
  console.log("")
  for (const l of sucio.split("\n").slice(0, 10)) console.log(`    ${l}`)
  morir("En el servidor no se editan archivos. Resolvelo antes de actualizar.")
}

/* --- 1 · backup ------------------------------------------------------ */

paso(1, "Backup")
const destino = process.env.CMLNOA_BACKUPS || path.join(RAIZ, "backups")
const bk = correr("node", ["scripts/backup.js", destino])
if (bk.status !== 0) {
  console.log("FALLÓ")
  morir("No se pudo hacer el backup, así que no se toca nada más.\n" +
        "  " + (bk.stderr || bk.stdout || "").trim().split("\n").slice(-2).join(" "))
}
backupHecho = ((bk.stdout || "").match(/Listo: (.+)/) || [, "(ver la carpeta de backups)"])[1].trim()
console.log("hecho")

/* --- 2 · bajar ------------------------------------------------------- */

paso(2, "Bajando")
const pull = correr("git", ["pull", "--ff-only", "origin", rama])
if (pull.status !== 0) {
  console.log("FALLÓ")
  morir("No se pudo bajar sin fusionar.\n  " +
        (pull.stderr || "").trim().split("\n").slice(0, 3).join("\n  "))
}
console.log(`${cuantos} commit${cuantos === 1 ? "" : "s"}`)

/* --- 3 · migraciones ------------------------------------------------- */

paso(3, "Migraciones")
const mig = correr("node", ["scripts/migrar.js"])
if (mig.status !== 0) {
  console.log("FALLÓ")
  console.log("")
  console.log((mig.stdout || "") + (mig.stderr || ""))
  morir("La base quedó como estaba: las migraciones se deshacen enteras.")
}
const aplicadas = ((mig.stdout || "").match(/^ +\S+\.sql +aplicada$/gm) || []).length
console.log(aplicadas ? `${aplicadas} nueva${aplicadas === 1 ? "" : "s"}` : "ninguna nueva")

/* --- 4 · front ------------------------------------------------------- */

paso(4, "Front")
const build = correr("docker", ["compose", "build", "app"])
if (build.status !== 0) {
  console.log("FALLÓ")
  morir("No se pudo reconstruir la aplicación.\n  " +
        (build.stderr || "").trim().split("\n").slice(-3).join("\n  "))
}
console.log("reconstruido")

/* --- 5 · reiniciar --------------------------------------------------- */

paso(5, "Reiniciando")
const up = correr("docker", ["compose", "up", "-d"])
if (up.status !== 0) {
  console.log("FALLÓ")
  morir("No se pudieron levantar los servicios.\n  " +
        (up.stderr || "").trim().split("\n").slice(-3).join("\n  "))
}
console.log("listo")

/* --- 6 · pruebas ----------------------------------------------------- */

paso(6, "Pruebas")
const BATERIAS = [
  ["scripts/verificar-frontend.js", RAIZ],
  ["scripts/probar-casos.js", RAIZ],
  ["scripts/probar-permisos.mjs", path.join(RAIZ, "app")],
  ["scripts/probar-aptitud.mjs", path.join(RAIZ, "app")],
  ["scripts/probar-alta-orden.mjs", path.join(RAIZ, "app")],
  ["scripts/probar-terceros.mjs", path.join(RAIZ, "app")],
]
const fallaron = []
for (const [script, cwd] of BATERIAS) {
  if (correr("node", [script], { cwd }).status !== 0) fallaron.push(path.basename(script))
}
if (fallaron.length) {
  console.log(`${fallaron.length} EN ROJO`)
  console.log("")
  for (const f of fallaron) console.log(`      ${f}`)
  morir("El sistema quedó actualizado pero algo no pasa las pruebas.\n" +
        "  Avisá antes de que lo use alguien.")
}
console.log("6 en verde")

/* --------------------------------------------------------------------- */

console.log("")
console.log("  Actualizado.")
console.log("")
console.log("  Decile a los puestos que refresquen con F5 (Ctrl+F5 si algo se ve raro).")
console.log("")
