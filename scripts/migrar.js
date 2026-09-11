/* =====================================================================
   Aplica a la base las migraciones que le falten.

   Por qué existe: las migraciones se aplican al crear la base por
   /docker-entrypoint-initdb.d, y Postgres recorre esa carpeta UNA sola
   vez, cuando el directorio de datos está vacío. En una base que ya
   tiene datos —la de la clínica, del día siguiente en adelante— agregar
   un archivo nuevo al repositorio no hace nada. Este script es el que
   lo hace.

   Es seguro correrlo dos veces: si no falta ninguna, lo dice y termina.

       node scripts/migrar.js            aplica lo que falte
       node scripts/migrar.js --ver      sólo informa, no toca nada
   ===================================================================== */
const { execFileSync, spawnSync } = require("child_process")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const DIR = path.join(RAIZ, "supabase", "migrations")
const SOLO_VER = process.argv.includes("--ver")

/* La 021 es la que crea el registro. Todo lo anterior a ella ya estaba
   aplicado en las bases que se instalaron antes de que esto existiera. */
const PRIMERA_CON_REGISTRO = 21

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

function psql(sql, { silencioso = true } = {}) {
  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
      "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
      ...(silencioso ? ["-tA"] : [])],
    { cwd: RAIZ, input: sql, encoding: "utf8" }
  )
  if (r.status !== 0) {
    const e = new Error((r.stderr || r.stdout || "").trim())
    e.esDeLaBase = true
    throw e
  }
  return (r.stdout || "").trim()
}

/* El hash se calcula sobre el contenido con los finales de línea
   normalizados, NO sobre los bytes del archivo.

   Motivo: git reescribe CRLF/LF al clonar o al hacer checkout según el
   sistema. Hasheando los bytes crudos, el mismo archivo da distinto en
   Windows que en Linux, y hasta un `git checkout` en la misma máquina
   lo cambia. El sistema se negaría a actualizar acusando una edición
   que nunca existió. Se encontró probándolo: el control saltó cuando lo
   único que había pasado era restaurar el archivo con git.

   Se quitan TODOS los \r, no sólo los de CRLF, para que dé exactamente
   lo mismo que `tr -d '\r' | sha256sum`, que es como lo calcula el
   script de instalación adentro del contenedor. Si los dos no
   coincidieran, una instalación limpia quedaría con hashes que después
   migrar.js leería como archivos editados. */
function hashDe(archivo) {
  const contenido = fs.readFileSync(archivo, "utf8").replace(/\r/g, "")
  return crypto.createHash("sha256").update(contenido, "utf8").digest("hex")
}

const numeroDe = (nombre) => parseInt(nombre.slice(0, 3), 10)

function morir(mensaje) {
  console.error("")
  console.error(mensaje)
  console.error("")
  process.exit(1)
}

/* ------------------------------------------------------------------ */

console.log("")
console.log("Migraciones · CML NOA")
console.log("")

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()
if (!archivos.length) morir("No hay ninguna migración en supabase/migrations.")

/* ¿la base contesta? */
try {
  psql("SELECT 1")
} catch (e) {
  morir(
    "No se puede hablar con la base.\n\n" +
    "  Si es Docker Desktop, fijate que esté corriendo.\n" +
    `  ${String(e.message).split("\n")[0]}`
  )
}

const hayTabla = psql(
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='migracion'"
) === "1"

/* ------------------------------------------------------------------
   Base anterior al registro: la 021 todavía no corrió, así que la tabla
   no existe. Se aplica la 021 sola para crearla, y después se ADOPTAN
   las anteriores: ya están aplicadas, sólo falta anotarlas. Si no se
   hiciera, el próximo paso las vería como pendientes e intentaría
   correr el esquema entero sobre una base que ya lo tiene.
   ------------------------------------------------------------------ */
if (!hayTabla) {
  const registro = archivos.find((f) => numeroDe(f) === PRIMERA_CON_REGISTRO)
  if (!registro) morir(`Falta la migración ${PRIMERA_CON_REGISTRO}, que es la que crea el registro.`)

  const previas = archivos.filter((f) => numeroDe(f) < PRIMERA_CON_REGISTRO)
  console.log("  Esta base es anterior al registro de migraciones.")
  console.log(`  Se crea el registro y se adoptan las ${previas.length} que ya estaban aplicadas.`)
  console.log("")

  if (SOLO_VER) { console.log("  (--ver: no se tocó nada)"); console.log(""); process.exit(0) }

  aplicar(registro, "instalacion")

  const filas = previas
    .map((f) => `('${f.replace(/'/g, "''")}', '${hashDe(path.join(DIR, f))}', 'adopcion')`)
    .join(",\n    ")
  psql(`INSERT INTO migracion (nombre, hash, aplicada_por) VALUES\n    ${filas}\n  ON CONFLICT (nombre) DO NOTHING;`)
  console.log(`  ${previas.length} adoptadas.`)
  console.log("")
}

/* ------------------------------------------------------------------ */

const aplicadas = new Map(
  psql("SELECT nombre || '\t' || hash FROM migracion")
    .split("\n").filter(Boolean)
    .map((l) => l.split("\t"))
)

/* Resguardo 1 · una migración ya aplicada que cambió de contenido.
   Es el error más caro: la base de la clínica y el repositorio dicen
   cosas distintas y no hay forma de notarlo mirando. */
