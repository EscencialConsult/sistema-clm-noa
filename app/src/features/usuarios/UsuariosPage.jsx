import { useEffect, useState } from "react"
import { Plus, AlertTriangle, KeyRound, ShieldCheck, Copy, Check } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { supabase } from "../../lib/supabase"
import { ETIQUETA_ROL } from "../../types/dominio"

/* ---------------------------------------------------------------------
   Usuarios y roles — RF01.

   Hasta ahora dar de alta a alguien era abrir una terminal y correr
   scripts/crear-usuario.js, porque crear una cuenta necesita la clave de
   servicio y esa no puede viajar al navegador. Servía mientras el que
   instalaba era el que programaba; ya no. La función crear_usuario_completo
   (017) hace el alta dentro de la base y esta pantalla la usa.

   Tres cosas que la pantalla insiste en decir, porque son las que se
   olvidan:

   · Un usuario por persona. Compartir una cuenta deja la auditoría sin
     sentido, que es lo único que después permite saber quién cargó qué.

   · La contraseña se muestra UNA vez y no se guarda en ningún lado. Se
     entrega en mano. En el primer ingreso el sistema obliga a cambiarla.

   · Un usuario que ya tocó algo NO se puede borrar: la auditoría lo
     referencia y la auditoría no se toca. Se desactiva.
   --------------------------------------------------------------------- */

const ROLES = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]
const VACIO = { usuario: "", nombre: "", rol: "R2", profesional_id: "" }

