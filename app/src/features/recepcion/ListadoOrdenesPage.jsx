import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Download, Search, X } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import Paginador, { paginar } from "../../shared/Paginador"
import { recepcionService } from "./services/recepcionService"
import { hoyLocal, primerDiaDelMes } from "../../lib/fechas"
import { coincide } from "../../lib/buscarOrden"
import { ESTADO_ORDEN, APTITUD, ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"

/* ---------------------------------------------------------------------
   Listado de órdenes — CU-13 · CP-25.

   «Salen las mismas columnas que el Excel de hoy, con importes.» Es el
   listado que la administración arma a mano a fin de mes para facturarle
   a cada empresa, y el motivo por el que el importe se congela al crear
   la orden: si el precio del básico cambia en octubre, lo facturado en
   septiembre tiene que seguir diciendo lo mismo (CP-10).

   El botón de descarga arma un CSV con lo que se ve en pantalla, para
   que puedan seguir trabajándolo en Excel mientras se acostumbran.
   --------------------------------------------------------------------- */

export default function ListadoOrdenesPage() {
  const navigate = useNavigate()
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(hoyLocal())
  const [empresa, setEmpresa] = useState("")
  /* Estado y aptitud se filtran acá y no en la consulta: la consulta ya
     trajo el período, así que pasar de «no aptos» a «en curso» es
     instantáneo y no vuelve a la base. */
  const [estado, setEstado] = useState("")
  const [aptitud, setAptitud] = useState("")
  /* El documento que trae el paciente es lo que más se busca, y no
     dependía de nada: había que acordarse del rango de fechas. */
  const [texto, setTexto] = useState("")
  const [empresas, setEmpresas] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [pagina, setPagina] = useState(1)

  const filtradas = useMemo(
    () => ordenes.filter((o) =>
      (!estado || o.estado === estado) &&
      (!aptitud || o.aptitud === aptitud) &&
      coincide(o, texto)
    ),
    [ordenes, estado, aptitud, texto]
  )

  /* La página se corta acá, no en la consulta. Y se corta sobre lo
     FILTRADO: el total del pie y el CSV tienen que decir lo mismo que
     la tabla, o el número que se le pasa a la empresa sale mal. */
  const hoja = paginar(filtradas, pagina)

  useEffect(() => {
    recepcionService.getEmpresas().then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  /* Sin esto, filtrar estando en la página 3 deja la tabla vacía: hay
     menos páginas que antes y nadie entiende por qué no aparece nada. */
  useEffect(() => { setPagina(1) }, [estado, aptitud, texto])

  async function buscar() {
    setCargando(true)
    setError(null)
    try {
      setOrdenes(await recepcionService.getListado({ desde, hasta, empresa: empresa || null }))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { buscar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(
    () => filtradas.reduce((s, o) => s + Number(o.importe ?? 0), 0),
    [filtradas]
  )

  function descargar() {
    const cabecera = ["Numero", "Fecha", "Paciente", "Documento", "Empresa", "Estado", "Aptitud", "Estudios", "Importe"]
    const filas = filtradas.map((o) => [
      o.numero, o.fecha, o.paciente, o.documento, o.empresa,
      ETIQUETA_ESTADO[o.estado], ETIQUETA_APTITUD[o.aptitud], o.estudios, o.importe,
    ])
    /* punto y coma: es lo que espera el Excel en español, si no mete todo
       en una sola columna */
    const csv = [cabecera, ...filas]
      .map((f) => f.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\r\n")

    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    /* El filtro va en el nombre del archivo. Quien baja «no aptos de
       agosto» y «todas de agosto» termina con dos archivos en Descargas,
       y si se llaman igual no hay forma de saber cuál es cuál. */
    const sufijo = [
      estado ? ETIQUETA_ESTADO[estado] : null,
      aptitud ? ETIQUETA_APTITUD[aptitud] : null,
    ].filter(Boolean).join("-").toLowerCase().replace(/ /g, "-")
    a.download = `ordenes-${desde}-a-${hasta}${sufijo ? `-${sufijo}` : ""}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell titulo="Listado de órdenes" subtitulo="Para el cierre del mes">
      {error && (
        <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div className="min-w-64">
          <label className="mb-1 block text-xs text-ink-soft">Empresa</label>
          <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}
            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary">
            <option value="">Todas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.razon_social}>{e.razon_social}</option>
            ))}
          </select>
        </div>
        {/* El buscador va primero: es por donde se entra cuando alguien
            pregunta «¿lo mío ya salió?» con el DNI en la mano. */}
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs text-ink-soft">Buscar</label>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="DNI, apellido o N° de orden"
              className="w-full rounded-md border-2 border-ink-soft/20 py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
            />
            {texto && (
              <button
                onClick={() => setTexto("")}
                title="Borrar"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Estado y aptitud no vuelven a la base: filtran lo que ya está
            en pantalla. Por eso van después del botón Buscar y no antes
            —no hay que apretar nada— aunque se lean en la misma línea. */}
        <div className="min-w-40">
          <label className="mb-1 block text-xs text-ink-soft">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}
            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary">
            <option value="">Todos</option>
            {ESTADO_ORDEN.map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>
            ))}
          </select>
        </div>
        <div className="min-w-40">
          <label className="mb-1 block text-xs text-ink-soft">Aptitud</label>
          <select value={aptitud} onChange={(e) => setAptitud(e.target.value)}
            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary">
            <option value="">Todas</option>
            {APTITUD.map((a) => (
              <option key={a} value={a}>{ETIQUETA_APTITUD[a]}</option>
            ))}
          </select>
        </div>
        <button onClick={buscar} disabled={cargando}
          className="rounded-md bg-primary px-5 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40">
          {cargando ? "Buscando…" : "Buscar"}
        </button>
        <button onClick={descargar} disabled={filtradas.length === 0}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft hover:border-primary/40 hover:text-primary disabled:opacity-40">
          <Download size={15} /> Descargar CSV
        </button>
      </div>

      <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink">
            {filtradas.length} {filtradas.length === 1 ? "orden" : "órdenes"}
            {(estado || aptitud) && (
              <span className="font-normal text-ink-soft">
                {" "}de {ordenes.length}
              </span>
            )}
          </p>
          <p className="text-sm text-ink">
            Total: <span className="font-medium">
              $ {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] text-ink-soft">
              <th className="pb-2 font-normal">N°</th>
              <th className="pb-2 font-normal">Fecha</th>
              <th className="pb-2 font-normal">Paciente</th>
              <th className="pb-2 font-normal">Empresa</th>
              <th className="pb-2 font-normal">Estado</th>
              <th className="pb-2 font-normal">Aptitud</th>
              <th className="pb-2 text-right font-normal">Importe</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-ink-soft">
                  {ordenes.length === 0
                    ? "No hay órdenes en ese período."
                    : `Ninguna de las ${ordenes.length} del período coincide con la búsqueda.`}
                </td>
              </tr>
            )}
            {hoja.filas.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/carga/${o.id}`)}
                className="cursor-pointer border-t border-ink-soft/10 hover:bg-ink-soft/5">
                <td className="py-2.5 text-ink-soft">{o.numero}</td>
                <td className="py-2.5 text-ink-soft">{o.fecha}</td>
                <td className="py-2.5">
                  <p className="text-ink">{o.paciente}</p>
                  <p className="text-xs text-ink-soft">{o.documento}</p>
                </td>
                <td className="py-2.5 text-ink-soft">{o.empresa}</td>
                <td className="py-2.5 text-xs text-ink-soft">{ETIQUETA_ESTADO[o.estado]}</td>
                <td className="py-2.5">
                  {o.aptitud === "PENDIENTE" ? (
                    <span className="text-xs text-ink-soft">—</span>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      o.aptitud === "APTO" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}>
                      {ETIQUETA_APTITUD[o.aptitud]}
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right text-ink">
                  $ {Number(o.importe ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Este listado es el anexo que se le adjunta a la factura de
            cada empresa: crece con el mes y sin paginar se vuelve
            interminable. La descarga a CSV sigue llevándose TODO, no
            sólo la página que se ve. */}
        <Paginador
          pagina={hoja.pagina}
          totalPaginas={hoja.totalPaginas}
          onCambiar={setPagina}
          cuantos={filtradas.length}
        />

        <p className="mt-4 text-xs text-ink-soft">
          El importe es el que tenía la orden cuando se creó. Si mañana cambia un
          precio, este listado sigue diciendo lo mismo.
        </p>
      </div>
    </AppShell>
  )
}
