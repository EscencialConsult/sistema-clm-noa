/* =====================================================================
   Filtrar el listado por estado y por aptitud.

   Las dos columnas se mostraban desde siempre, pero no se podían pedir:
   para «los no aptos de agosto» había que bajar el CSV entero y
   filtrarlo en Excel, que es justo lo que el sistema vino a reemplazar.

   Lo que más importa acá no es que el filtro filtre: es que el TOTAL en
   pesos, el CSV y el contador miren LO FILTRADO. Si la pantalla dice
   «3 órdenes · $165.000» y el archivo que se baja trae 40, el número
   que se le factura a la empresa sale mal — y sale mal en silencio.

   Por eso la mitad de las comprobaciones lee el código: son cuatro
   lugares que tienen que derivar de la misma lista, y basta que uno
   quede apuntando a `ordenes` para que el listado y el archivo digan
   cosas distintas sin ningún error a la vista.

       node scripts/probar-filtros-listado.mjs      (desde app/)
   ===================================================================== */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(AQUI, "..")
const RAIZ = path.resolve(APP, "..")

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
)

const API = "http://localhost:8000"
const MARCA = "ZZFILTRO"

let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }
const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

const psql = (sql) => execFileSync(
  "docker",
  ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { cwd: RAIZ, encoding: "utf8", input: sql }
).trim()

const admin = async (ruta, opts) => {
  const r = await fetch(`${API}${ruta}`, {
    ...opts,
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  return r.json()
}

console.log("")
console.log("Filtrar el listado por estado y por aptitud")

/* ------------------------------------------------------------------
   Parte 1 · Los cuatro lugares que tienen que mirar lo mismo
   ------------------------------------------------------------------ */

paso("1 · el filtro existe y ofrece los valores reales")
{
  const t = leer("features/recepcion/ListadoOrdenesPage.jsx")
  ok(t.includes("const [estado, setEstado]"), "hay filtro de estado")
  ok(t.includes("const [aptitud, setAptitud]"), "hay filtro de aptitud")
  /* Las opciones salen de dominio.ts y no de una lista escrita a mano:
     si mañana se agrega un estado, aparece solo. Una lista copiada se
     desactualiza sin que nada falle. */
  ok(t.includes("ESTADO_ORDEN.map"), "los estados salen de dominio, no copiados")
  ok(t.includes("APTITUD.map"), "las aptitudes salen de dominio, no copiadas")
}

paso("2 · el total, el CSV y los contadores miran LO FILTRADO")
{
  const t = leer("features/recepcion/ListadoOrdenesPage.jsx")

  /* Se compara la expresión exacta, no «que aparezca la palabra cerca».
     El primer intento buscaba `filtradas` en una ventana de caracteres
     alrededor, y daba verde con el total sumando `ordenes`: el array de
     dependencias del useMemo dice `[filtradas]` igual, y eso alcanzaba
     para engañarlo. Se descubrió rompiéndolo a propósito — de las dos
     roturas sólo detectó una, y la que no detectó era la de la plata. */
  const usa = (bueno, malo, que) => {
    ok(t.includes(bueno), `${que} sale de lo filtrado`, bueno.trim())
    ok(!t.includes(malo), `${que}: ya no suma todas`, malo.trim())
  }
  usa("filtradas.reduce((s, o) => s + Number(o.importe", "ordenes.reduce((s, o) => s + Number(o.importe", "el total en pesos")
  usa("const filas = filtradas.map(", "const filas = ordenes.map(", "las filas del CSV")
  usa("paginar(filtradas, pagina)", "paginar(ordenes, pagina)", "la paginación")
  usa("cuantos={filtradas.length}", "cuantos={ordenes.length}", "el contador del paginador")
}

paso("3 · filtrar a cero explica por qué")
{
  const t = leer("features/recepcion/ListadoOrdenesPage.jsx")
  ok(t.includes("!cargando && filtradas.length === 0"),
    "el aviso de vacío mira lo filtrado, no el período")
  /* Lo que importa es que el mensaje DISTINGA los dos casos, no cómo
     esté redactado: se rompió por cambiar «filtro» por «búsqueda». */
  ok(t.includes("ordenes.length === 0") && t.includes("del período coincide"),
    "y distingue «no hay en el período» de «quedó todo afuera»")
}

paso("4 · el archivo bajado dice qué filtro tenía")
{
  const t = leer("features/recepcion/ListadoOrdenesPage.jsx")
  ok(t.includes("const sufijo = ["), "el nombre del CSV lleva el filtro")
}

/* ------------------------------------------------------------------
   Parte 2 · Contra la base, con sesión de Recepción.

   El riesgo real: si la vista que alimenta el listado no expusiera
   `estado` o `aptitud`, el filtro compararía contra undefined y dejaría
   la tabla vacía siempre, sin un solo error.
   ------------------------------------------------------------------ */

async function crearUsuario(nombre, rol) {
  psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
        DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
  const email = `${MARCA.toLowerCase()}_${nombre}@cmlnoa.local`
  const pass = "Prueba-" + Math.random().toString(36).slice(2, 10)
  const todas = await admin("/auth/v1/admin/users")
  for (const u of todas?.users ?? []) {
    if (u.email === email) await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" })
  }
  const creado = await admin("/auth/v1/admin/users", {
    method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }),
  })
  if (!creado.id) { console.log(`  No se pudo crear ${email}`); process.exit(1) }
  psql(`INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
        VALUES ('${MARCA}_${nombre}', 'Prueba', '${creado.id}', false);
        INSERT INTO usuario_rol (usuario_id, rol_codigo)
        SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`)
  return { email, pass, authId: creado.id }
}

