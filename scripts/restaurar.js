#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Restaura una copia de seguridad · RNF-08, RNF-32

   Esta es la mitad que importa. Un backup que nunca se restauró no es un
   respaldo: es una suposición. Por eso RNF-32 pide probarlo cada tanto,
   y por eso este script existe desde el primer día y no cuando haga falta.

   Uso:
     node scripts/restaurar.js backups/cmlnoa-2026-09-08-19-30-00.sql.enc

   PISA la base actual. Pide confirmación escrita antes de hacerlo.
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const readline = require("readline")
const { spawnSync } = require("child_process")

const RAIZ = path.resolve(__dirname, "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

const archivo = process.argv[2]
if (!archivo || !fs.existsSync(archivo)) {
  console.error("Uso: node scripts/restaurar.js <archivo.sql.enc>")
  const dir = path.join(RAIZ, "backups")
  if (fs.existsSync(dir)) {
    const hay = fs.readdirSync(dir).filter((f) => f.endsWith(".sql.enc")).sort().reverse()
    if (hay.length) {
      console.error("\nCopias disponibles:")
      hay.slice(0, 10).forEach((f) => console.error("  backups/" + f))
    }
  }
  process.exit(1)
}
if (!env.BACKUP_KEY) {
  console.error("Falta BACKUP_KEY en .env: sin esa clave el archivo no se puede abrir.")
  process.exit(1)
}

/* ---------- descifrar ---------- */
process.stdout.write("Descifrando... ")
const bruto = fs.readFileSync(archivo)
const clave = crypto.createHash("sha256").update(env.BACKUP_KEY).digest()
let sql
try {
  const descifrador = crypto.createDecipheriv("aes-256-gcm", clave, bruto.subarray(0, 12))
  descifrador.setAuthTag(bruto.subarray(12, 28))
  sql = Buffer.concat([descifrador.update(bruto.subarray(28)), descifrador.final()])
} catch {
  console.error("\nNo se pudo descifrar.")
  console.error("O la BACKUP_KEY no es la que se usó para hacer esta copia,")
  console.error("o el archivo está dañado o fue modificado.")
  process.exit(1)
}
console.log(`${(sql.length / 1024 / 1024).toFixed(1)} MB`)

/* ---------- avisar antes de pisar ---------- */
const fecha = fs.statSync(archivo).mtime.toLocaleString("es-AR")
console.log("")
console.log(`Copia del ${fecha}`)
console.log("")
console.log("ESTO PISA LA BASE ACTUAL. Todo lo cargado después de esa fecha")
console.log("se pierde. Si el sistema está en uso, primero avisá que se pasa")
console.log("a papel (procedimiento P-03).")
console.log("")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Escribí "restaurar" para seguir: ', (r) => {
  rl.close()
  if (r.trim().toLowerCase() !== "restaurar") {
    console.log("Cancelado. No se tocó nada.")
    process.exit(0)
  }

  process.stdout.write("Restaurando... ")
  const res = spawnSync("docker", [
    "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres",
  ], { cwd: RAIZ, input: sql, maxBuffer: 1024 * 1024 * 512 })

  if (res.status !== 0) {
    console.error("\nFalló:", res.stderr?.toString().slice(0, 600))
    process.exit(1)
  }
  console.log("listo")

  /* ---------- devolver los esquemas a su dueño ---------- */
  /* Un volcado hecho con --no-owner deja auth y storage a nombre de
     supabase_admin. Los datos vuelven bien, pero GoTrue pierde el acceso a
     auth.users y el login empieza a dar 500: la base está entera y el
     sistema no anda. El backup ya no usa esa opción, pero las copias
     viejas sí, así que esto corre siempre. No molesta si ya está bien. */
  process.stdout.write("Acomodando permisos... ")
  const dueños = spawnSync("docker", [
    "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA",
  ], {
    cwd: RAIZ, encoding: "utf8",
    input: fs.readFileSync(path.join(RAIZ, "supabase", "reparar-duenios.sql")),
  })
  const permisos = (dueños.stdout || "").trim().split(String.fromCharCode(10)).pop()
  if (permisos !== "t|t") {
    console.error("")
    console.error("NO quedaron bien los permisos de auth/storage.")
    console.error("Con esto nadie va a poder entrar al sistema.")
    console.error(dueños.stderr?.toString().slice(0, 400))
    process.exit(1)
  }
  console.log("bien")

  /* ---------- reiniciar lo que quedó mirando la base vieja ---------- */
  /* La restauración borra y rehace cada objeto. Los servicios siguen con
     las conexiones de antes y con la estructura vieja en memoria, así que
     aunque los permisos estén bien devuelven vacío o 500 hasta que se los
     reinicia. */
  process.stdout.write("Reiniciando servicios... ")
  spawnSync("docker", ["compose", "restart", "auth", "rest", "storage"],
            { cwd: RAIZ, stdio: "ignore" })
  console.log("listo")

  /* ---------- comprobar que quedó algo coherente ---------- */
  const control = spawnSync("docker", [
    "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tAc",
    "SELECT (SELECT count(*) FROM estudio) || ' estudios · ' || " +
    "(SELECT count(*) FROM empresa) || ' empresas · ' || " +
    "(SELECT count(*) FROM persona) || ' personas · ' || " +
    "(SELECT count(*) FROM orden)   || ' órdenes'",
  ], { cwd: RAIZ, encoding: "utf8" })

  console.log("")
  console.log("La base quedó con:", control.stdout.trim())
  console.log("")
  console.log("Revisá cuatro cosas antes de dar por buena la restauración:")
  console.log("  · que alguien pueda ENTRAR al sistema (si el login falla, no")
  console.log("    sirve de nada que los datos estén: el sistema está caído)")
  console.log("  · que esté la última orden que se había cargado")
  console.log("  · que un protocolo se imprima completo")
  console.log("  · que la cantidad de personas del padrón tenga sentido")
  console.log("")
  console.log("Y anotá la prueba en la planilla de 08_Procedimientos (P-02).")
})
