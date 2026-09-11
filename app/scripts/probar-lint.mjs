/* =====================================================================
   Variables que no existen.

   Esta batería nació de un error concreto, y conviene dejar escrito cuál
   porque la clase de error se repite.

   Un parche automático movió dos constantes ADENTRO de un useEffect. El
   JSX las seguía usando desde afuera, así que la pantalla tiraba
   ReferenceError y quedaba en blanco. Y sin embargo:

     · `vite build` daba verde — el bundler no resuelve identificadores;
     · las otras baterías daban verde — leen el texto del archivo, y el
       texto estaba ahí, sólo que en el lugar equivocado;
     · la pantalla estaba rota.

   Es la segunda pantalla en blanco en dos días que pasa todos los
   controles. Un identificador que no existe en su alcance es lo único
   que ninguna prueba de texto puede ver, y es exactamente lo que sí ve
   un linter.

   La configuración vive en app/.oxlintrc.json: `no-undef` en error y el
   entorno del navegador declarado, para que `window` y `setTimeout` no
   cuenten como indefinidos.

       node scripts/probar-lint.mjs      (desde app/)
   ===================================================================== */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

console.log("")
console.log("Variables sin definir · el linter sobre todo el código")

/* El comando va como UNA cadena y no como binario + lista de argumentos.
   En Windows el ejecutable es un .cmd y necesita shell para arrancar
   —sin shell, spawnSync devuelve status null y la batería fallaba sin
   haber corrido—. Y pasando argumentos sueltos con shell, Node tira un
   aviso de deprecación que ensucia la salida. Una cadena resuelve las
   dos cosas. */
const r = spawnSync("npx oxlint src", { cwd: APP, encoding: "utf8", shell: true })

const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`
const errores = salida
  .split(/\r?\n/)
  .filter((l) => l.includes("error eslint(no-undef)"))

if (errores.length) {
  console.log("")
  for (const e of errores) console.log(`  ✘ ${e.trim()}`)
  console.log("")
  console.log(`  ${errores.length} referencia${errores.length === 1 ? "" : "s"} a algo que no existe.`)
  console.log("  Eso es una pantalla en blanco en cuanto alguien la abra.")
  process.exitCode = 1
} else if (r.status !== 0) {
  /* Falló por otra cosa —una regla distinta, o el linter no corrió—. No
     se traga el error: un linter que no corre da verde igual, y ese es
     justo el modo de fallar que esta batería vino a tapar. */
  console.log("")
  console.log(salida.trim().split(/\r?\n/).slice(-12).join("\n"))
  console.log("")
  console.log(`  El linter terminó con código ${r.status}.`)
  process.exitCode = 1
} else {
  /* Los avisos se muestran pero no frenan: importaciones sin usar y
     escapes de más no rompen ninguna pantalla. */
  const avisos = salida.split(/\r?\n/).filter((l) => l.includes("warning ")).length
  console.log("")
  console.log("  ✔ Ninguna referencia a algo que no existe.")
  if (avisos) console.log(`  (${avisos} avisos menores, que no rompen nada)`)
}
