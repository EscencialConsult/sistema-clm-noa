/* =====================================================================
   Le pregunta a GitHub si hay cambios sin aplicar, y lo anota en la
   base para que se vea en la pantalla.

   NO actualiza nada. A propósito: en una clínica, cuándo se reinicia el
   sistema es una decisión de quien sabe si hay gente esperando, no del
   reloj. Esto sólo avisa; aplicar es `node scripts/actualizar.js`.

   Se programa una vez por día. También deja anotada la versión, para
   que cuando alguien llame diciendo "no me anda" la primera pregunta no
   sea una adivinanza: está abajo en la pantalla.

       node scripts/revisar-actualizacion.js
   ===================================================================== */
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const correr = (cmd, args) => spawnSync(cmd, args, { cwd: RAIZ, encoding: "utf8" })

function anotar(clave, valor) {
  const v = valor === null ? "NULL" : `'${String(valor).replace(/'/g, "''")}'`
  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
      "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
    {
      cwd: RAIZ, encoding: "utf8",
      input: `INSERT INTO estado_sistema (clave, valor, actualizado_at)
              VALUES ('${clave}', ${v}, now())
              ON CONFLICT (clave) DO UPDATE
                SET valor = EXCLUDED.valor, actualizado_at = now();`,
    }
  )
  if (r.status !== 0) throw new Error((r.stderr || "").trim().split("\n")[0])
}

console.log("")

/* La versión sale del registro de migraciones: es lo que de verdad
   tiene aplicado esta base, no lo que dice un archivo de texto que
   alguien se puede olvidar de actualizar. */
const ver = spawnSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA",
    "-c", "SELECT max(nombre) FROM migracion"],
  { cwd: RAIZ, encoding: "utf8" }
)
if (ver.status !== 0) {
  console.error("  No se pudo hablar con la base. ¿Está levantado el sistema?")
  console.error("")
  process.exit(1)
}
const version = (ver.stdout || "").trim().replace(/\.sql$/, "") || "sin registrar"

/* ¿Hay algo nuevo en GitHub? Sin internet no es un error: es una
   clínica, la conexión se cae. Se informa y se sale bien, para que la
   tarea programada no quede marcada como fallida todos los días. */
if (correr("git", ["fetch", "origin", "--quiet"]).status !== 0) {
  anotar("version", version)
  anotar("revisado_at", "sin conexión")
  console.log(`  Versión ${version}. No se pudo consultar GitHub (sin conexión).`)
  console.log("")
  process.exit(0)
}

const rama = (correr("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "").trim()

if (correr("git", ["rev-parse", "--verify", `origin/${rama}`]).status !== 0) {
  anotar("version", version)
  anotar("actualizaciones", "0")
  anotar("revisado_at", `rama "${rama}" sin equivalente en GitHub`)
  console.log(`  Versión ${version}. La rama "${rama}" no existe en GitHub.`)
  console.log("")
  process.exit(0)
}

const nuevos = (correr("git", ["log", "--oneline", `HEAD..origin/${rama}`]).stdout || "").trim()
const cuantos = nuevos ? nuevos.split("\n").length : 0

anotar("version", version)
anotar("actualizaciones", String(cuantos))
anotar("revisado_at", new Date().toISOString())

console.log(`  Versión ${version}`)
if (cuantos) {
  console.log(`  Hay ${cuantos} cambio${cuantos === 1 ? "" : "s"} sin aplicar:`)
  console.log("")
  for (const l of nuevos.split("\n").slice(0, 8)) console.log(`    ${l}`)
  console.log("")
  console.log("  Para aplicarlos:  node scripts/actualizar.js")
} else {
  console.log("  Al día.")
}
console.log("")
