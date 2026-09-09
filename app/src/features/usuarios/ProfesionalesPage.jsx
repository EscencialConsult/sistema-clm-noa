import { useEffect, useState } from "react"
import { Plus, AlertTriangle, Stamp, UserCheck } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { supabase } from "../../lib/supabase"

/* ---------------------------------------------------------------------
   Maestro de profesionales — RF03.

   «El Administrador mantiene los datos de cada profesional que firma un
   informe, propio o externo: apellido y nombre, especialidad, matrícula
   provincial y nacional.»

   Por qué importa más de lo que parece: la matrícula no es un dato de
   ficha, es lo que se imprime al pie del protocolo. Y emitir_protocolo()
   la exige — un médico laboral sin profesional asociado entra al sistema
   y no puede informar ninguna orden. Por eso la pantalla muestra quién
   está vinculado a un usuario y quién no.

   El protocolo imprime las dos matrículas cuando existen, tal como
   figura hoy al pie de la planilla. Con una sola, imprime una.

   Lo que RF03 pide y todavía NO está: la imagen de la firma y el sello.
   Es parte del incremento de la firma, que no se diseñó. No hay columnas
   para eso y esta pantalla no las inventa.
   --------------------------------------------------------------------- */

const VACIO = {
  apellido_nombre: "", especialidad: "", matricula_prov: "", matricula_nac: "",
  es_externo: false, activo: true,
}

