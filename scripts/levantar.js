/* =====================================================================
   Levanta el sistema. Pensado para correr solo, al encender el servidor.

   Por qué hace falta:

   Los seis servicios tienen "restart: unless-stopped", así que vuelven
   solos... siempre que Docker esté corriendo. Y en Windows, Docker
   Desktop NO arranca sin una sesión iniciada: necesita que alguien haya
   entrado a Windows.

   Entonces, en la clínica: se corta la luz, la máquina reinicia, Windows
   queda en la pantalla de inicio, Docker nunca arranca, y el sistema no
   existe. Sin ningún error: simplemente no está. Y nadie se entera
   hasta que una recepcionista intenta abrir una orden.

   Este script se programa al inicio de sesión: espera a que Docker
   responda —puede tardar un minuto largo después de un arranque— y
   levanta todo. Deja constancia en un archivo, porque un arranque
   automático que nadie mira es lo mismo que no tenerlo.

       node scripts/levantar.js
   ===================================================================== */
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const RAIZ = path.resolve(__dirname, "..")
const BITACORA = path.join(RAIZ, "arranque.log")
const ESPERA_MAX_MIN = 10

function anotar(linea) {
  const t = new Date().toLocaleString("es-AR")
  const texto = `${t}  ${linea}`
  console.log(texto)
  try {
    fs.appendFileSync(BITACORA, texto + "\n")
  } catch { /* si no se puede escribir, al menos salió por pantalla */ }
}

function correr(cmd, args, opciones = {}) {
  return spawnSync(cmd, args, { cwd: RAIZ, encoding: "utf8", ...opciones })
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  anotar("─── arranque ───")

  /* 1 · esperar a Docker. Después de encender, Docker Desktop tarda:
         no alcanza con intentarlo una vez y rendirse. */
  const limite = Date.now() + ESPERA_MAX_MIN * 60_000
  let intentos = 0
  while (correr("docker", ["info"]).status !== 0) {
    intentos++
    if (Date.now() > limite) {
      anotar(`ERROR · Docker no respondió en ${ESPERA_MAX_MIN} minutos. El sistema NO está levantado.`)
      anotar("        Revisá que Docker Desktop esté configurado para arrancar con la sesión.")
      process.exit(1)
    }
    if (intentos === 1) anotar("esperando a que Docker arranque...")
    await dormir(5000)
  }
  anotar(`Docker responde${intentos ? ` (tardó ~${intentos * 5}s)` : ""}`)

  /* 2 · levantar */
  const up = correr("docker", ["compose", "up", "-d"])
  if (up.status !== 0) {
    anotar("ERROR · no se pudieron levantar los servicios:")
    anotar("        " + (up.stderr || "").trim().split("\n").slice(-3).join(" | "))
    process.exit(1)
  }

  /* 3 · comprobar que de verdad está en pie, no sólo que el comando
         no dio error. Un contenedor puede estar "running" y la
         aplicación no contestar. */
  const puerto = (fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .match(/^APP_PUERTO_PUBLICO=(.+)$/m) || [, "80"])[1].trim()

  let responde = false
  for (let i = 0; i < 24 && !responde; i++) {
    const r = correr("docker", ["compose", "ps", "--format", "{{.Service}}|{{.State}}"])
    const estados = (r.stdout || "").trim().split("\n").filter(Boolean)
    const caidos = estados.filter((l) => !l.endsWith("|running"))
    if (estados.length >= 6 && caidos.length === 0) responde = true
    else await dormir(5000)
  }

  if (!responde) {
    const r = correr("docker", ["compose", "ps", "--format", "{{.Service}}|{{.State}}"])
    anotar("ERROR · algún servicio no quedó en pie:")
    anotar("        " + (r.stdout || "").trim().replace(/\n/g, "  "))
    process.exit(1)
  }

  anotar(`Sistema levantado · http://localhost${puerto === "80" ? "" : ":" + puerto}`)
  process.exit(0)
}

main().catch((e) => {
  anotar("ERROR inesperado · " + (e && e.message))
  process.exit(1)
})
