import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Upload, FileText, AlertTriangle, RefreshCw, ExternalLink, Lock } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { tercerosService } from "./services/tercerosService"
import { hoyLocal, desdeMedianoche } from "../../lib/fechas"

/* ---------------------------------------------------------------------
   Informes de terceros — RF18, RF19.

   El ECG del cardiólogo, la campimetría, el EEG, el laboratorio
   derivado. Llegan en papel o en PDF, ya firmados por quien los hizo, y
   se incorporan TAL COMO FUERON EMITIDOS: no se re-tipean ni se vuelven
   a firmar.

   La pantalla arranca por los estudios DERIVADOS, que son exactamente
   los que están esperando algo de afuera y los que impiden cerrar la
   orden (RF19). Incorporar el informe los deja cargados en la misma
   acción: subir el archivo y no marcar el estudio dejaría la orden
   esperando algo que ya llegó.

   Un informe incorporado no se borra ni se reemplaza (RNF-28). Si llegó
   equivocado se sube el correcto y quedan los dos. La base lo hace
   cumplir: storage no tiene política de borrado.
   --------------------------------------------------------------------- */

export default function TercerosPage() {
  const navigate = useNavigate()
  const [derivados, setDerivados] = useState([])
  const [recientes, setRecientes] = useState([])
  const [archivos, setArchivos] = useState({})
  const [subiendo, setSubiendo] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    setCargando(true)
    try {
      const [d, r] = await Promise.all([
        tercerosService.getDerivados(),
        tercerosService.getIncorporadosDeHoy(desdeMedianoche(hoyLocal())),
      ])
      setDerivados(d)
      setRecientes(r)

      /* Los informes ya incorporados, en UNA consulta. Antes era una
         llamada al bucket por cada fila de la pantalla. */
      setArchivos(await tercerosService.getAdjuntos([...d, ...r].map((it) => it.id)))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { recargar() }, [])

  async function incorporar(item, archivo, resultado) {
    setError(null)
    setAviso(null)
    setSubiendo(item.id)
    try {
      await tercerosService.incorporar(item.orden_id, item.id, archivo, resultado)
      setAviso(
        `${archivo.name} quedó incorporado a ${item.estudio.nombre}. ` +
        "El estudio pasó a cargado."
      )
      await recargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(null)
    }
  }

  async function abrir(adjunto) {
    setError(null)
    try {
      window.open(await tercerosService.verArchivo(adjunto.ruta), "_blank", "noopener")
    } catch (e) { setError(e.message) }
  }

  return (
    <AppShell titulo="Informes de terceros" subtitulo="Lo que llega de afuera, ya firmado">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-md border-2 border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {aviso}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={recargar}
          className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-3 py-2 text-xs font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
        <span className="text-xs text-ink-soft">
          {derivados.length} esperando · {recientes.length} incorporados hoy
        </span>
      </div>

      <section className="mb-5">
        <p className="mb-1 text-sm font-medium text-ink">Esperando informe ({derivados.length})</p>
        <p className="mb-3 text-xs text-ink-soft">
          Estudios derivados a un tercero. Mientras no vuelvan, la orden no se
          puede informar.
        </p>

        {!cargando && derivados.length === 0 ? (
          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-8 text-center">
            <p className="text-sm text-ink">No hay ningún estudio esperando informe.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Un estudio llega acá cuando se lo marca como derivado en la pantalla
              de carga.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {derivados.map((it) => (
              <Fila
                key={it.id}
                item={it}
                archivos={archivos[it.id] ?? []}
                subiendo={subiendo === it.id}
                onSubir={incorporar}
                onAbrir={abrir}
                onOrden={() => navigate(`/carga/${it.orden_id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {recientes.length > 0 && (
        <section>
          <p className="mb-3 text-sm font-medium text-ink">Incorporados hoy ({recientes.length})</p>
          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <ul className="flex flex-col gap-2">
              {recientes.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink">{it.estudio.nombre}</span>
                  <span className="text-ink-soft">
                    · N° {it.orden?.numero} · {it.orden?.persona?.apellido}, {it.orden?.persona?.nombre}
                  </span>
                  {(archivos[it.id] ?? []).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => abrir(a)}
                      title={`${a.nombre_archivo} · subió ${a.subido?.nombre ?? "—"}`}
                      className="flex items-center gap-1 rounded-md border-2 border-ink-soft/15 px-2 py-0.5 text-[11px] text-ink-soft hover:border-primary/50 hover:text-primary"
                    >
                      <FileText size={11} /> ver
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="mt-5 flex items-start gap-2 text-xs text-ink-soft">
        <Lock size={13} className="mt-0.5 shrink-0" />
        <span>
          Un informe incorporado <b>no se borra ni se reemplaza</b>. Si llegó
          equivocado, se sube el correcto y quedan los dos: el original sigue
          siendo parte del legajo. Lo hace cumplir la base, no esta pantalla.
        </span>
      </p>
    </AppShell>
  )
}

function Fila({ item, archivos, subiendo, onSubir, onAbrir, onOrden }) {
  const [resultado, setResultado] = useState("")
  const p = item.orden?.persona ?? {}

  return (
    <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="text-sm font-medium text-ink">{item.estudio.nombre}</span>
        <span className="text-xs text-ink-soft">{item.estudio.categoria?.nombre}</span>
        <button onClick={onOrden} className="text-xs text-primary hover:underline">
          N° {item.orden?.numero}
        </button>
        <span className="text-xs text-ink-soft">
          {p.apellido}, {p.nombre} · {p.tipo_doc} {p.nro_doc} · {item.orden?.empresa?.razon_social}
        </span>
      </div>

      {archivos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {archivos.map((a) => (
            <button
              key={a.name}
              onClick={() => onAbrir(item, a.name)}
              className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/15 px-2.5 py-1 text-xs text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              <FileText size={12} /> {a.name.replace(/^\d+-/, "")}
              <ExternalLink size={11} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-[11px] text-ink-soft">
            Resultado, como lo dice el informe
          </label>
          <input
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="NORMAL, o lo que diga el informe"
            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <label className={`flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90 ${subiendo ? "opacity-50" : ""}`}>
          <Upload size={15} />
          {subiendo ? "Subiendo…" : "Incorporar informe"}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff"
            disabled={subiendo}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onSubir(item, f, resultado)
              e.target.value = ""
            }}
          />
        </label>
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">
        PDF o imagen, hasta 20 MB. Se incorpora tal como llegó y el estudio pasa a
        cargado.
      </p>
    </div>
  )
}
