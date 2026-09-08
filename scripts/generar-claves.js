#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Genera las claves del servidor y escribe .env

   Se corre UNA VEZ, al instalar el servidor de la clínica. Las claves
   que salen de acá no se comparten, no se commitean y no se reutilizan
   de otro sistema.

   Uso:  node scripts/generar-claves.js
         node scripts/generar-claves.js --forzar    (regenera sobre uno existente)

   Qué genera:
     JWT_SECRET        el secreto con el que se firman las sesiones
     ANON_KEY          la que viaja al navegador. Cualquiera puede leerla:
                       por eso la seguridad real es RLS, no esta clave
     SERVICE_ROLE_KEY  la de administración. NUNCA sale del servidor
     POSTGRES_PASSWORD la contraseña de la base
   --------------------------------------------------------------------- */
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const DESTINO = path.join(RAIZ, ".env")
const forzar = process.argv.includes("--forzar")

if (fs.existsSync(DESTINO) && !forzar) {
  console.error("Ya existe .env — no lo piso.")
  console.error("Si de verdad querés regenerar las claves: node scripts/generar-claves.js --forzar")
  console.error("OJO: al cambiarlas, las sesiones abiertas se caen y hay que")
  console.error("actualizar app/.env con la nueva ANON_KEY.")
  process.exit(1)
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function firmarJwt(payload, secreto) {
  const cab = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const cue = b64url(JSON.stringify(payload))
  const firma = b64url(crypto.createHmac("sha256", secreto).update(`${cab}.${cue}`).digest())
  return `${cab}.${cue}.${firma}`
}

const jwtSecret = crypto.randomBytes(48).toString("base64")
const pgPass = crypto.randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 28)

const ahora = Math.floor(Date.now() / 1000)
const diezAnios = ahora + 60 * 60 * 24 * 365 * 10

const anonKey = firmarJwt({ role: "anon", iss: "supabase", iat: ahora, exp: diezAnios }, jwtSecret)
const serviceKey = firmarJwt({ role: "service_role", iss: "supabase", iat: ahora, exp: diezAnios }, jwtSecret)

const sitio = process.env.SITE_URL || "http://servidor-cml"

const env = `# =====================================================================
#  CML NOA · claves del servidor de la clínica
#  Generado el ${new Date().toLocaleString("es-AR")}
#
#  NO se commitea. NO se comparte por WhatsApp ni por mail.
#  Si alguna se filtra, se regeneran todas: node scripts/generar-claves.js --forzar
# =====================================================================

POSTGRES_PASSWORD=${pgPass}
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
SITE_URL=${sitio}
`

const envApp = `# Generado por scripts/generar-claves.js — no se commitea
VITE_SUPABASE_URL=${sitio}:8000
VITE_SUPABASE_ANON_KEY=${anonKey}
`

fs.writeFileSync(DESTINO, env)
fs.writeFileSync(path.join(RAIZ, "app", ".env"), envApp)

console.log("Listo.")
console.log("  .env          las claves del servidor")
console.log("  app/.env      lo que necesita la aplicación")
console.log("")
console.log("Los dos están en .gitignore. Guardá una copia en un lugar seguro:")
console.log("si se pierde el JWT_SECRET, no se pueden validar las sesiones ni")
console.log("volver a generar las mismas claves.")
