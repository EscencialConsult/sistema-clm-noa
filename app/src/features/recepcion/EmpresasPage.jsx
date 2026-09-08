import { useEffect, useState } from "react"
import { Building2, Plus, AlertTriangle, Search } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { recepcionService } from "./services/recepcionService"

/* ---------------------------------------------------------------------
   Empresas — CU-05.

   Las 38 que ya usa la clínica vinieron cargadas con el catálogo. Esta
   pantalla existe para la que aparece un martes a la mañana con seis
   personas para revisar: sin ella, recepción no puede abrir la orden.

   Una empresa no se borra nunca, se desactiva. Las órdenes viejas tienen
   que poder seguir diciendo de quién eran.
   --------------------------------------------------------------------- */

const VACIA = { codigo: "", razon_social: "", cuit: "", domicilio: "", telefono: "", activo: true }

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([])
  const [filtro, setFiltro] = useState("")
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    try {
      setEmpresas(await recepcionService.getEmpresas())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { recargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    try {
      await recepcionService.guardarEmpresa(editando)
      setEditando(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function alternar(emp) {
    setError(null)
    try {
      await recepcionService.cambiarActivo(emp.id, !emp.activo)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const t = filtro.trim().toLowerCase()
  const visibles = t
    ? empresas.filter(
        (e) =>
          e.razon_social?.toLowerCase().includes(t) ||
          e.codigo?.toLowerCase().includes(t) ||
          e.cuit?.includes(t)
      )
    : empresas

  return (
    <AppShell titulo="Empresas" subtitulo="Las que mandan gente a revisar">
      {error && (
        <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-5 flex gap-2">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Razón social, código o CUIT"
            className="w-full rounded-md border border-ink-soft/20 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => setEditando({ ...VACIA })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90"
        >
          <Plus size={15} /> Nueva empresa
        </button>
      </div>

      {editando && (
        <form onSubmit={guardar} className="mb-5 max-w-3xl rounded-card border border-primary/30 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-ink">
            {editando.id ? `Editar ${editando.razon_social}` : "Nueva empresa"}
          </p>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Campo label="Razón social" requerido valor={editando.razon_social}
              onCambio={(v) => setEditando({ ...editando, razon_social: v })} />
            <Campo label="Código" valor={editando.codigo}
              onCambio={(v) => setEditando({ ...editando, codigo: v })} />
            <Campo label="CUIT" valor={editando.cuit}
              onCambio={(v) => setEditando({ ...editando, cuit: v })} />
            <Campo label="Domicilio" valor={editando.domicilio}
              onCambio={(v) => setEditando({ ...editando, domicilio: v })} />
            <Campo label="Teléfono" valor={editando.telefono}
              onCambio={(v) => setEditando({ ...editando, telefono: v })} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!editando.razon_social?.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-md border border-ink-soft/20 px-4 py-2 text-sm text-ink-soft"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-card border border-ink-soft/10 bg-white p-5">
        <p className="mb-4 text-sm font-medium text-ink">
          {visibles.length} de {empresas.length}
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-soft">
              <th className="pb-2 font-normal">Razón social</th>
              <th className="pb-2 font-normal">Código</th>
              <th className="pb-2 font-normal">CUIT</th>
              <th className="pb-2 font-normal">Teléfono</th>
              <th className="pb-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {!cargando && visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-ink-soft">
                  No hay ninguna que coincida.
                </td>
              </tr>
            )}
            {visibles.map((e) => (
              <tr key={e.id} className={`border-t border-ink-soft/10 ${e.activo ? "" : "opacity-50"}`}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2 text-ink">
                    <Building2 size={14} className="text-ink-soft" />
                    {e.razon_social}
                    {!e.activo && <span className="text-xs text-ink-soft">· inactiva</span>}
                  </span>
                </td>
                <td className="py-2.5 text-ink-soft">{e.codigo ?? "—"}</td>
                <td className="py-2.5 text-ink-soft">{e.cuit ?? "—"}</td>
                <td className="py-2.5 text-ink-soft">{e.telefono ?? "—"}</td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => setEditando({ ...e })}
                    className="mr-3 text-xs text-primary hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternar(e)}
                    className="text-xs text-ink-soft hover:underline"
                  >
                    {e.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-ink-soft">
          Una empresa no se borra: se desactiva. Deja de ofrecerse al abrir una
          orden nueva, pero las órdenes viejas siguen diciendo de quién eran.
        </p>
      </div>
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
        className="w-full rounded-md border border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  )
}
