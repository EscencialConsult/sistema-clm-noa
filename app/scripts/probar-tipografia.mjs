/* =====================================================================
   ¿La letra sale del servidor, o se la sigue pidiendo a Google?

   INSTALAR.md promete que, una vez bajadas las imágenes, el sistema
   anda sin internet. La app cargaba Inter desde fonts.googleapis.com, y
   eso rompía la promesa de dos maneras: en la clínica sin salida a
   internet la pantalla salía con otra letra —distinta de la que vieron
   en la demostración— y cada carga se quedaba esperando a que el pedido
   fallara.

   Mirar el HTML no alcanza para darlo por resuelto: el archivo puede
   estar puesto y no servirse, o servirse y no aplicarse. Así que además
   de revisar que no quede ninguna referencia a Google, esta prueba abre
   el navegador CON INTERNET BLOQUEADO hacia Google y comprueba que la
   letra igual sea Inter.

   Y comprueba una cosa más, que es la que se puede romper sin que se
   note: Inter viene como fuente VARIABLE, un archivo por subconjunto
   que cubre los cuatro grosores moviendo el eje «wght». Si el @font-face
   declarara un grosor fijo, los títulos en negrita saldrían del mismo
   ancho que el texto común y nadie lo miraría dos veces. Por eso se mide
   que 400 y 700 den anchos distintos.

       node scripts/probar-tipografia.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import puppeteer from "puppeteer-core"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")
const SITIO = process.env.CMLNOA_SITIO || "http://localhost"

const CHROMES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  /* El CI corre en Linux. */
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
]

let fallas = 0
const bien = (t) => console.log(`  ok    ${t}`)
const mal = (t, d) => { fallas++; console.log(`  FALLA ${t}`); if (d) console.log(`        ${d}`) }

console.log("")
console.log("La tipografía sale del servidor")
console.log("")

/* ---------- 1 · El HTML no le pide nada a Google ---------- */
const html = fs.readFileSync(path.join(APP, "index.html"), "utf8")
const aGoogle = html.match(/fonts\.(googleapis|gstatic)\.com/g) ?? []
if (aGoogle.length === 0) bien("index.html no nombra a Google Fonts")
else mal("index.html todavía le pide la letra a Google", aGoogle.join(", "))

/* ---------- 2 · Los archivos están ---------- */
for (const f of ["inter-latin.woff2", "inter-latin-ext.woff2"]) {
  const ruta = path.join(APP, "public", "fuentes", f)
  if (!fs.existsSync(ruta)) { mal(`falta public/fuentes/${f}`); continue }
  const kb = Math.round(fs.statSync(ruta).size / 1024)
  /* Un woff2 de Inter pesa decenas de KB. Si bajó un cartel de error de
     Google en vez del archivo, pesa dos renglones. */
  const firma = fs.readFileSync(ruta).slice(0, 4).toString("latin1")
  if (firma !== "wOF2") mal(`${f} no es un woff2`, `empieza con «${firma}»`)
  else if (kb < 20) mal(`${f} pesa muy poco`, `${kb} KB: parece cortado`)
  else bien(`${f} · ${kb} KB`)
}

/* ---------- 3 · Con Google bloqueado, la letra sigue siendo Inter ---------- */
const navegador = CHROMES.find((c) => fs.existsSync(c))
if (!navegador) {
  console.log("")
  console.log("  (sin Chrome ni Edge: no se pudo probar en el navegador)")
} else {
  const browser = await puppeteer.launch({
    executablePath: navegador,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-gpu",
      /* Google queda apuntando a la nada: es la clínica sin internet. */
      "--host-resolver-rules=MAP fonts.googleapis.com 0.0.0.0,MAP fonts.gstatic.com 0.0.0.0",
    ],
  })
  try {
    const page = await browser.newPage()
    const salidas = new Set()
    page.on("request", (r) => {
      try { salidas.add(new URL(r.url()).host) } catch { /* data: */ }
    })

    await page.goto(SITIO, { waitUntil: "networkidle2" })
    await new Promise((r) => setTimeout(r, 1500))

    const aGoogleEnVivo = [...salidas].filter((h) => /fonts\.(googleapis|gstatic)/.test(h))
    if (aGoogleEnVivo.length === 0) bien("no salió ningún pedido a Google")
    else mal("todavía sale un pedido a Google", aGoogleEnVivo.join(", "))

    const medida = await page.evaluate(async () => {
      await document.fonts.ready
      const cargada = document.fonts.check("700 16px Inter")
      /* Se mide el mismo texto en 400 y en 700 con la misma caja. Si la
         fuente variable anda, el ancho cambia. */
      const ancho = (peso) => {
        const d = document.createElement("span")
        d.textContent = "Aptitud — Hemograma ñÁÉÍ 0123456789"
        d.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:Inter,serif;font-size:16px`
        d.style.fontWeight = String(peso)
        /* Sin negrita fingida: si el @font-face declarara un grosor fijo,
           el navegador podría engordar la letra a mano y el ancho
           cambiaría igual, dando la prueba por buena con la fuente mal
           declarada. */
        d.style.setProperty("font-synthesis-weight", "none")
        document.body.appendChild(d)
        const w = d.getBoundingClientRect().width
        d.remove()
        return w
      }
      const usada = getComputedStyle(document.body).fontFamily
      return { cargada, w400: ancho(400), w700: ancho(700), usada }
    })

    if (medida.cargada) bien("el navegador dice que Inter está cargada")
    else mal("Inter no quedó cargada", "cayó en la letra de reserva")

    const dif = Math.abs(medida.w700 - medida.w400)
    if (dif > 1) bien(`los grosores se distinguen · 400=${medida.w400.toFixed(1)}px  700=${medida.w700.toFixed(1)}px`)
    else mal("todos los grosores salen iguales",
      `400=${medida.w400.toFixed(1)}px y 700=${medida.w700.toFixed(1)}px: el @font-face no declara el rango 100 900`)

    if (/Inter/i.test(medida.usada)) bien(`la pantalla usa «${medida.usada.split(",")[0].trim()}»`)
    else mal("la pantalla no está usando Inter", medida.usada)
  } finally {
    await browser.close()
  }
}

console.log("")
console.log(fallas === 0 ? "  Todo en orden." : `  ${fallas} en rojo.`)
process.exitCode = fallas === 0 ? 0 : 1