export default function ProfesionalesPage() {
  const [profesionales, setProfesionales] = useState([])
  const [vinculados, setVinculados] = useState({})
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)

  async function recargar() {
    try {
      const [{ data: ps, error: e1 }, { data: us, error: e2 }] = await Promise.all([
        supabase.from("profesional")
          .select("id, apellido_nombre, especialidad, matricula_prov, matricula_nac, es_externo, activo")
          .order("apellido_nombre"),
        supabase.from("usuario")
          .select("id, usuario, nombre, profesional_id, usuario_rol(rol_codigo)")
          .not("profesional_id", "is", null),
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)

      const mapa = {}
      for (const u of us ?? []) mapa[u.profesional_id] = u
      setProfesionales(ps ?? [])
      setVinculados(mapa)
      setError(null)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { recargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    const limpio = (v) => {
      const t = (v ?? "").toString().trim()
      return t === "" ? null : t
    }
    const fila = {
      apellido_nombre: limpio(editando.apellido_nombre),
      especialidad: limpio(editando.especialidad),
      matricula_prov: limpio(editando.matricula_prov),
      matricula_nac: limpio(editando.matricula_nac),
      es_externo: !!editando.es_externo,
      activo: editando.activo ?? true,
    }
    try {
      const { error: e2 } = editando.id
        ? await supabase.from("profesional").update(fila).eq("id", editando.id)
        : await supabase.from("profesional").insert(fila)
      if (e2) throw new Error(e2.message)
      setEditando(null)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  async function alternar(p) {
    setError(null)
    try {
      const { error: e } = await supabase.from("profesional").update({ activo: !p.activo }).eq("id", p.id)
      if (e) throw new Error(e.message)
      await recargar()
    } catch (err) { setError(err.message) }
  }

  const sinMatricula = profesionales.filter((p) => p.activo && !p.matricula_prov).length

  return (
    <AppShell titulo="Profesionales" subtitulo="Quién firma los informes, propio o externo">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {sinMatricula > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <Stamp size={15} className="mt-0.5 shrink-0" />
          <span>
            {sinMatricula} {sinMatricula === 1 ? "profesional activo no tiene" : "profesionales activos no tienen"}{" "}
            matrícula provincial. Si alguno es el médico laboral, no va a poder
            emitir ningún protocolo.
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setEditando({ ...VACIO })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90"
        >
          <Plus size={15} /> Nuevo profesional
        </button>
        <span className="ml-auto text-xs text-ink-soft">{profesionales.length} profesionales</span>
      </div>

      <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-soft">
              <th className="pb-2 font-normal">Apellido y nombre</th>
              <th className="pb-2 font-normal">Especialidad</th>
              <th className="pb-2 font-normal">M.P.</th>
              <th className="pb-2 font-normal">M.N.</th>
              <th className="pb-2 font-normal">Usuario</th>
              <th className="pb-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {profesionales.map((p) => {
              const u = vinculados[p.id]
              return (
                <tr key={p.id} className={`border-t border-ink-soft/10 ${p.activo ? "" : "opacity-50"}`}>
                  <td className="py-2.5">
                    <span className="text-ink">{p.apellido_nombre}</span>
                    {p.es_externo && (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-ink-soft/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                        externo
                      </span>
                    )}
                    {!p.activo && <span className="ml-2 text-[11px] text-ink-soft">inactivo</span>}
                  </td>
                  <td className="py-2.5 text-ink-soft">{p.especialidad ?? "—"}</td>
                  <td className="py-2.5">
                    {p.matricula_prov
                      ? <span className="text-ink-soft">{p.matricula_prov}</span>
                      : <span className="text-xs text-warning">falta</span>}
                  </td>
                  <td className="py-2.5 text-ink-soft">{p.matricula_nac ?? "—"}</td>
                  <td className="py-2.5 text-xs">
                    {u ? (
                      <span className="flex items-center gap-1 text-ink-soft">
                        <UserCheck size={12} /> {u.usuario}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => setEditando({ ...p })} className="mr-3 text-xs text-primary hover:underline">
                      Editar
                    </button>
                    <button onClick={() => alternar(p)} className="text-xs text-ink-soft hover:underline">
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-ink-soft">
          La columna «Usuario» dice quién entra al sistema con esa matrícula. Un
          profesional externo puede figurar en un protocolo sin tener usuario: lo
          que se imprime es su matrícula, no su sesión.
        </p>
      </div>

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4">
          <form onSubmit={guardar} className="w-full max-w-2xl rounded-card border-2 border-ink-soft/15 bg-white p-5 shadow-lg">
            <p className="mb-4 text-sm font-medium text-ink">
              {editando.id ? `Editar ${editando.apellido_nombre}` : "Nuevo profesional"}
            </p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Campo label="Apellido y nombre" requerido valor={editando.apellido_nombre}
                onCambio={(v) => setEditando({ ...editando, apellido_nombre: v })} />
              <Campo label="Especialidad" valor={editando.especialidad}
                onCambio={(v) => setEditando({ ...editando, especialidad: v })} />
              <Campo label="Matrícula provincial" valor={editando.matricula_prov}
                onCambio={(v) => setEditando({ ...editando, matricula_prov: v })} />
              <Campo label="Matrícula nacional" valor={editando.matricula_nac}
                onCambio={(v) => setEditando({ ...editando, matricula_nac: v })} />
            </div>

            <label className="mb-3 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!editando.es_externo}
                onChange={(e) => setEditando({ ...editando, es_externo: e.target.checked })}
                className="h-4 w-4"
              />
              Es externo
            </label>

            <p className="mb-4 rounded-md border-2 border-ink-soft/15 bg-ink-soft/5 px-3 py-2 text-[11px] text-ink-soft">
              El protocolo imprime las dos matrículas cuando existen. Si sólo hay
              una, imprime una. La imagen de la firma y el sello son parte de otro
              incremento y todavía no se guardan.
            </p>

            <div className="flex gap-2">
              <button type="submit" disabled={!editando.apellido_nombre?.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40">
                Guardar
              </button>
              <button type="button" onClick={() => setEditando(null)}
                className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  )
}

function Campo({ label, valor, onCambio, requerido }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-soft">
        {label} {requerido && <span className="text-danger">*</span>}
      </label>
      <input
        value={valor ?? ""}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  )
}
