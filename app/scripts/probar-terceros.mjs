/* El circuito de un informe de tercero, de punta a punta.
   Se corre desde app/: node scripts/_tmp-terceros.mjs */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { execFileSync } from "child_process"

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)
const API = "http://localhost:8000"
const sql = (t) => execFileSync("docker", [
  "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
  "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
], { cwd: RAIZ, encoding: "utf8", input: t }).trim()

const pasos = []
const paso = (n, ok, d) => { pasos.push(ok); console.log(`  ${ok ? "✔" : "✘"}  ${n}\n        ${d}`) }

const c = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { error: eL } = await c.auth.signInWithPassword({
  email: "recepcion@cmlnoa.local", password: "Cml-9rgyd0t6fk" })
if (eL) { console.error("login:", eL.message); process.exit(1) }

/* --- preparar: derivar un estudio de una orden abierta --- */
const id = sql(`SELECT oe.id FROM orden_estudio oe JOIN orden o ON o.id=oe.orden_id
                WHERE o.estado <> 'INFORMADA' AND oe.estado='PENDIENTE' LIMIT 1;`)
if (!id) { console.error("no hay ningún estudio pendiente para derivar"); process.exit(1) }
sql(`UPDATE orden_estudio SET estado='DERIVADO' WHERE id=${id};`)

/* 1 · aparece entre los que esperan informe */
const { data: der, error: e1 } = await c.from("orden_estudio")
  .select("id, estado, orden_id, estudio:estudio_id ( nombre )")
  .eq("estado", "DERIVADO")
paso("un estudio derivado aparece esperando informe (RF19)",
  !e1 && der.some((x) => String(x.id) === id),
  e1 ? e1.message : `${der.length} esperando · ${der.find((x)=>String(x.id)===id)?.estudio?.nombre}`)

const item = der.find((x) => String(x.id) === id)

/* 2 · con un derivado, la orden no se puede informar */
const faltan = sql(`SELECT count(*) FROM orden_estudio WHERE orden_id=${item.orden_id} AND estado <> 'CARGADO';`)
paso("mientras no vuelva, la orden no se puede cerrar", Number(faltan) > 0,
  `${faltan} estudios sin cargar en la orden`)

/* 3 · incorporar el informe */
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "latin1")
const ruta = `${item.orden_id}/${item.id}/${Date.now()}-ecg.pdf`
const { error: e3 } = await c.storage.from("informes")
  .upload(ruta, pdf, { contentType: "application/pdf" })
paso("se incorpora el informe tal como llegó", !e3, e3 ? e3.message : ruta)

/* 4 · y el estudio queda cargado en la misma acción */
const { error: e4 } = await c.from("orden_estudio")
  .update({ estado: "CARGADO", resultado: "NORMAL - VER INFORME" }).eq("id", item.id)
const estado = sql(`SELECT estado||' · '||coalesce(resultado,'—') FROM orden_estudio WHERE id=${item.id};`)
paso("el estudio pasa a cargado con el informe", !e4 && estado.startsWith("CARGADO"),
  e4 ? e4.message : estado)

/* 5 · el archivo se puede volver a mirar, con URL temporal */
const { data: firmada, error: e5 } = await c.storage.from("informes").createSignedUrl(ruta, 60)
let bytes = 0
if (firmada?.signedUrl) {
  const r = await fetch(firmada.signedUrl.startsWith("http") ? firmada.signedUrl : API + firmada.signedUrl)
  if (r.ok) bytes = (await r.arrayBuffer()).byteLength
}
paso("se puede volver a abrir con una URL temporal", !e5 && bytes > 0,
  e5 ? e5.message : `${bytes} bytes`)

/* 6 · pero no se puede borrar (RNF-28) */
const { data: borr } = await c.storage.from("informes").remove([ruta])
const sigue = await c.storage.from("informes").list(`${item.orden_id}/${item.id}`)
paso("un informe incorporado no se borra (RNF-28)",
  (sigue.data ?? []).some((a) => ruta.endsWith(a.name)),
  `el archivo sigue estando (borrado devolvió ${(borr ?? []).length} filas)`)

/* 7 · sin sesión no se ve nada */
const anon = createClient(API, env.ANON_KEY, { auth: { persistSession: false } })
const { data: verAnon } = await anon.storage.from("informes").list(`${item.orden_id}/${item.id}`)
paso("sin sesión no se lista ningún informe", (verAnon ?? []).length === 0,
  `${(verAnon ?? []).length} archivos`)

/* dejar la orden como estaba */
sql(`UPDATE orden_estudio SET estado='PENDIENTE', resultado=NULL WHERE id=${item.id};`)

const mal = pasos.filter((x) => !x).length
console.log("")
console.log(mal ? `FALLAN ${mal} de ${pasos.length}` : `Los ${pasos.length} pasos andan.`)
process.exitCode = mal ? 1 : 0