const u = await crearUsuario("recepcion", "R2")
const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({ email: u.email, password: u.pass })
if (eLogin) { console.log(`  No se pudo entrar: ${eLogin.message}`); process.exit(1) }

paso("5 · la vista del listado trae con qué filtrar")
const { data: filas, error: eLis } = await c.from("v_orden_avance").select("*")
ok(!eLis, "Recepción puede leer el listado", eLis?.message ?? `${filas?.length ?? 0} filas`)

if (filas?.length) {
  const una = filas[0]
  ok("estado" in una, "la vista expone `estado`")
  ok("aptitud" in una, "la vista expone `aptitud`")
  ok("importe" in una, "y el importe, que es lo que se suma")

  /* Los valores tienen que ser los del dominio. Si la vista devolviera
     "Informada" y el desplegable mandara "INFORMADA", el filtro no
     encontraría nada y nadie sabría por qué. */
  const ESTADOS = ["ABIERTA", "EN_CURSO", "COMPLETA", "INFORMADA"]
  const APTITUDES = ["PENDIENTE", "APTO", "NO_APTO"]
  const raros = filas.filter((f) => !ESTADOS.includes(f.estado))
  const rarasApt = filas.filter((f) => !APTITUDES.includes(f.aptitud))
  ok(raros.length === 0, "los estados vienen en el formato del desplegable",
    raros.length ? String(raros[0].estado) : ESTADOS.join("/"))
  ok(rarasApt.length === 0, "las aptitudes también",
    rarasApt.length ? String(rarasApt[0].aptitud) : APTITUDES.join("/"))

  paso("6 · el total filtrado no puede dar más que el total entero")
  const suma = (xs) => xs.reduce((s, o) => s + Number(o.importe ?? 0), 0)
  for (const ap of APTITUDES) {
    const parcial = filas.filter((f) => f.aptitud === ap)
    ok(suma(parcial) <= suma(filas),
      `«${ap}»: ${parcial.length} de ${filas.length}`,
      `$${suma(parcial).toLocaleString("es-AR")}`)
  }
  const porSeparado = APTITUDES.reduce((s, ap) => s + suma(filas.filter((f) => f.aptitud === ap)), 0)
  ok(Math.abs(porSeparado - suma(filas)) < 0.01,
    "y las tres partes suman el total entero",
    `$${porSeparado.toLocaleString("es-AR")}`)
} else {
  console.log("  (sin órdenes en la base: no se puede comprobar la parte de datos)")
}

psql(`DELETE FROM auditoria   WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
      DELETE FROM usuario_rol WHERE usuario_id IN (SELECT id FROM usuario WHERE usuario ILIKE '${MARCA}%');
      DELETE FROM usuario     WHERE usuario ILIKE '${MARCA}%';`)
await admin(`/auth/v1/admin/users/${u.authId}`, { method: "DELETE" })

console.log("")
console.log(fallas === 0
  ? "  Todo en verde: se filtra, y el total y el CSV dicen lo mismo que la tabla."
  : `  ${fallas} en rojo.`)
process.exitCode = fallas ? 1 : 0
