#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Crea el bucket donde se guardan los informes de terceros (RF18).

   Va aparte de las migraciones por un motivo concreto: cuando estas
   corren, storage.buckets todavía es la versión base que trae la imagen
   de Postgres y le faltan columnas. El servicio de Storage las agrega
   recién al arrancar, o sea después. Intentar crearlo por SQL en el init
   falla con «column public of relation buckets does not exist».

   Se corre UNA vez, con la pila ya levantada:
     node scripts/crear-bucket.js

   Es idempotente: si el bucket ya existe, no rompe nada.
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

const API = process.env.CMLNOA_API || "http://localhost:8000"
const cab = {
  apikey: env.SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
}

const BUCKET = {
  id: "informes",
  name: "informes",
  public: false,                    // sin sesión no se ve, ni con la URL exacta
  file_size_limit: 20971520,        // 20 MB por informe (RNF-22)
  allowed_mime_types: [
    "application/pdf",
    "image/jpeg", "image/png", "image/webp", "image/tiff",
  ],
}

async function main() {
  const existentes = await (await fetch(`${API}/storage/v1/bucket`, { headers: cab })).json()
  if (Array.isArray(existentes) && existentes.some((b) => b.id === BUCKET.id)) {
    console.log(`El bucket «${BUCKET.id}» ya existe. No toco nada.`)
    return
  }

  const r = await fetch(`${API}/storage/v1/bucket`, {
    method: "POST", headers: cab, body: JSON.stringify(BUCKET),
  })
  const j = await r.json()
  if (!r.ok) {
    console.error("No se pudo crear:", JSON.stringify(j))
    process.exit(1)
  }

  console.log(`Bucket «${BUCKET.id}» creado.`)
  console.log("  privado · hasta 20 MB por archivo · PDF e imágenes")
  console.log("")
  console.log("Los permisos ya están puestos por la migración 009: se puede ver")
  console.log("y subir, pero NO borrar ni modificar. Un informe incorporado se")
  console.log("conserva tal como fue emitido (RNF-28).")
}

main().catch((e) => {
  console.error("Falló:", e.message)
  console.error("¿Está levantada la pila? Probá: docker compose ps")
  process.exit(1)
})
