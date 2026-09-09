import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ShieldCheck, RefreshCw, Search, ArrowRight } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { supabase } from "../../lib/supabase"

/* ---------------------------------------------------------------------
   Auditoría — RF27, RNF-11.

   «El sistema registra toda modificación sensible con usuario, fecha y
   hora, valor anterior y valor nuevo. El registro no es editable por
   ningún rol.»

   Las dos mitades importan y las dos están:

   · Registra. Doce tablas, las que nombra RF27 (016). Incluye las bajas
     de vínculos —sacarle un estudio a un concepto cambia lo que se
     factura— que antes no dejaban huella.

   · No se puede tocar. auditoria no tiene política de escritura, a
     propósito. Ni el Administrador puede borrar una fila: lo escribe un
     trigger que corre como dueño, y nadie más entra. Esa es la parte que
     hace que el registro valga algo, y por eso la pantalla lo dice.

   Sólo la ve el Administrador (política leer_auditoria).
   --------------------------------------------------------------------- */

const ETIQUETA_TABLA = {
  orden: "Órdenes",
  orden_estudio: "Resultados",
  persona: "Personas",
  estudio: "Estudios",
  empresa: "Empresas",
  categoria: "Categorías",
  plantilla: "Baterías",
  plantilla_item: "Ítems de batería",
  concepto: "Conceptos",
  concepto_estudio: "Estudios por concepto",
  usuario: "Usuarios",
  usuario_rol: "Roles",
}

const PAGINA = 100

export default function AuditoriaPage() {
  const [filas, setFilas] = useState([])
  const [tabla, setTabla] = useState("")
  const [texto, setTexto] = useState("")
  const [desde, setDesde] = useState("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [hayMas, setHayMas] = useState(false)

  async function recargar(limite = PAGINA) {
    setCargando(true)
    try {
      let q = supabase
        .from("auditoria")
        .select("id, fecha_hora, tabla, registro_id, campo, valor_anterior, valor_nuevo, motivo, usuario:usuario_id ( usuario, nombre )")
        .order("id", { ascending: false })
        .limit(limite + 1)

      if (tabla) q = q.eq("tabla", tabla)
      if (desde) q = q.gte("fecha_hora", `${desde}T00:00:00`)

      const { data, error: e } = await q
      if (e) throw new Error(e.message)

      setHayMas((data ?? []).length > limite)
      setFilas((data ?? []).slice(0, limite))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { recargar() }, [tabla, desde]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = texto.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      filas.filter((f) => {
        if (!t) return true
        return (
          f.usuario?.nombre?.toLowerCase().includes(t) ||
          f.usuario?.usuario?.toLowerCase().includes(t) ||
          f.campo?.toLowerCase().includes(t) ||
          f.valor_anterior?.toLowerCase().includes(t) ||
          f.valor_nuevo?.toLowerCase().includes(t) ||
          String(f.registro_id).includes(t)
        )
      }),
    [filas, t]
  )

  const sinUsuario = filas.filter((f) => !f.usuario).length

  return (
    <AppShell titulo="Auditoría" subtitulo="Quién cambió qué, y cuándo">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        <span>
          Este registro <b>no se puede editar ni borrar</b>, tampoco desde esta
          pantalla ni con tu usuario. Lo escribe la base sola y no tiene permiso
          de escritura para nadie (RNF-11).
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Usuario, campo o valor"
            className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-ink-soft">Qué</label>
          <select
            value={tabla}
            onChange={(e) => setTabla(e.target.value)}
            className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Todo</option>
            {Object.entries(ETIQUETA_TABLA).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-ink-soft">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => recargar()}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
        <span className="ml-auto text-xs text-ink-soft">
          {visibles.length} {visibles.length === 1 ? "cambio" : "cambios"}
          {hayMas && ` de los últimos ${PAGINA}`}
        </span>
      </div>

      {sinUsuario > 0 && (
        <div className="mb-4 rounded-md border-2 border-ink-soft/15 bg-ink-soft/5 px-4 py-3 text-xs text-ink-soft">
          {sinUsuario} de estos cambios no tienen usuario. Son anteriores al
          arreglo de la migración 015: hasta ahí el sistema anotaba qué había
          cambiado, pero no quién. No se reescriben — corregir la auditoría a
          mano es justo lo que la auditoría no debe permitir.
        </div>
      )}

      <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-soft">
              <th className="pb-2 font-normal">Cuándo</th>
              <th className="pb-2 font-normal">Quién</th>
              <th className="pb-2 font-normal">Qué</th>
              <th className="pb-2 font-normal">Campo</th>
              <th className="pb-2 font-normal">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-ink-soft">
                  No hay cambios registrados con ese filtro.
                </td>
              </tr>
            )}
            {visibles.map((f) => (
              <tr key={f.id} className="border-t border-ink-soft/10 align-top">
                <td className="whitespace-nowrap py-2.5 text-xs text-ink-soft">
                  {(f.fecha_hora ?? "").slice(0, 10)}
                  <span className="ml-1">{(f.fecha_hora ?? "").slice(11, 19)}</span>
                </td>
                <td className="py-2.5">
                  {f.usuario ? (
                    <>
                      <span className="text-ink">{f.usuario.nombre}</span>
                      <span className="block text-[11px] text-ink-soft">{f.usuario.usuario}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-soft">—</span>
                  )}
                </td>
                <td className="py-2.5 text-xs text-ink-soft">
                  {ETIQUETA_TABLA[f.tabla] ?? f.tabla}
                  <span className="block text-[11px]">#{f.registro_id}</span>
                </td>
                <td className="py-2.5 text-xs text-ink">{f.campo}</td>
                <td className="py-2.5 text-xs">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-ink-soft line-through">{f.valor_anterior ?? "—"}</span>
                    <ArrowRight size={12} className="shrink-0 text-ink-soft" />
                    <span className="text-ink">{f.valor_nuevo ?? "—"}</span>
                  </span>
                  {f.motivo && (
                    <span className="mt-0.5 block text-[11px] text-ink-soft">
                      Motivo: {f.motivo}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hayMas && (
          <button
            onClick={() => recargar(filas.length + PAGINA)}
            className="mt-4 w-full rounded-md border-2 border-ink-soft/15 py-2 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
          >
            Traer {PAGINA} más
          </button>
        )}
      </div>
    </AppShell>
  )
}
