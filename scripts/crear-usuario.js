#!/usr/bin/env node
/* ---------------------------------------------------------------------
   Da de alta un usuario del sistema.

   Hace las tres cosas que hacen falta, que son fáciles de olvidar por
   separado:
     1. lo crea en Supabase Auth (ahí vive la contraseña)
     2. crea la fila en `usuario`, vinculada por auth_id
     3. le asigna el rol

   Sin el paso 2 el usuario puede iniciar sesión pero mi_usuario_id()
   devuelve nulo, y entonces RLS no lo deja ver absolutamente nada: el
   síntoma es "entro pero está todo vacío".

   Uso:
     node scripts/crear-usuario.js <email> <usuario> "<nombre>" <ROL>

   Ejemplo:
     node scripts/crear-usuario.js maria@cmlnoa.local mgomez "María Gómez" R5

   Roles: R1 administrador · R2 recepción · R3 médico laboral
          R4 médico clínico · R5 laboratorio · R6 rayos
          R7 audiometría · R8 psicología
   --------------------------------------------------------------------- */
const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const RAIZ = path.resolve(__dirname, "..")
const [email, usuario, nombre, rol] = process.argv.slice(2)

if (!email || !usuario || !nombre || !rol) {
  console.error("Uso: node scripts/crear-usuario.js <email> <usuario> \"<nombre>\" <ROL>")
  process.exit(1)
}
if (!/^R[1-8]$/.test(rol)) {
  console.error(`Rol inválido: ${rol}. Tiene que ser de R1 a R8.`)
  process.exit(1)
}

/* --- las claves del servidor --- */
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)
/* Este script se corre EN el servidor, así que localhost siempre llega —
   SITE_URL es el nombre con el que lo ven los puestos de la red, y puede
   no resolver desde la propia máquina. Se puede forzar con CMLNOA_API. */
const API = process.env.CMLNOA_API || "http://localhost:8000"

/* Contraseña provisional: el sistema obliga a cambiarla al primer
   ingreso (RF01 regla b), así que no hace falta que sea memorable. */
const provisional = require("crypto").randomBytes(9).toString("base64url")

async function main() {
  /* 1 · en Auth */
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: provisional, email_confirm: true }),
  })
  const creado = await r.json()
  if (!creado.id) {
    console.error("No se pudo crear en Auth:", creado.msg || creado.error_description || JSON.stringify(creado))
    process.exit(1)
  }

  /* 2 y 3 · la fila en usuario y su rol */
  const sql = `
    INSERT INTO usuario (usuario, nombre, auth_id, debe_cambiar)
    VALUES ('${usuario.replace(/'/g, "''")}', '${nombre.replace(/'/g, "''")}',
            '${creado.id}', true)
    RETURNING id;
  `
  const salida = execFileSync("docker", [
    "compose", "exec", "-T", "-e", `PGPASSWORD=${env.POSTGRES_PASSWORD}`,
    "db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tAc",
    sql + `INSERT INTO usuario_rol (usuario_id, rol_codigo)
           SELECT id, '${rol}' FROM usuario WHERE auth_id='${creado.id}';`,
  ], { cwd: RAIZ, encoding: "utf8" })

  console.log("")
  console.log(`Usuario creado: ${usuario} (${nombre}) — rol ${rol}`)
  console.log(`  correo:               ${email}`)
  console.log(`  contraseña provisional: ${provisional}`)
  console.log("")
  console.log("Se la entregás en mano. En el primer ingreso el sistema")
  console.log("lo obliga a cambiarla, así que esta no queda anotada en ningún lado.")
  console.log("")
  console.log("Recordá: un usuario por persona. Compartir una cuenta deja la")
  console.log("auditoría sin sentido — que es lo único que después permite")
  console.log("saber quién cargó qué (RF01, RF27).")
  if (salida.trim()) console.log(`\n(id interno: ${salida.trim().split("\n")[0]})`)
}

main().catch((e) => { console.error("Falló:", e.message); process.exit(1) })
