import { supabase } from "../../../lib/supabase"

/* ---------------------------------------------------------------------
   Autenticación real contra Supabase Auth.

   Mantiene EXACTAMENTE la misma interfaz que la versión con mocks
   —mismo objeto exportado, mismos métodos, misma forma de sesión— para
   que ninguna pantalla tenga que cambiar. Esa era la razón de tener la
   capa de servicios.

   Sobre el usuario y el correo: la operadora escribe "recepcion", no un
   correo. Supabase Auth trabaja con correos, así que se completa con el
   dominio interno. Nadie tiene que aprender una dirección nueva.
   --------------------------------------------------------------------- */

const DOMINIO = "@cmlnoa.local"

/* Los códigos de la base (R1..R8) contra las claves que usan las
   pantallas. Si cambia uno, se cambia acá y en ningún otro lado. */
const ROL_A_CLAVE = {
  R1: "administrador",
  R2: "recepcion",
  R3: "medico_laboral",
  R4: "medico_clinico",
  R5: "laboratorio",
  R6: "rayos",
  R7: "audiometria",
  R8: "psicologia",
}

const iniciales = (nombre) =>
  (nombre || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()

/** Arma la sesión que esperan las pantallas, a partir de la fila de `usuario`. */
async function armarSesion() {
  // Hay que filtrar por auth_id explícitamente. El Administrador ve a
  // TODOS los usuarios —los administra, es lo correcto— así que sin este
  // filtro la consulta devuelve varias filas y .single() falla con
  // PGRST116. El síntoma es que entra cualquiera menos el administrador.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No hay sesión activa.")

  const { data, error } = await supabase
    .from("usuario")
    .select("id, usuario, nombre, debe_cambiar, activo, usuario_rol(rol_codigo), profesional(especialidad, matricula_prov, matricula_nac)")
    .eq("auth_id", user.id)
    .single()

  if (error || !data) {
    // Entró en Auth pero no tiene fila en `usuario`: RLS no lo va a dejar
    // ver nada. Es un alta a medio hacer, y conviene decirlo claro.
    await supabase.auth.signOut()
    throw new Error(
      "El usuario existe pero no está dado de alta en el sistema. " +
      "Avisale al administrador: falta vincularlo con su rol."
    )
  }

  if (!data.activo) {
    await supabase.auth.signOut()
    throw new Error("Este usuario está desactivado.")
  }

  const codigos = (data.usuario_rol ?? []).map((r) => r.rol_codigo)
  const rol = ROL_A_CLAVE[codigos[0]] ?? null

  if (!rol) {
    await supabase.auth.signOut()
    throw new Error("El usuario no tiene ningún rol asignado.")
  }

  return {
    id: data.id,
    usuario: data.usuario,
    nombre_completo: data.nombre,
    rol,
    roles: codigos,
    especialidad: data.profesional?.especialidad,
    matricula_provincial: data.profesional?.matricula_prov,
    matricula_nacional: data.profesional?.matricula_nac,
    debe_cambiar_contrasena: data.debe_cambiar,
    avatar_iniciales: iniciales(data.nombre),
  }
}

/* La sesión se guarda para que AppShell la lea sin esperar: Supabase ya
   guarda el token, esto es solo la ficha del usuario para pintar la
   pantalla. No decide permisos — eso lo hace RLS en la base. */
const CLAVE = "cmlnoa_sesion"

export const authService = {
  async login(usuario, contrasena) {
    const email = usuario.includes("@") ? usuario : usuario.trim() + DOMINIO

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: contrasena,
    })

    if (error) {
      // No se aclara cuál de los dos campos falló: decirlo ayuda a quien
      // está probando usuarios ajenos.
      throw new Error("Usuario o contraseña incorrectos.")
    }

    const sesion = await armarSesion()
    localStorage.setItem(CLAVE, JSON.stringify(sesion))
    return sesion
  },

  async cerrarSesion() {
    localStorage.removeItem(CLAVE)
    await supabase.auth.signOut()
  },

  getSesionActual() {
    const guardado = localStorage.getItem(CLAVE)
    return guardado ? JSON.parse(guardado) : null
  },

  async cambiarContrasena(nuevaContrasena) {
    const { error } = await supabase.auth.updateUser({ password: nuevaContrasena })
    if (error) throw new Error(error.message)

    // marcar que ya la cambió (RF01 regla b)
    const actual = authService.getSesionActual()
    if (actual) {
      await supabase.from("usuario").update({ debe_cambiar: false }).eq("id", actual.id)
    }

    const sesion = await armarSesion()
    localStorage.setItem(CLAVE, JSON.stringify(sesion))
    return sesion
  },
}
