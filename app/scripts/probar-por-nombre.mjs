/* ¿Anda entrando por NOMBRE, sin IP fija?

   Se le dice a Chrome que «servidor-cml» es 127.0.0.1 —con
   --host-resolver-rules, sin tocar el archivo hosts— y se abre la app
   por ese nombre. Si la aplicación resuelve la API desde el origen,
   todas las llamadas tienen que ir a http://servidor-cml y ninguna a
   localhost ni a una IP.

   Es la prueba de que un cambio de IP no rompe nada mientras el nombre
   resuelva. */
import fs from "node:fs"
import puppeteer from "puppeteer-core"

/* El CI corre en Linux y acá es Windows: se busca en los dos lados. */
const CHROMES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
]
const CHROME = CHROMES.find((c) => fs.existsSync(c))
const NOMBRE = "servidor-cml"
const SITIO = process.env.CMLNOA_SITIO || "http://localhost"

if (!CHROME) {
  console.log("")
  console.log("  (sin Chrome ni Edge: no se pudo probar la entrada por nombre)")
  process.exit(0)
}

/* A dónde apunta «servidor-cml» para esta prueba: al sitio que se esté
   sirviendo. Así corre igual en tu máquina y en el CI. */
const DESTINO = new URL(SITIO).hostname

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-gpu",
    `--host-resolver-rules=MAP ${NOMBRE} ${DESTINO}`,
  ],
})

const page = await browser.newPage()

/* Se anota a dónde va cada pedido: es lo único que prueba de verdad si
   la dirección quedó grabada en el bundle o se toma del origen. */
const destinos = new Set()
page.on("request", (r) => {
  try { destinos.add(new URL(r.url()).host) } catch { /* data: y similares */ }
})

const errores = []
page.on("pageerror", (e) => errores.push(e.message))
page.on("requestfailed", (r) => errores.push(`${r.url()} · ${r.failure()?.errorText}`))

console.log("")
console.log(`Entrando por nombre: ${SITIO.replace(new URL(SITIO).hostname, NOMBRE)}/`)

await page.goto(`${SITIO.replace(new URL(SITIO).hostname, NOMBRE)}/`, { waitUntil: "networkidle2" })
await new Promise((r) => setTimeout(r, 2500))

const hayLogin = await page.$('input[placeholder="Usuario"]')
console.log(`  ${hayLogin ? "✔" : "✘"} la pantalla de login carga`)

/* Se dispara una llamada real a la API para ver a dónde sale. */
await page.evaluate(() => {
  const b = document.querySelector('button[type="submit"]')
  const u = document.querySelector('input[placeholder="Usuario"]')
  const p = document.querySelector('input[type="password"]')
  if (u && p && b) {
    u.value = "x"; u.dispatchEvent(new Event("input", { bubbles: true }))
    p.value = "x"; p.dispatchEvent(new Event("input", { bubbles: true }))
    b.click()
  }
})
await new Promise((r) => setTimeout(r, 2500))

console.log("")
console.log("  A dónde salieron los pedidos:")
for (const d of [...destinos].sort()) console.log(`    · ${d}`)

const soloNombre = [...destinos].every((d) => d.split(":")[0] === NOMBRE || d === "")
console.log("")
console.log(`  ${soloNombre ? "✔" : "✘"} todos los pedidos fueron a «${NOMBRE}»`)
if (!soloNombre) {
  console.log("     Alguno salió a otra dirección: quedó grabada en el bundle.")
}

const tocoLaApi = [...destinos].some((d) => d.split(":")[0] === NOMBRE)
console.log(`  ${tocoLaApi ? "✔" : "✘"} la API se buscó en el mismo nombre`)

await browser.close()
process.exitCode = soloNombre && hayLogin ? 0 : 1