const cambiadas = archivos.filter(
  (f) => aplicadas.has(f) && aplicadas.get(f) !== hashDe(path.join(DIR, f))
)
if (cambiadas.length) {
  morir(
    `Estas migraciones ya se aplicaron, pero el archivo cambió:\n\n` +
    cambiadas.map((f) => `    ${f}`).join("\n") +
    `\n\n  La base y el repositorio dicen cosas distintas.\n` +
    `  Una migración que ya corrió NO se edita: se corrige con una nueva.\n` +
    `  Esto no sigue hasta que alguien lo resuelva.`
  )
}

/* Resguardo 2 · una migración anotada cuyo archivo ya no está.
   Significa que alguien borró del repositorio algo que en esta base ya
   corrió. La base tiene cambios que el código no explica: cualquiera
   que instale de cero va a obtener otra cosa. */
const desaparecidas = [...aplicadas.keys()].filter((n) => !archivos.includes(n))
if (desaparecidas.length) {
  morir(
    `Estas migraciones están aplicadas en la base pero el archivo ya no existe:\n\n` +
    desaparecidas.map((f) => `    ${f}`).join("\n") +
    `\n\n  Esta base tiene cambios que el repositorio ya no explica: quien\n` +
    `  instale de cero va a obtener algo distinto. Hay que recuperar los\n` +
    `  archivos, o decidir a conciencia y borrarlos también del registro.`
  )
}

const pendientes = archivos.filter((f) => !aplicadas.has(f))

/* Resguardo 2 · una pendiente con número anterior a la última aplicada
   significa que dos personas usaron números que se cruzan. Aplicarla
   fuera de orden puede dejar la base distinta según en qué orden se
   instaló, que es imposible de reproducir después. */
const ultimaAplicada = Math.max(0, ...[...aplicadas.keys()].map(numeroDe))
const fueraDeOrden = pendientes.filter((f) => numeroDe(f) < ultimaAplicada)
if (fueraDeOrden.length) {
  morir(
    `Estas migraciones son nuevas pero tienen un número anterior a la última aplicada (${ultimaAplicada}):\n\n` +
    fueraDeOrden.map((f) => `    ${f}`).join("\n") +
    `\n\n  Dos personas numeraron en paralelo. Hay que renumerarlas después\n` +
    `  de la última aplicada para que el orden sea el mismo en todas las bases.`
  )
}

/* La versión que muestra el pie de la pantalla sale de acá.

   La escribía sólo el chequeo diario (revisar-actualizacion.js), así que
   entre que se aplicaba una migración y corría ese chequeo el sistema
   decía tener una versión vieja. Y «¿qué versión tenés?» es la primera
   pregunta cuando algo falla: una respuesta equivocada manda a buscar el
   problema donde no está.

   Se anota SIEMPRE, también cuando no había nada pendiente: así corriendo
   el comando se repara una versión que quedó vieja por cualquier motivo. */
function anotarVersion() {
  const ahora = psql("SELECT max(nombre) FROM migracion")
  if (!ahora) return null
  psql(`INSERT INTO estado_sistema (clave, valor, actualizado_at)
        VALUES ('version', '${ahora}', now())
        ON CONFLICT (clave) DO UPDATE
          SET valor = EXCLUDED.valor, actualizado_at = now();`)
  return ahora
}

for (const f of archivos.filter((x) => aplicadas.has(x))) {
  console.log(`  ${f.padEnd(42)} ya aplicada`)
}

if (!pendientes.length) {
  anotarVersion()
  console.log("")
  console.log(`  Nada que hacer: la base está en la ${String(ultimaAplicada).padStart(3, "0")}.`)
  console.log("")
  process.exit(0)
}

console.log("")
console.log(`  ${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"}:`)
for (const f of pendientes) console.log(`    ${f}`)
console.log("")

/* Con --ver el código de salida dice si falta algo, para que otro script
   pueda preguntarlo sin leer el texto:
       0 · no falta ninguna     2 · faltan     1 · error
   Se hace así porque buscar palabras en la salida es frágil: la primera
   versión buscaba "pendiente" y se enganchaba con el nombre de un
   archivo, 014_pendientes_navegable.sql. */
if (SOLO_VER) { console.log("  (--ver: no se aplicó ninguna)"); console.log(""); process.exit(2) }

/* ------------------------------------------------------------------
   Cada una en su transacción, y el registro se anota ADENTRO de esa
   misma transacción. Si falla a la mitad, se deshace entera y no queda
   anotada: no existe el estado "aplicada a medias", que es del que
   después no se sabe cómo salir.
   ------------------------------------------------------------------ */
function aplicar(archivo, quien) {
  const sql = fs.readFileSync(path.join(DIR, archivo), "utf8")
  const hash = hashDe(path.join(DIR, archivo))
  process.stdout.write(`  ${archivo.padEnd(42)} `)
  try {
    psql(
      "BEGIN;\n" + sql + "\n" +
      `INSERT INTO migracion (nombre, hash, aplicada_por) VALUES ('${archivo.replace(/'/g, "''")}', '${hash}', '${quien}')\n` +
      "  ON CONFLICT (nombre) DO UPDATE SET hash = EXCLUDED.hash, aplicada_at = now();\n" +
      "COMMIT;"
    )
    console.log("aplicada")
  } catch (e) {
    console.log("FALLÓ")
    morir(
      `${archivo} falló y se deshizo entera. La base quedó como estaba.\n\n` +
      String(e.message).split("\n").slice(0, 6).map((l) => `    ${l}`).join("\n")
    )
  }
}

for (const f of pendientes) aplicar(f, "actualizacion")

const ahora = anotarVersion()

console.log("")
console.log(`  Listo. La base queda en ${ahora}.`)
console.log("")