/* Legible y suficiente: se dicta en voz alta una sola vez. */
function sugerirPassword() {
  const abc = "abcdefghijkmnpqrstuvwxyz"
  const num = "23456789"
  const parte = (n, de) => Array.from({ length: n }, () => de[Math.floor(Math.random() * de.length)]).join("")
  return `${parte(4, abc)}-${parte(4, abc)}-${parte(3, num)}`
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [profesionales, setProfesionales] = useState([])
  const [alta, setAlta] = useState(null)
  const [reset, setReset] = useState(null)
  const [credencial, setCredencial] = useState(null)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function recargar() {
    try {
      const [{ data: us, error: e1 }, { data: ps, error: e2 }] = await Promise.all([
        supabase.from("usuario")
          .select("id, usuario, nombre, activo, debe_cambiar, profesional:profesional_id ( apellido_nombre, matricula_prov ), usuario_rol(rol_codigo)")
          .order("usuario"),
        supabase.from("profesional").select("id, apellido_nombre, matricula_prov").eq("activo", true).order("apellido_nombre"),
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      setUsuarios(us ?? [])
      setProfesionales(ps ?? [])
      setError(null)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { recargar() }, [])

  async function crear(e) {
    e.preventDefault()
    setError(null)
    const password = sugerirPassword()
    try {
      const { error: e2 } = await supabase.rpc("crear_usuario_completo", {
        p_usuario: alta.usuario.trim().toLowerCase(),
        p_nombre: alta.nombre.trim(),
        p_rol: alta.rol,
        p_password: password,
        p_profesional: alta.profesional_id ? Number(alta.profesional_id) : null,
      })
      if (e2) throw new Error(e2.message)
      setCredencial({ usuario: alta.usuario.trim().toLowerCase(), password })
      setAlta(null)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  async function restablecer(e) {
    e.preventDefault()
    setError(null)
    const password = sugerirPassword()
    try {
      const { error: e2 } = await supabase.rpc("restablecer_password", {
        p_usuario_id: reset.id, p_password: password,
      })
      if (e2) throw new Error(e2.message)
      setCredencial({ usuario: reset.usuario, password })
      setReset(null)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  async function alternar(u) {
    setError(null)
    try {
      const { error: e } = await supabase.from("usuario").update({ activo: !u.activo }).eq("id", u.id)
      if (e) throw new Error(e.message)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  return (
    <AppShell titulo="Usuarios y roles" subtitulo="Quién entra al sistema, y con qué permisos">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {credencial && (
        <div className="mb-5 rounded-card border-2 border-success/30 bg-success/5 p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
            <KeyRound size={15} /> Contraseña de {credencial.usuario}
          </p>
          <div className="mb-3 flex items-center gap-2">
            <code className="rounded-md border-2 border-success/30 bg-white px-3 py-2 font-mono text-base text-ink">
              {credencial.password}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(credencial.password)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2000)
              }}
              className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              {copiado ? <><Check size={14} /> Copiada</> : <><Copy size={14} /> Copiar</>}
            </button>
            <button
              onClick={() => setCredencial(null)}
              className="ml-auto rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink"
            >
              Ya la entregué
            </button>
          </div>
          <p className="text-xs text-success/90">
            <b>Anotala o dictala ahora.</b> No se guarda en ningún lado y no se
            puede volver a ver. En el primer ingreso el sistema le va a pedir que
            la cambie, así que esta no queda como definitiva.
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setAlta({ ...VACIO })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90"
        >
          <Plus size={15} /> Nuevo usuario
        </button>
        <span className="ml-auto text-xs text-ink-soft">{usuarios.length} usuarios</span>
      </div>

      <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-soft">
              <th className="pb-2 font-normal">Usuario</th>
              <th className="pb-2 font-normal">Nombre</th>
              <th className="pb-2 font-normal">Rol</th>
              <th className="pb-2 font-normal">Profesional</th>
              <th className="pb-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={`border-t border-ink-soft/10 ${u.activo ? "" : "opacity-50"}`}>
                <td className="py-2.5">
                  <span className="text-ink">{u.usuario}</span>
                  {!u.activo && <span className="ml-2 text-[11px] text-ink-soft">inactivo</span>}
                  {u.debe_cambiar && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                      no cambió la clave
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-ink-soft">{u.nombre}</td>
                <td className="py-2.5 text-xs text-ink-soft">
                  {(u.usuario_rol ?? []).map((r) => ETIQUETA_ROL[r.rol_codigo] ?? r.rol_codigo).join(", ") || "—"}
                </td>
                <td className="py-2.5 text-xs text-ink-soft">
                  {u.profesional
                    ? `${u.profesional.apellido_nombre} · M.P. ${u.profesional.matricula_prov ?? "—"}`
                    : "—"}
                </td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => setReset(u)}
                    className="mr-3 text-xs text-primary hover:underline"
                  >
                    Restablecer clave
                  </button>
                  <button onClick={() => alternar(u)} className="text-xs text-ink-soft hover:underline">
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            Un usuario que ya tocó algo <b>no se borra</b>: la auditoría lo
            referencia y la auditoría no se toca. Se desactiva y deja de entrar,
            pero lo que hizo sigue diciendo su nombre.
          </span>
        </p>
      </div>

      {alta && (
        <Modal titulo="Nuevo usuario" onCerrar={() => setAlta(null)}>
          <form onSubmit={crear}>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Usuario <span className="text-danger">*</span></label>
                <input
                  autoFocus
                  value={alta.usuario}
                  onChange={(e) => setAlta({ ...alta, usuario: e.target.value })}
                  placeholder="mgomez"
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-ink-soft">Uno por persona, sin compartir.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Nombre <span className="text-danger">*</span></label>
                <input
                  value={alta.nombre}
                  onChange={(e) => setAlta({ ...alta, nombre: e.target.value })}
                  placeholder="María Gómez"
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Rol</label>
                <select
                  value={alta.rol}
                  onChange={(e) => setAlta({ ...alta, rol: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">
                  Profesional {alta.rol === "R3" && <span className="text-danger">*</span>}
                </label>
                <select
                  value={alta.profesional_id}
                  onChange={(e) => setAlta({ ...alta, profesional_id: e.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Ninguno</option>
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.apellido_nombre} · M.P. {p.matricula_prov ?? "—"}
                    </option>
                  ))}
                </select>
                {alta.rol === "R3" && (
                  <p className="mt-1 text-[11px] text-warning">
                    El médico laboral firma con su matrícula: sin profesional no
                    puede informar ninguna orden.
                  </p>
                )}
              </div>
            </div>
            <p className="mb-4 rounded-md border-2 border-ink-soft/15 bg-ink-soft/5 px-3 py-2 text-[11px] text-ink-soft">
              La contraseña la genera el sistema y se muestra una sola vez. Se
              entrega en mano; en el primer ingreso hay que cambiarla.
            </p>
            <Botones onCancelar={() => setAlta(null)}
              habilitado={!!alta.usuario.trim() && !!alta.nombre.trim() && (alta.rol !== "R3" || !!alta.profesional_id)}
              texto="Crear" />
          </form>
        </Modal>
      )}

      {reset && (
        <Modal titulo={`Restablecer la clave de ${reset.usuario}`} onCerrar={() => setReset(null)}>
          <form onSubmit={restablecer}>
            <p className="mb-4 text-sm text-ink-soft">
              Se genera una contraseña nueva y se muestra una vez. La anterior deja
              de servir en el acto, y {reset.nombre} va a tener que cambiarla al
              entrar.
            </p>
            <Botones onCancelar={() => setReset(null)} habilitado texto="Restablecer" />
          </form>
        </Modal>
      )}
    </AppShell>
  )
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4">
      <div className="w-full max-w-xl rounded-card border-2 border-ink-soft/15 bg-white p-5 shadow-lg">
        <p className="mb-4 text-sm font-medium text-ink">{titulo}</p>
        {children}
      </div>
    </div>
  )
}

function Botones({ onCancelar, habilitado, texto }) {
  return (
    <div className="flex gap-2">
      <button type="submit" disabled={!habilitado}
        className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40">
        {texto}
      </button>
      <button type="button" onClick={onCancelar}
        className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft">
        Cancelar
      </button>
    </div>
  )
}
