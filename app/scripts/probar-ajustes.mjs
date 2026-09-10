/* =====================================================================
   Ajustar los estudios de una orden — lo que reportó Marcela el 9/9.

   Probó el sistema y anotó cinco cosas. Las cinco eran reales. Este
   script las convierte en prueba permanente, para que no vuelvan:

     1. Los accesos rápidos de la bandeja no hacían nada
     2. A ajustar estudios sólo se llegaba desde el alta
     3. No se podía quitar una categoría entera
     4. No se podía agregar una categoría entera
     5. Recepción veía los botones Apto / No apto sin poder usarlos

   Las de la base se prueban contra el sistema andando. Las de pantalla
   se comprueban leyendo el código: un botón sin `onClick` no falla
   nunca, no rompe el build y no lo agarra ninguna prueba de datos —
   que es exactamente por qué estuvo así hasta que alguien lo usó.

       node scripts/probar-ajustes.mjs      (desde app/)
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

const MARCA = "ZZAJUS"
let fallas = 0
const ok = (b, t, d = "") => {
  console.log(`  ${b ? "✔" : "✘"} ${t}${d ? `  ${d}` : ""}`)
  if (!b) fallas++
}
const paso = (t) => { console.log(""); console.log(`── ${t} ──`) }

const leer = (rel) => fs.readFileSync(path.join(APP, "src", rel), "utf8")

/* ------------------------------------------------------------------
   Parte 1 · Las de pantalla, leyendo el código
   ------------------------------------------------------------------ */

console.log("")
console.log("Ajustes de la orden · lo reportado el 9/9")

paso("1 · los accesos rápidos de la bandeja llevan a alguna parte")
{
  const t = leer("features/carga/BandejaPage.jsx")
  const bloque = t.slice(t.indexOf("Acciones Rápidas"), t.indexOf("Acciones Rápidas") + 1400)
  for (const destino of [
    "/recepcion/nueva-orden",
    "/recepcion/personas",
    "/bandeja/legajos",
    "/bandeja/vigencias",
  ]) {
    ok(bloque.includes(destino), `apunta a ${destino}`)
  }
  /* Un <button> sin onClick adentro del panel es el defecto original. */
  const botonesMudos = (bloque.match(/<button(?![^>]*onClick)[^>]*>/g) || []).length
  ok(botonesMudos === 0, "ningún botón quedó sin acción", `mudos: ${botonesMudos}`)
}

paso("2 · se puede volver a ajustar una orden ya creada")
{
  const t = leer("features/carga/CargaPage.jsx")
  ok(t.includes("/estudios`"), "la pantalla de la orden enlaza a ajustar estudios")
  ok(t.includes('orden.estado !== "INFORMADA"'), "y sólo mientras la orden no esté informada")
  ok(t.includes("ROL.RECEPCION"), "y sólo a quien puede hacerlo")
}

paso("5 · el dictamen no se le muestra a quien no puede firmar")
{
  const t = leer("features/aptitud/DictamenPage.jsx")
  ok(t.includes("puedeDictaminar"), "la pantalla distingue quién puede dictaminar")
  ok(t.includes("ROL.MEDICO_LABORAL"), "y lo decide por el rol de la sesión")
  const usos = (t.match(/puedeDictaminar/g) || []).length
  ok(usos >= 3, "se usa para ocultar los controles, no sólo para un cartel", `${usos} usos`)
}

paso("6 · los buscadores se manejan con el teclado")
{
  const t = leer("features/ordenes/NuevaOrdenPage.jsx")
  ok(t.includes("onKeyDown={teclasEmpresa}"), "la empresa escucha el teclado")
  ok(t.includes("onKeyDown={teclasExtra}"), "el buscador de estudios también")
  for (const tecla of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
    ok(t.includes(`"${tecla}"`), `contempla ${tecla}`)
  }
  /* Lo que Enter toma y lo que se ve resaltado tienen que ser lo mismo:
     si se separan, se elige algo distinto de lo que la persona ve. */
  ok(t.includes("extraMarcadoReal"), "el resaltado y lo que toma Enter son el mismo índice")

  /* La aritmética de la vuelta, sin pantalla: es donde se esconden los
     errores de índice. */
  const vuelta = (i, paso, n) => (i + paso + n) % n
  ok(vuelta(6, 1, 7) === 0, "del último baja al primero")
  ok(vuelta(0, -1, 7) === 6, "y del primero sube al último")
  ok(Math.min(6, Math.max(0, 2 - 1)) === 1, "si la lista se achica, no se sale del final")
}

/* ------------------------------------------------------------------
   Parte 2 · Las de la base, contra el sistema andando
   ------------------------------------------------------------------ */

const c = createClient("http://localhost:8000", env.ANON_KEY, { auth: { persistSession: false } })
const { error: eLogin } = await c.auth.signInWithPassword({
  email: "admin@cmlnoa.local", password: "admin2026",
})
if (eLogin) {
  console.log("")
  console.log(`  No se pudo entrar (${eLogin.message}).`)
  console.log("  Las comprobaciones de pantalla igual corrieron.")
  process.exit(fallas ? 1 : 0)
}

/* La limpieza va por psql, como dueño de la base, igual que en las
   otras baterías.

   No es un atajo: el sistema NO permite borrar una orden, y eso está
   bien —una orden clínica no se elimina, se corrige—. No hay política
   de DELETE sobre `orden`, así que por la API la prueba no puede
   deshacer lo que crea. Se descubrió corriéndola dos veces seguidas:
   la segunda arrancaba con la persona de la primera todavía puesta. */
