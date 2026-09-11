/* =====================================================================
   Saca una captura de cada pantalla para el manual, con sesión iniciada
   y con la pantalla EN USO.

   Dos decisiones que importan:

   · Rol de RECEPCIÓN, no de administrador. El manual es para la
     secretaria, así que el menú lateral tiene que ser el suyo. Con rol
     de admin salían Usuarios, Profesionales y Auditoría, que ella no ve.

   · Con datos cargados. Una captura del formulario vacío muestra dónde
     está cada cosa pero no cómo se ve trabajando: «Total de estudios 0»
     y «Falta la persona» no le enseñan nada a nadie. Así que el script
     escribe, busca y elige antes de disparar la foto.

   Sacarlas a mano tiene dos problemas que esto evita: quedan viejas al
   primer rediseño, y salen con el navegador y la barra de tareas.

   Usa el Chrome que ya está instalado —no descarga otro— y entra con una
   cuenta que se crea y se borra acá mismo.

       node scripts/capturar-pantallas.mjs      (desde app/)

   Las deja en docs/capturas/.
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import puppeteer from "puppeteer-core"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")
const RAIZ = path.resolve(APP, "..")
const SALIDA = path.join(RAIZ, "docs", "capturas")

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const SITIO = process.env.CMLNOA_SITIO || "http://localhost"
const MARCA = "ZZCAPT"

const CHROMES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
]
const navegador = CHROMES.find((c) => fs.existsSync(c))
if (!navegador) {
  console.log("  No encontré Chrome ni Edge instalados.")
  process.exit(1)
}

const psql = (sql) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: sql }
).trim()

const admin = async (ruta, opts) => {
  const r = await fetch(`http://localhost:8000${ruta}`, {
    ...opts,
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  return r.json()
}

function limpiarUsuario() {
  psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
}

/* Rol R2: el manual es de Recepción y el menú tiene que ser el suyo. */
async function crearUsuario() {
  limpiarUsuario()
  const email = `${MARCA.toLowerCase()}@cmlnoa.local`
  const pass = "Captura-" + Math.random().toString(36).slice(2, 10)
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) { console.log("  No se pudo crear la cuenta de captura."); process.exit(1) }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
        VALUES ('${MARCA}', 'Recepción', '${creado.id}', false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, 'R2' FROM usuario WHERE auth_id='${creado.id}';`)
  return { usuario: MARCA, pass, authId: creado.id }
}

/* Datos reales para poner las pantallas en uso. Se leen de la base en vez
   de escribirlos acá: si mañana cambian, la captura sigue saliendo. */
const DNI = psql(`
  SELECT p.nro_doc FROM persona p JOIN orden o ON o.persona_id = p.id
   GROUP BY p.id, p.nro_doc ORDER BY count(o.id) DESC, p.id LIMIT 1;`)
const EMPRESA = psql(`SELECT razon_social FROM empresa WHERE activo ORDER BY razon_social LIMIT 1;`)
const ORDEN_CARGA = psql(`SELECT id FROM orden WHERE estado = 'EN_CURSO' ORDER BY numero LIMIT 1;`)
const ORDEN_APTITUD = psql(`SELECT id FROM orden WHERE estado = 'COMPLETA' ORDER BY numero LIMIT 1;`)

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

console.log("")
console.log("Capturas para el manual · rol Recepción, pantallas en uso")
console.log(`  sitio: ${SITIO}   ·   navegador: ${path.basename(navegador)}`)
console.log(`  datos: DNI ${DNI} · ${EMPRESA}`)

fs.mkdirSync(SALIDA, { recursive: true })
const u = await crearUsuario()

const browser = await puppeteer.launch({
  executablePath: navegador,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
})

let hechas = 0
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  const foto = async (nombre) => {
    const archivo = path.join(SALIDA, `${nombre}.png`)
    await page.screenshot({ path: archivo })
    hechas++
    console.log(`  ✔ ${nombre.padEnd(22)} ${String(Math.round(fs.statSync(archivo).size / 1024)).padStart(4)} KB`)
  }
  const ir = async (ruta, ms = 1800) => {
    await page.goto(`${SITIO}${ruta}`, { waitUntil: "networkidle2" })
    await esperar(ms)
  }

  /* Login por la pantalla real: así la sesión queda donde la app la
     busca, sin depender de cómo la guarde por dentro. El campo de
     usuario no declara `type`, así que se ubica por el marcador; y pide
     el USUARIO, no el correo — el servicio le agrega el dominio. */
  await ir("/", 800)
  await page.type('input[placeholder="Usuario"]', u.usuario, { delay: 10 })
  await page.type('input[type="password"]', u.pass, { delay: 10 })
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  ])
  await esperar(1500)

  /* ---------- 1 · Bandeja del Día ---------- */
  await ir("/bandeja")
  await foto("01-bandeja")

  /* ---------- 2 · Nueva Orden, con la orden armada ---------- */
  await ir("/recepcion/nueva-orden")
  await page.type('input[placeholder="Número de documento"]', DNI, { delay: 15 })
  await page.keyboard.press("Enter")
  await esperar(1800)

  await page.type('input[placeholder="Escribí el nombre…"]', EMPRESA.slice(0, 6), { delay: 25 })
  await esperar(700)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await esperar(600)

  /* La batería es un desplegable común: se elige por su texto. */
  await page.select("select:nth-of-type(1)", "1").catch(() => {})
  const selects = await page.$$("select")
  for (const s of selects) {
    const tiene = await s.evaluate((el) =>
      [...el.options].some((o) => /BASICO DE LEY/i.test(o.textContent))
    )
    if (tiene) {
      const valor = await s.evaluate((el) =>
        [...el.options].find((o) => /BASICO DE LEY/i.test(o.textContent))?.value
      )
      await s.select(valor)
      break
    }
  }
  await esperar(1800)
  await foto("02-nueva-orden")

  /* ---------- 3 · Pendientes del Día ---------- */
  await ir("/recepcion/pendientes")
  await foto("03-pendientes")

  /* ---------- 4 · Cargar resultados, con una categoría abierta ---------- */
  if (ORDEN_CARGA) {
    await ir(`/carga/${ORDEN_CARGA}`, 2200)
    /* Se abre una categoría a medio cargar: con una completa el botón
       de «Cargar toda» sale gris y la captura no muestra el atajo. */
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => /HEMOGRAMA/.test(x.textContent) && new RegExp("/14").test(x.textContent))
      if (b) b.click()
    })
    await esperar(1500)
    await foto("04-cargar")
  }

  /* ---------- 5 · La aptitud ---------- */
  if (ORDEN_APTITUD) {
    await ir(`/aptitud/${ORDEN_APTITUD}`, 2200)
    await foto("05-aptitud")
  }

  /* ---------- 6 · Buscar Persona, con alguien abierto ---------- */
  await ir("/recepcion/personas")
  await page.type('input[placeholder="Documento o apellido"]', DNI, { delay: 15 })
  await page.keyboard.press("Enter")
  await esperar(1500)
  /* Se abre el primer resultado para que se vea el legajo, que es lo
     que la pantalla viene a mostrar. */
  await page.evaluate(() => {
    const b = document.querySelectorAll("ul button")
    if (b.length) b[0].click()
  })
  await esperar(1600)
  await foto("06-buscar-persona")

  /* ---------- 7 · Listado de Órdenes ---------- */
  await ir("/recepcion/listado", 2200)
  await foto("07-listado")

  /* ---------- 8 · Empresas ---------- */
  await ir("/recepcion/empresas")
  await foto("08-empresas")

  /* ---------- 9 · Estudios y Categorías ---------- */
  await ir("/recepcion/catalogo", 2200)
  await foto("09-estudios")

  /* ---------- 10 · Baterías ---------- */
  await ir("/recepcion/baterias", 2200)
  await foto("10-baterias")
} finally {
  await browser.close()
  limpiarUsuario()
  await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })
}

console.log("")
console.log(`  ${hechas} capturas en docs/capturas/`)
