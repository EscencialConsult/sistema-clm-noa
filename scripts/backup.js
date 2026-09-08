#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Copia de seguridad de la base · RNF-08, RNF-31

   Hace tres cosas:
     1. exporta la base entera (pg_dump)
     2. la cifra
     3. la deja en el disco de backup

   La copia sale CIFRADA porque después va a un disco externo y a un
   servicio de nube: son datos clínicos de personas reales, y un disco que
   se pierde o un proveedor comprometido no pueden significar que la
   historia de nadie quede a la vista.

   Uso:
     node scripts/backup.js                        → a ./backups
     node scripts/backup.js D:/backups-cmlnoa      → al disco externo

   Para que corra solo todas las noches, ver INSTALAR.md.
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { execFileSync, spawnSync } = require("child_process")

const RAIZ = path.resolve(__dirname, "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

if (!env.BACKUP_KEY) {
  console.error("Falta BACKUP_KEY en .env.")
  console.error("Generala con:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"")
  console.error("")
  console.error("Y guardá una copia FUERA del servidor. Si se pierde el servidor")
  console.error("y la clave estaba solo ahí, los backups no se pueden abrir.")
  process.exit(1)
}

const destino = process.argv[2] || path.join(RAIZ, "backups")
fs.mkdirSync(destino, { recursive: true })

const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
const archivo = path.join(destino, `cmlnoa-${sello}.sql.enc`)

/* ---------- 1 · exportar ---------- */
/* Va SIN --no-owner, a propósito. Esa opción saca los «OWNER TO» del
   volcado, así que al restaurar los esquemas auth y storage quedan a
   nombre de supabase_admin en lugar de supabase_auth_admin y
   supabase_storage_admin. Los datos vuelven bien y la restauración
   parece haber salido, pero GoTrue ya no puede leer auth.users: el
   login muere con 500 y el sistema queda inservible. Apareció en la
   primera prueba de restauración (RNF-32), que existe justamente para
   encontrar esto antes que un incendio. */
process.stdout.write("Exportando la base... ")
const dump = spawnSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "pg_dump", "-U", "supabase_admin", "-d", "postgres",
  "--clean", "--if-exists",
], { cwd: RAIZ, maxBuffer: 1024 * 1024 * 512 })

if (dump.status !== 0) {
  console.error("\nFalló pg_dump:", dump.stderr?.toString().slice(0, 400))
  process.exit(1)
}
const sql = dump.stdout
console.log(`${(sql.length / 1024 / 1024).toFixed(1)} MB`)

/* ---------- 2 · cifrar ---------- */
process.stdout.write("Cifrando... ")
const clave = crypto.createHash("sha256").update(env.BACKUP_KEY).digest()
const iv = crypto.randomBytes(12)
const cifrador = crypto.createCipheriv("aes-256-gcm", clave, iv)
const cuerpo = Buffer.concat([cifrador.update(sql), cifrador.final()])
const etiqueta = cifrador.getAuthTag()

/* iv + etiqueta al principio: hacen falta para descifrar, y la etiqueta
   además delata si el archivo fue modificado */
fs.writeFileSync(archivo, Buffer.concat([iv, etiqueta, cuerpo]))
console.log(`${(fs.statSync(archivo).size / 1024 / 1024).toFixed(1)} MB`)

/* ---------- 3 · limpiar los viejos ---------- */
/* Se conservan 30 días en el disco local. La copia de la nube guarda más
   tiempo y es la que cubre el desastre grande. */
const DIAS = 30
const limite = Date.now() - DIAS * 24 * 3600 * 1000
let borrados = 0
for (const f of fs.readdirSync(destino)) {
  if (!f.startsWith("cmlnoa-") || !f.endsWith(".sql.enc")) continue
  const p = path.join(destino, f)
  if (fs.statSync(p).mtimeMs < limite) { fs.unlinkSync(p); borrados++ }
}

console.log("")
console.log(`Listo: ${archivo}`)
if (borrados) console.log(`  (se borraron ${borrados} copias de más de ${DIAS} días)`)
console.log("")
console.log("Falta la copia fuera del edificio. Cuando esté contratado el")
console.log("servicio de nube, se sube este mismo archivo — ya cifrado, así que")
console.log("el proveedor nunca ve los datos. Y esa copia tiene que quedar")
console.log("INMUTABLE (RNF-31): si un ransomware cifra el servidor, no puede")
console.log("además borrar los respaldos.")