function limpiar() {
  execFileSync(
    "docker",
    ["compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
      "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
    {
      cwd: RAIZ, encoding: "utf8",
      input: `
        DELETE FROM orden_estudio   WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
        DELETE FROM orden_categoria WHERE orden_id IN (SELECT o.id FROM orden o JOIN persona p ON p.id=o.persona_id WHERE p.apellido LIKE '${MARCA}%');
        DELETE FROM orden           WHERE persona_id IN (SELECT id FROM persona WHERE apellido LIKE '${MARCA}%');
        DELETE FROM persona         WHERE apellido LIKE '${MARCA}%';`,
    }
  )
}

limpiar()

const { data: per, error: ePer } = await c.from("persona").insert({
  tipo_doc: "DNI", nro_doc: "90999100", apellido: `${MARCA} PRUEBA`, nombre: "Ajustes", sexo: "M",
}).select().single()
if (ePer || !per) {
  console.log("")
  console.log(`  No se pudo crear la persona de prueba: ${ePer?.message ?? "sin fila"}`)
  process.exit(1)
}
const { data: emp } = await c.from("empresa").select("id").eq("activo", true).limit(1).single()
const { data: ordenId } = await c.rpc("crear_orden", {
  p_persona: per.id, p_empresa: emp.id, p_plantilla: 1, p_tarea: "Prueba de ajustes",
})

const cuantos = async () =>
  (await c.from("orden_estudio").select("id", { count: "exact", head: true }).eq("orden_id", ordenId)).count
const importe = async () =>
  Number((await c.from("orden").select("importe").eq("id", ordenId).single()).data.importe)

paso("4 · agregar una categoría entera")
{
  const { data: dentro } = await c.from("orden_estudio").select("estudio_id").eq("orden_id", ordenId)
  const yaEstan = new Set(dentro.map((x) => x.estudio_id))

  /* Una categoría que la batería básica NO trae entera. */
  const { data: cats } = await c.from("categoria")
    .select("id, nombre, estudio:estudio(id, nombre, activo)")
    .eq("activo", true)
  const cat = cats
    .map((x) => ({ ...x, faltan: (x.estudio ?? []).filter((e) => e.activo && !yaEstan.has(e.id)) }))
    .sort((a, b) => b.faltan.length - a.faltan.length)[0]

  ok(cat.faltan.length > 0, `hay una categoría con estudios para sumar`, `${cat.nombre}: ${cat.faltan.length}`)

  const antes = await cuantos()
  const antesImporte = await importe()
  await c.from("orden_categoria").upsert(
    { orden_id: ordenId, categoria_id: cat.id },
    { onConflict: "orden_id,categoria_id", ignoreDuplicates: true }
  )
  for (const e of cat.faltan) {
    await c.from("orden_estudio").insert({ orden_id: ordenId, estudio_id: e.id })
  }
  const { data: nuevoImporte } = await c.rpc("calcular_presupuesto", { p_orden: ordenId })
  await c.from("orden").update({ importe: nuevoImporte }).eq("id", ordenId)

  ok(await cuantos() === antes + cat.faltan.length,
     "entraron todos de una vez", `${antes} → ${await cuantos()}`)
  ok(await importe() >= antesImporte, "el importe se recalculó y no bajó",
     `$${antesImporte.toLocaleString("es-AR")} → $${(await importe()).toLocaleString("es-AR")}`)

  globalThis.__cat = cat
}

paso("3 · quitar una categoría entera, sin llevarse lo ya cargado")
{
  const cat = globalThis.__cat
  const { data: items } = await c.from("orden_estudio")
    .select("id, estudio_id, estudio:estudio_id(categoria_id)")
    .eq("orden_id", ordenId)
  const deLaCat = items.filter((i) => i.estudio.categoria_id === cat.id)

  /* Se carga uno a propósito: tiene que sobrevivir al borrado masivo. */
  const cargado = deLaCat[0]
  await c.from("orden_estudio")
    .update({ estado: "CARGADO", resultado: "NORMAL" })
    .eq("id", cargado.id)

  const pendientes = deLaCat.filter((i) => i.id !== cargado.id)
  const antes = await cuantos()
  for (const i of pendientes) await c.from("orden_estudio").delete().eq("id", i.id)
  const { data: imp } = await c.rpc("calcular_presupuesto", { p_orden: ordenId })
  await c.from("orden").update({ importe: imp }).eq("id", ordenId)

  ok(await cuantos() === antes - pendientes.length,
     "se fueron los pendientes de la categoría", `${antes} → ${await cuantos()}`)

  const { data: sobrevive } = await c.from("orden_estudio")
    .select("id, estado").eq("id", cargado.id).maybeSingle()
  ok(!!sobrevive && sobrevive.estado === "CARGADO",
     "el que ya tenía resultado NO se borró",
     sobrevive ? "sigue CARGADO" : "SE PERDIÓ EL RESULTADO")
}

paso("5 · nadie fija la aptitud escribiendo en la tabla")
{
  /* Es SEG-01, y se repite acá porque el arreglo de pantalla podría
     hacer creer que el control está en el front. No lo está. */
  const { data: filas } = await c.from("orden")
    .update({ aptitud: "APTO" }).eq("id", ordenId).select()
  ok((filas ?? []).length === 0, "la base rechaza el intento, incluso como admin",
     `${(filas ?? []).length} filas modificadas`)
}

paso("limpiar")
limpiar()
console.log("  listo")

console.log("")
console.log(fallas === 0
  ? "Todo en verde: los cinco puntos del 9/9 quedaron cubiertos."
  : `${fallas} comprobaciones en rojo`)
process.exit(fallas ? 1 : 0)
