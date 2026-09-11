import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, UserPlus, Printer, AlertTriangle, Check, ArrowRight, Plus, X, Layers, ChevronRight, FileText, Clock, Pencil, Keyboard, User, Building2, Droplet, TestTube, Activity, Bone, HeartPulse, Ear, Eye, Brain, Stethoscope, FlaskConical, Lock, Info } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { nuevaOrdenService } from "./services/nuevaOrdenService"
import { catalogoService } from "../catalogo/services/catalogoService"
/* El legajo y la corrección del padrón ya estaban resueltos en otra
   pantalla. Se reusan tal cual: acá sólo cambia desde dónde se abren. */
import { aptitudService } from "../aptitud/services/aptitudService"
import { recepcionService } from "../recepcion/services/recepcionService"
import { TIPO_DOC, TIPO_EXAMEN, ETIQUETA_ESTADO, ETIQUETA_APTITUD, ETIQUETA_ROL } from "../../types/dominio"
import MenuImpreso from "../../shared/impresos/MenuImpreso"
import { imprimirHojaDeRuta } from "./imprimir/HojaDeRuta"
import ElegirPaginas from "./imprimir/ElegirPaginas"

/* ---------------------------------------------------------------------
   Alta de orden — CU-05 + CU-06 · RF11, RF12, RF14.

   Es por donde entra todo. Tres pasos, en el orden en que los hace
   recepción con el paciente adelante:

     1 · el documento     ¿ya está en el padrón, o es la primera vez?
     2 · empresa y batería
     3 · confirmar        se ve qué estudios se abren y cuánto sale

   La pantalla no calcula nada de eso. El número de orden, los estudios
   según el sexo y el importe los pone crear_orden() (CP-07, CP-08,
   CP-12). Acá sólo se muestra antes de apretar, para que recepción no
   trabaje a ciegas.
   --------------------------------------------------------------------- */

/* Qué va a hacer el sistema con lo que se está cargando. Se dice en el
   momento, no después: es la diferencia entre cargar un rango bien y
   descubrir en tres meses que nunca se comparó nada. */
const RANGO_COMPARABLE = new RegExp("^\\s*\\d+([.,]\\d+)?\\s*-\\s*\\d+([.,]\\d+)?\\s*$")

function avisoReferencia(e) {
  const refs = [e.ref_h, e.ref_m].filter((r) => (r ?? "").trim() !== "")
  if (refs.length === 0) {
    return e.unidad
      ? "Sin referencia: se guarda el número pero no se compara con nada."
      : "Sin unidad ni referencia: se va a cargar como cualitativo (NORMAL / ANORMAL)."
  }
  return refs.every((r) => RANGO_COMPARABLE.test(r))
    ? "El sistema va a marcar el valor cuando quede fuera de rango."
    : "Ese formato no se puede comparar. Sólo entiende 43-53; con «<1,40» no marca nada."
}

const TIPO_EXAMEN_LABEL = { PRELABORAL: "Prelaboral", PERIODICO: "Periódico", EGRESO: "Egreso" }

/* Un icono por categoría. Se elige por el nombre y no por el id: las
   categorías las crea la clínica, así que mañana puede haber una que
   hoy no existe. Lo primero que coincide gana, así que lo específico
   va antes que lo general. */
const ICONOS_CATEGORIA = [
  [/HEMOGRAMA|SANGRE|HEMATO/, Droplet],
  [/ORINA|URIN/, TestTube],
  [/HEPATO|RENAL|LIPID|GLUC/, Activity],
  [/TOXICO|DROGA/, FlaskConical],
  [/RADIOGRAF|RAYOS|TORAX|COLUMNA/, Bone],
  [/CARDIO|ELECTRO|ERGO/, HeartPulse],
  [/AUDIO|OIDO/, Ear],
  [/OFTALMO|VISION|VISUAL|AGUDEZA/, Eye],
  [/PSICO|ESPECIALIDAD|NEURO/, Brain],
  [/FISICO|CLINICO|EXAMEN/, Stethoscope],
]
function iconoDe(nombre) {
  const n = (nombre ?? "").toUpperCase()
  for (const [patron, Icono] of ICONOS_CATEGORIA) if (patron.test(n)) return Icono
  return FlaskConical
}

/* El punto de las tarjetas de exámenes anteriores. La aptitud tiene
   tres valores y nada más: apto, no apto, pendiente. */
const COLOR_APTITUD = {
  APTO: "bg-success",
  NO_APTO: "bg-danger",
  PENDIENTE: "bg-ink-soft/40",
}

/* La edad es sólo para leerla. El sistema NO la usa para nada: los
   valores de referencia varían por sexo (ref_h / ref_m) y no hay
   ninguna columna por edad. No prometer un control que no existe. */
function edadDe(fechaNac) {
  if (!fechaNac) return null
  const n = new Date(fechaNac + "T00:00:00")
  if (Number.isNaN(n.getTime())) return null
  const hoy = new Date()
  let a = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) a--
  return a
}

export default function NuevaOrdenPage() {
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState([])
  const [baterias, setBaterias] = useState([])
  const [error, setError] = useState(null)

  /* paso 1 */
  const [tipoDoc, setTipoDoc] = useState("DNI")
  const [nroDoc, setNroDoc] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [persona, setPersona] = useState(null)
  const [historial, setHistorial] = useState([])
  const [noEncontrada, setNoEncontrada] = useState(false)
  const [alta, setAlta] = useState(null)

  /* paso 2 */
  const [empresaId, setEmpresaId] = useState("")
  const [busquedaEmpresa, setBusquedaEmpresa] = useState("")
  const [empresaAbierta, setEmpresaAbierta] = useState(false)
  /* Cuál está resaltada con las flechas. En el mostrador se escribe y se
     baja con el teclado sin soltar las manos; obligar a ir al mouse por
     cada empresa es lento. */
  const [empresaMarcada, setEmpresaMarcada] = useState(0)
  const [plantillaId, setPlantillaId] = useState("")
  const [tarea, setTarea] = useState("")
  const [tipoExamen, setTipoExamen] = useState("PRELABORAL")
  const [previa, setPrevia] = useState(null)
  /* Categorías de la batería que esta orden NO lleva. Se elige antes
     de crear: la batería no se toca, sólo esta orden. */
  const [excluidas, setExcluidas] = useState([])
  /* Estudios sueltos que esta orden no lleva, y qué categoría está
     desplegada para poder elegirlos. */
  const [excluidosEst, setExcluidosEst] = useState([])
  const [abierta, setAbierta] = useState(null)

  /* paso 2 · estudios sueltos, además de la batería */
  const [busquedaExtra, setBusquedaExtra] = useState("")
  const [resultadosExtra, setResultadosExtra] = useState([])
  const [categoriasExtra, setCategoriasExtra] = useState([])
  const [extras, setExtras] = useState([])
  const [extraMarcado, setExtraMarcado] = useState(0)
  /* Alta rápida de un estudio que no está en el catálogo. */
  const [nuevoEstudio, setNuevoEstudio] = useState(null)
  const [categoriasCatalogo, setCategoriasCatalogo] = useState([])
  /* Alta rápida de una categoría, cuando el estudio nuevo no entra en
     ninguna de las que hay. */
  const [nuevaCat, setNuevaCat] = useState(null)

  /* paso 3 */
  /* Ficha, historial y corrección de datos, encima del alta. Uno solo
     abierto por vez: son cuatro caminos distintos para la misma orden,
     no cuatro cosas que se miren juntas. */
  const [panel, setPanel] = useState(null)
  const [legajo, setLegajo] = useState(null)
  const [editP, setEditP] = useState(null)
  const [editE, setEditE] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [eligiendoPaginas, setEligiendoPaginas] = useState(false)
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState(null)

  useEffect(() => {
    Promise.all([
      nuevaOrdenService.getEmpresas(),
      nuevaOrdenService.getBaterias(),
      /* Para el alta rápida de un estudio que no está en el catálogo:
         hay que poder elegirle la categoría, que es lo que decide qué
         profesional lo va a cargar. */
      catalogoService.getCategorias(),
    ])
      .then(([e, b, c]) => {
        setEmpresas(e)
        setBaterias(b)
        setCategoriasCatalogo((c ?? []).filter((x) => x.activo))
      })
      .catch((e) => setError(e.message))
  }, [])

  /* La vista previa se pide a la base cada vez que cambia la batería o
     la persona: el sexo cambia qué estudios entran. */
  useEffect(() => {
    if (!plantillaId || !persona) { setPrevia(null); setExcluidas([]); setExcluidosEst([]); return }
    /* Otra batería, otras categorías: lo excluido de la anterior no
       tiene sentido acá. */
    setExcluidas([])
    nuevaOrdenService
      .previsualizar(Number(plantillaId), persona.sexo)
      .then(setPrevia)
      .catch((e) => setError(e.message))
  }, [plantillaId, persona])

  /* Escape cierra el panel abierto. Se registra sólo mientras hay uno:
     si no, se pisa con el Escape del buscador de empresa. */
  useEffect(() => {
    if (!panel && abierta === null) return
    const alTeclear = (ev) => {
      if (ev.key !== "Escape") return
      if (abierta !== null) setAbierta(null)
      else cerrarPanel()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [panel, abierta])

  async function buscar(e) {
    e?.preventDefault()
    setBuscando(true)
    setError(null)
    setPersona(null)
    setHistorial([])
    setNoEncontrada(false)
    setAlta(null)
    try {
      const p = await nuevaOrdenService.buscarPorDocumento(tipoDoc, nroDoc)
      if (p) {
        setPersona(p)
        setHistorial(await nuevaOrdenService.getHistorial(p.id))
      } else {
        setNoEncontrada(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBuscando(false)
    }
  }

  async function darDeAlta(e) {
    e.preventDefault()
    setError(null)
    try {
      const p = await nuevaOrdenService.altaPersona({ ...alta, tipo_doc: tipoDoc, nro_doc: nroDoc })
      setPersona(p)
      setHistorial([])
      setNoEncontrada(false)
      setAlta(null)
    } catch (err) {
      setError(err.message)
    }
  }

  /* Buscar estudios sueltos y categorías enteras. Con retardo, para no
     consultar en cada tecla: la recepcionista escribe rápido y el
     mostrador tiene gente esperando. */
  useEffect(() => {
    const t = busquedaExtra.trim()
    if (t.length < 2) { setResultadosExtra([]); setCategoriasExtra([]); return }
    const id = setTimeout(() => {
      Promise.all([
        nuevaOrdenService.buscarEstudios(t),
        nuevaOrdenService.buscarCategorias(t),
      ])
        .then(([est, cats]) => {
          setResultadosExtra(est.filter((e) => !extras.some((x) => x.id === e.id)))
          /* Sólo tiene sentido ofrecer la categoría si queda algo por
             sumar: si ya están todos sus estudios, el renglón sobra. */
          setCategoriasExtra(
            cats
              .map((c) => ({ ...c, faltan: c.estudios.filter((e) => !extras.some((x) => x.id === e.id)) }))
              .filter((c) => c.faltan.length > 0)
          )
        })
        .catch(() => { setResultadosExtra([]); setCategoriasExtra([]) })
    }, 250)
    return () => clearTimeout(id)
  }, [busquedaExtra, extras])

  function sumarExtra(estudio) {
    setExtras((prev) => (prev.some((e) => e.id === estudio.id) ? prev : [...prev, estudio]))
    limpiarBusqueda()
  }

  function sumarCategoria(categoria) {
    setExtras((prev) => {
      const tengo = new Set(prev.map((e) => e.id))
      return [...prev, ...categoria.faltan.filter((e) => !tengo.has(e.id))]
    })
    limpiarBusqueda()
  }

  function limpiarBusqueda() {
    setBusquedaExtra("")
    setResultadosExtra([])
    setCategoriasExtra([])
    setExtraMarcado(0)
  }

  /* La lista de sugerencias son las categorías primero y después los
     estudios sueltos. Para el teclado son una sola fila continua, así
     que se recorre esa lista unificada. */
  const sugerenciasExtra = [
    ...categoriasExtra.map((c) => ({ tipo: "categoria", dato: c })),
    ...resultadosExtra.map((e) => ({ tipo: "estudio", dato: e })),
  ]

  /* Si la lista se achicó mientras había algo marcado abajo, el índice
     se acota: el resaltado y lo que toma Enter tienen que ser lo mismo. */
  const extraMarcadoReal = Math.min(extraMarcado, Math.max(0, sugerenciasExtra.length - 1))

  function teclasExtra(ev) {
    const n = sugerenciasExtra.length
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!n) return
      ev.preventDefault()
      const paso = ev.key === "ArrowDown" ? 1 : -1
      setExtraMarcado((i) => (i + paso + n) % n)
      return
    }
    if (ev.key === "Enter") {
      if (!n) return
      ev.preventDefault()
      const s = sugerenciasExtra[extraMarcadoReal]
      if (s.tipo === "categoria") sumarCategoria(s.dato)
      else sumarExtra(s.dato)
      return
    }
    if (ev.key === "Escape") limpiarBusqueda()
  }

  const quitarExtra = (id) => setExtras((prev) => prev.filter((e) => e.id !== id))

  /* Crear un estudio que no está en el catálogo, sin salir del alta.

     Pasa de verdad: la empresa pide algo que la clínica todavía no tiene
     cargado y el paciente está en el mostrador. Antes había que irse a
     Estudios y Categorías —perdiendo la orden a medio hacer—, cargarlo,
     y volver a empezar.

     Lo crea con lo mínimo: nombre y categoría. La unidad y los valores
     de referencia se completan después en el catálogo, con la
     bioquímica, que es quien sabe. Un estudio sin referencia se carga
     igual; simplemente no se compara nada. */
  /* Crear una categoría sin salir del alta.

     El rol es obligatorio: es lo que decide qué profesional va a ver
     esos estudios en su bandeja. Una categoría sin rol deja los
     estudios sin dueño, y eso no se nota hasta que la orden no cierra
     porque nadie los cargó nunca. */
  async function crearCategoria(e) {
    e.preventDefault()
    setError(null)
    try {
      const creada = await catalogoService.guardarCategoria({
        nombre: nuevaCat.nombre,
        rol_carga: nuevaCat.rol_carga,
        valor_defecto: nuevaCat.valor_defecto || "NORMAL",
        orden: 99,
      })
      setCategoriasCatalogo((prev) => [...prev, creada])
      setNuevoEstudio((prev) => ({ ...prev, categoriaId: String(creada.id) }))
      setNuevaCat(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function crearEstudioSuelto(e) {
    e.preventDefault()
    setError(null)
    try {
      const creado = await catalogoService.guardarEstudio(
        {
          nombre: nuevoEstudio.nombre,
          unidad: nuevoEstudio.unidad,
          ref_h: nuevoEstudio.ref_h,
          /* Si sólo se carga la del varón, se usa para los dos. Es
             mejor que dejar la mujer sin nada: peor sería no comparar. */
          ref_m: nuevoEstudio.ref_m || nuevoEstudio.ref_h,
          orden: 99,
        },
        Number(nuevoEstudio.categoriaId)
      )
      const cat = categoriasCatalogo.find((c) => String(c.id) === String(nuevoEstudio.categoriaId))
      sumarExtra({ ...creado, categoria: { id: cat.id, nombre: cat.nombre } })
      setNuevoEstudio(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      const id = await nuevaOrdenService.crear({
        personaId: persona.id,
        empresaId: Number(empresaId),
        /* Sin batería va en nulo, NO en cero: Number("") es 0, y un cero
           haría fallar la clave foránea contra plantilla. */
        plantillaId: plantillaId ? Number(plantillaId) : null,
        tarea,
        tipoExamen,
      })

      /* Los sueltos van después de crear la orden: crear_orden() arma la
         batería, y esto agrega lo que la batería no traía.

         Si el estudio YA venía en la batería, agregarEstudio() rechaza
         por clave repetida. Eso no es un error para quien está en el
         mostrador —el estudio va a estar igual, que es lo que quería— y
         no puede tirar abajo un alta que ya se hizo. Se saltea y se
         sigue; cualquier otra falla sí se informa. */
      if (extras.length) {
        const fallaron = []
        for (const e of extras) {
          try {
            await nuevaOrdenService.agregarEstudio(id, e)
          } catch (err) {
            if (!/ya está en la orden/i.test(err.message)) fallaron.push(e.nombre)
          }
        }
        await nuevaOrdenService.recalcularImporte(id)
        if (fallaron.length) setError(`No se pudieron agregar: ${fallaron.join(", ")}`)
      }

      /* Lo que se sacó de la batería. Va después de crear porque
         crear_orden() arma siempre la batería entera, y eso no se
         toca: es lo que garantiza que dos altas a la vez no se pisen. */
      if (excluidas.length || excluidosEst.length) {
        if (excluidas.length) await nuevaOrdenService.quitarCategorias(id, excluidas)
        /* Los sueltos que estén dentro de una categoría ya excluida
           sobran: ya se fueron con ella. */
        const sueltos = excluidosEst.filter((eid) =>
          !previa?.categorias.some((c) => excluidas.includes(c.id) && c.estudios.some((e) => e.id === eid))
        )
        if (sueltos.length) await nuevaOrdenService.quitarEstudiosDeOrden(id, sueltos)
        await nuevaOrdenService.recalcularImporte(id)
      }

      setCreada(await nuevaOrdenService.getOrdenCreada(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  function cerrarPanel() {
    setPanel(null)
    setEditP(null)
    setEditE(null)
    setLegajo(null)
  }

  /* El historial completo, no los cuatro últimos que muestra el paso 1.
     Se pide al abrir y no antes: la mayoría de las altas no lo miran. */
  async function verHistorial() {
    setPanel("historial")
    setLegajo(null)
    try {
      setLegajo(await aptitudService.getLegajo(persona.id))
    } catch (err) {
      setError(err.message)
      cerrarPanel()
    }
  }

  /* RF05 · el padrón lo mantienen Recepción y el Administrador. Un
     apellido mal tipeado se corrige acá y sigue el alta.

     Si cambia el SEXO cambian los estudios que se abren, así que al
     reemplazar la persona la vista previa se vuelve a pedir sola: el
     efecto que la calcula depende de este estado. */
  async function guardarPersona(ev) {
    ev.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const g = await aptitudService.guardarPersona(editP)
      setPersona(g)
      cerrarPanel()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  /* La empresa se corrige sin salir: el CUIT mal cargado aparece
     justamente cuando se está abriendo una orden para esa empresa. */
  async function guardarEmpresa(ev) {
    ev.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const g = await recepcionService.guardarEmpresa(editE)
      setEmpresas((prev) => prev.map((x) => (x.id === g.id ? { ...x, ...g } : x)))
      cerrarPanel()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  function empezarDeNuevo() {
    setCreada(null)
    setPersona(null)
    setHistorial([])
    setNroDoc("")
    setEmpresaId("")
    setBusquedaEmpresa("")
    setEmpresaAbierta(false)
    setPlantillaId("")
    setTarea("")
    setPrevia(null)
    setNoEncontrada(false)
    /* Sin esto, el siguiente paciente hereda los estudios sueltos del
       anterior: se los cobran y se los hacen, sin que nadie lo note. */
    setExtras([])
    setExcluidas([])
    setBusquedaExtra("")
    setResultadosExtra([])
    setError(null)
  }

  /* ---------------- orden creada ---------------- */
  if (creada) {
    const p = creada.persona
    return (
      <AppShell titulo="Orden creada" subtitulo={`N° ${creada.numero}`}>
        <div className="max-w-2xl rounded-card border-2 border-success/30 bg-success/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Check size={20} className="text-success" />
            <p className="text-base font-medium text-success">
              Orden N° {creada.numero} creada
            </p>
          </div>

          <dl className="mb-5 grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-ink-soft">Paciente</dt>
            <dd className="text-ink">{p.apellido}, {p.nombre} · {p.tipo_doc} {p.nro_doc}</dd>
            <dt className="text-ink-soft">Empresa</dt>
            <dd className="text-ink">{creada.empresa?.razon_social}</dd>
            <dt className="text-ink-soft">Importe</dt>
            <dd className="text-ink">
              $ {Number(creada.importe).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </dd>
            <dt className="text-ink-soft">Vence</dt>
            <dd className="text-ink">{creada.fecha_vencimiento}</dd>
          </dl>

          <div className="flex gap-2">
            <MenuImpreso
              etiqueta="Hoja de ruta"
              destacado
              onImprimir={() => imprimirHojaDeRuta(creada.id)}
              onElegirPaginas={() => setEligiendoPaginas(true)}
            />
            <button
              onClick={() => navigate(`/orden/${creada.id}/estudios`)}
              className="rounded-md border-2 border-ink-soft/20 px-4 py-2.5 text-sm font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
            >
              Agregar o quitar estudios
            </button>
            <button
              onClick={() => navigate(`/carga/${creada.id}`)}
              className="rounded-md border-2 border-ink-soft/20 px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              Ver la orden
            </button>
            <button
              onClick={empezarDeNuevo}
              className="ml-auto rounded-md border-2 border-ink-soft/20 px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              Cargar otra
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-soft">
            La hoja de ruta acompaña al paciente por cada puesto. Va con las
            columnas en blanco: se llenan a mano y después se cargan. Sale una
            página por categoría; con «Elegir qué páginas» se sacan las de los
            puestos por los que no va a pasar.
          </p>
        </div>

        {eligiendoPaginas && (
          <ElegirPaginas ordenId={creada.id} onCerrar={() => setEligiendoPaginas(false)} />
        )}
      </AppShell>
    )
  }

  /* ---------------- el formulario ---------------- */
  /* La batería dejó de ser obligatoria: alguien puede venir sólo por una
     audiometría. Lo que sí hace falta es que la orden tenga ALGO — una
     batería, o al menos un estudio suelto—, para que nadie cree por
     descuido una orden vacía que después nadie entiende. */
  /* Cuántos estudios va a tener la orden de verdad: la batería según el
     sexo, menos lo que se sacó, más los sueltos.

     Antes el botón sólo miraba si HABÍA una batería elegida, sin mirar
     lo excluido. Sacándole las seis categorías a BASICO DE LEY el
     contador decía 0 y el botón seguía activo: se creaba una orden con
     número y sin un solo estudio. Y las órdenes no se borran. */
  const deLaBateria = previa
    ? previa.total - previa.categorias.reduce((s, c) =>
        s + (excluidas.includes(c.id)
          ? c.estudios.length
          : c.estudios.filter((e) => excluidosEst.includes(e.id)).length), 0)
    : 0
  const totalDeLaOrden = deLaBateria + extras.length
  const listoParaCrear = persona && empresaId && totalDeLaOrden > 0

  const empresaElegida = empresas.find((e) => String(e.id) === String(empresaId)) ?? null

  /* Un examen vigente es uno cuyo vencimiento todavía no pasó. Antes el
     aviso salía con sólo tener historial, aunque el último fuera de
     2019: un cartel que aparece siempre no lo lee nadie, y el día que
     importa tampoco. */
  const bateriaElegida = baterias.find((b) => String(b.id) === String(plantillaId)) ?? null

  /* La categoría que se está mirando en detalle. Se abre en un panel y
     no dentro de la columna: ORINA COMPLETA son dieciséis estudios, y
     ahí adentro entraban a 11 px con la ✕ escondida en el hover. */
  const catAbierta = previa?.categorias.find((c) => c.id === abierta) ?? null

  const hoyISO = new Date().toISOString().slice(0, 10)
  const vigente = historial.find((o) => o.fecha_vencimiento && o.fecha_vencimiento >= hoyISO)

  /* Teclado en el buscador de empresa: flechas para moverse, Enter para
     tomar la marcada, Escape para cerrar. En el mostrador se escribe y
     se elige sin soltar el teclado. */
  function teclasEmpresa(ev) {
    if (empresaElegida) return
    const n = empresasFiltradas.length
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault()
      if (!empresaAbierta) { setEmpresaAbierta(true); return }
      if (!n) return
      const paso = ev.key === "ArrowDown" ? 1 : -1
      setEmpresaMarcada((i) => (i + paso + n) % n)
      return
    }
    if (ev.key === "Enter") {
      if (!empresaAbierta || !n) return
      ev.preventDefault()
      const e = empresasFiltradas[Math.min(empresaMarcada, n - 1)]
      setEmpresaId(String(e.id))
      setBusquedaEmpresa("")
      setEmpresaAbierta(false)
      return
    }
    if (ev.key === "Escape") { setEmpresaAbierta(false) }
  }

  /* Se compara sin acentos y sin distinguir mayúsculas: quien escribe
     "belgrano" tiene que encontrar "BELGRANO CARGAS", y quien escribe
     "capo" tiene que encontrar "AUTOSERVICIO CAPO" aunque no empiece
     con eso. */
  const sinTildes = (s) =>
    (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const empresasFiltradas = busquedaEmpresa.trim()
    ? empresas.filter((e) => sinTildes(e.razon_social).includes(sinTildes(busquedaEmpresa.trim())))
    : empresas

  return (
    <AppShell titulo="Nueva Orden" subtitulo="Admisión y alta de orden">
      {error && (
        <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-md border-2 border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Los pasos 1 y 2 toman lo que haya; el resumen tiene un ancho
          propio para que no se le trunquen los nombres de categoría.
          Abajo de 1024 px se apila: el resumen queda al final, que es
          el orden en que se completa igual. */}
      <div className="grid max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Paso 1 · quién es. Cabecera con número, título y una línea
              que dice qué se hace acá: la pantalla la usa gente que
              recién entra, no sólo quien ya la conoce de memoria. */}
          <Paso
            n="1"
            titulo="Persona"
            subtitulo="Buscá por tipo y número de documento para cargar sus datos."
            extra={
              <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-ink-soft/15 bg-ink-soft/5 px-2.5 py-1.5 text-[11px] text-ink-soft lg:flex">
                <Keyboard size={13} /> Atajo: presioná Enter para buscar
              </span>
            }
          >
            <form onSubmit={buscar} className="flex gap-2">
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                className="rounded-md border border-ink-soft/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                {TIPO_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="relative flex-1">
                <input
                  autoFocus
                  value={nroDoc}
                  onChange={(e) => setNroDoc(e.target.value)}
                  placeholder="Número de documento"
                  className="w-full rounded-md border border-ink-soft/25 py-2.5 pl-3.5 pr-9 text-sm outline-none focus:border-primary"
                />
                {nroDoc && (
                  <button
                    type="button"
                    onClick={() => setNroDoc("")}
                    title="Borrar"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!nroDoc.trim() || buscando}
                className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Search size={15} /> {buscando ? "Buscando…" : "Buscar"}
              </button>
            </form>

            {persona && (
              <div className="mt-4 rounded-lg border border-success/25 bg-success/[0.06] p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <User size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-ink">
                        {persona.apellido}, {persona.nombre}
                      </p>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                        Persona encontrada
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                      <span>{persona.tipo_doc} {persona.nro_doc}</span>
                      <span className="text-ink-soft/30">|</span>
                      <span>{persona.sexo === "F" ? "Femenino" : "Masculino"}</span>
                      {edadDe(persona.fecha_nac) !== null && (
                        <>
                          <span className="text-ink-soft/30">|</span>
                          <span>{edadDe(persona.fecha_nac)} años</span>
                        </>
                      )}
                      {persona.fecha_nac && (
                        <>
                          <span className="text-ink-soft/30">|</span>
                          <span className="tabular-nums">{persona.fecha_nac}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {/* Ver ficha y ver historial abren encima; corregir los datos
                      está en el resumen, al lado de lo que se va a crear. */}
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button
                      onClick={() => setPanel("ficha")}
                      className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                    >
                      <FileText size={13} /> Ver ficha
                    </button>
                    <button
                      onClick={verHistorial}
                      className="flex items-center gap-1.5 rounded-md border border-ink-soft/20 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
                    >
                      <Clock size={13} /> Ver historial
                    </button>
                  </div>
                </div>

                {/* Los exámenes anteriores como tarjetas y no como renglones:
                    lo que se mira es la fecha y si dio apto, y eso se lee de
                    reojo en una tarjeta y no en una línea corrida. */}
                {historial.length > 0 ? (
                  <div className="mt-3.5 flex flex-wrap items-start gap-3 border-t border-success/20 pt-3">
                    <p className="shrink-0 pt-1.5 text-xs text-ink-soft">Últimos estudios</p>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      {historial.slice(0, 4).map((o) => (
                        <div
                          key={o.id}
                          className="min-w-[7.5rem] flex-1 rounded-md border border-ink-soft/15 bg-white px-2.5 py-2"
                        >
                          <p className="text-[11px] tabular-nums text-ink-soft">{o.fecha}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                COLOR_APTITUD[o.aptitud] ?? "bg-ink-soft/40"
                              }`}
                            />
                            {TIPO_EXAMEN_LABEL[o.tipo_examen] ?? o.tipo_examen}
                          </p>
                          <p className="text-[11px] text-ink-soft">
                            {o.aptitud === "PENDIENTE"
                              ? ETIQUETA_ESTADO[o.estado]
                              : ETIQUETA_APTITUD[o.aptitud]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-soft">Es su primer examen acá.</p>
                )}
              </div>
            )}

            {/* Sólo si de verdad hay uno sin vencer. */}
            {vigente && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3.5 py-3 text-sm text-warning">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Tiene un examen vigente hasta el {vigente.fecha_vencimiento}.
                  Confirmá con la empresa si corresponde generar una orden nueva.
                </span>
              </div>
            )}

            {noEncontrada && !alta && (
              <div className="mt-4 rounded-md border-2 border-ink-soft/20 p-3.5">
                <p className="text-sm text-ink">No está en el padrón.</p>
                <p className="mb-3 text-xs text-ink-soft">
                  {tipoDoc} {nroDoc} no figura. Si es la primera vez que viene, dala de alta.
                </p>
                <button
                  onClick={() => setAlta({ apellido: "", nombre: "", sexo: "M", fecha_nac: "" })}
                  className="flex items-center gap-1.5 rounded-md border-2 border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/5"
                >
                  <UserPlus size={14} /> Dar de alta
                </button>
              </div>
            )}

            {alta && (
              <form onSubmit={darDeAlta} className="mt-4 rounded-md border-2 border-ink-soft/20 p-3.5">
                <p className="mb-3 text-sm font-medium text-ink">
                  Alta de {tipoDoc} {nroDoc}
                </p>
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Apellido" requerido
                    valor={alta.apellido} onCambio={(v) => setAlta({ ...alta, apellido: v })} />
                  <Campo label="Nombre" requerido
                    valor={alta.nombre} onCambio={(v) => setAlta({ ...alta, nombre: v })} />
                  <div>
                    <label className="mb-1 block text-xs text-ink-soft">
                      Sexo <span className="text-danger">*</span>
                    </label>
                    <select
                      value={alta.sexo}
                      onChange={(e) => setAlta({ ...alta, sexo: e.target.value })}
                      className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Decide qué estudios se abren y contra qué valores se comparan.
                    </p>
                  </div>
                  <Campo label="Fecha de nacimiento" tipo="date"
                    valor={alta.fecha_nac} onCambio={(v) => setAlta({ ...alta, fecha_nac: v })} />
                  <Campo label="Teléfono"
                    valor={alta.telefono ?? ""} onCambio={(v) => setAlta({ ...alta, telefono: v })} />
                  <Campo label="Domicilio"
                    valor={alta.domicilio ?? ""} onCambio={(v) => setAlta({ ...alta, domicilio: v })} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!alta.apellido.trim() || !alta.nombre.trim()}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlta(null)}
                    className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </Paso>

          {/* Paso 2 · para quién y qué. Apagado hasta que haya persona:
              el orden importa, porque el sexo decide los estudios. */}
          <Paso
            n="2"
            titulo="Empresa y batería"
            subtitulo="Elegí la empresa, la batería y para qué puesto es el examen."
            apagado={!persona}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">
                  Empresa <span className="text-danger">*</span>
                </label>
                {/* Se escribe y filtra, en vez de un desplegable de 38
                    que obliga a scrollear con el paciente adelante. La
                    lista está toda en memoria, así que filtra sin ir a
                    la base: no hay espera entre tecla y tecla. */}
                <div className="relative">
                  <div className={`flex items-center gap-2 rounded-md border-2 px-2.5 py-2 ${
                    empresaElegida ? "border-ink-soft/20" : "border-ink-soft/20 focus-within:border-primary"
                  } ${!persona ? "bg-ink-soft/5" : ""}`}>
                    <Search size={15} className="shrink-0 text-ink-soft" />
                    <input
                      disabled={!persona}
                      value={empresaElegida ? empresaElegida.razon_social : busquedaEmpresa}
                      onChange={(e) => {
                        setBusquedaEmpresa(e.target.value)
                        setEmpresaId("")
                        setEmpresaMarcada(0)
                        setEmpresaAbierta(true)
                      }}
                      onFocus={() => setEmpresaAbierta(true)}
                      onBlur={() => setTimeout(() => setEmpresaAbierta(false), 150)}
                      onKeyDown={teclasEmpresa}
                      placeholder="Escribí el nombre…"
                      className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {/* Corregir los datos de la empresa es distinto de cambiar
                        de empresa: el lápiz abre la ficha, la ✕ la suelta. */}
                    {empresaElegida && (
                      <>
                        <button
                          onClick={() => { setEditE({ ...empresaElegida }); setPanel("editarEmpresa") }}
                          title="Editar los datos de la empresa"
                          className="shrink-0 text-ink-soft hover:text-primary"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { setEmpresaId(""); setBusquedaEmpresa(""); setEmpresaAbierta(true) }}
                          title="Cambiar de empresa"
                          className="shrink-0 text-ink-soft hover:text-danger"
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  {empresaAbierta && !empresaElegida && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-soft/15 bg-white shadow-lg">
                      {empresasFiltradas.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-ink-soft">
                          Ninguna empresa con «{busquedaEmpresa}». Se dan de alta en Empresas.
                        </p>
                      ) : (
                        empresasFiltradas.map((e, i) => (
                          <button
                            key={e.id}
                            /* El ratón también marca, así no quedan dos
                               resaltados peleándose: el del teclado y el
                               de dónde está el puntero. */
                            onMouseEnter={() => setEmpresaMarcada(i)}
                            onMouseDown={() => { setEmpresaId(String(e.id)); setBusquedaEmpresa(""); setEmpresaAbierta(false) }}
                            className={`block w-full px-3 py-2 text-left text-sm ${
                              i === Math.min(empresaMarcada, empresasFiltradas.length - 1)
                                ? "bg-primary/10 text-primary"
                                : "text-ink"
                            }`}
                          >
                            {e.razon_social}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">
                  Batería <span className="text-ink-soft/60">(o estudios sueltos)</span>
                </label>
                <select
                  disabled={!persona}
                  value={plantillaId}
                  onChange={(e) => setPlantillaId(e.target.value)}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary disabled:bg-ink-soft/5"
                >
                  <option value="">Elegir…</option>
                  {baterias.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Tipo de examen</label>
                <select
                  disabled={!persona}
                  value={tipoExamen}
                  onChange={(e) => setTipoExamen(e.target.value)}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary disabled:bg-ink-soft/5"
                >
                  {TIPO_EXAMEN.map((t) => (
                    <option key={t} value={t}>{TIPO_EXAMEN_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <Campo label="Tarea / puesto" deshabilitado={!persona}
                valor={tarea} onCambio={setTarea} />
            </div>

            {/* Lo que va a hacer el sistema con lo que se acaba de elegir.

                Las cuatro cosas son verificables: el sexo filtra los
                estudios y elige la columna de referencia, la batería trae
                los suyos, la empresa queda como titular y el importe lo
                congela la base. La EDAD no interviene en nada —la tabla
                estudio tiene ref_h y ref_m y nada más— y la empresa no
                agrega estudios propios: eso es RF09 y todavía no está.
                Prometerlos acá sería mentirle a quien carga. */}
            {persona && (
              <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-primary/20 bg-primary/[0.05] p-3.5">
                <div className="flex min-w-[13rem] flex-1 items-start gap-2.5">
                  <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Info size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ink">Tené en cuenta</p>
                    <p className="text-[11px] leading-snug text-ink-soft">
                      Los estudios y los valores de referencia salen del sexo de
                      la persona. La edad no interviene.
                    </p>
                  </div>
                </div>
                <div className="grid min-w-[16rem] flex-[2] grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Nota
                    icono={<User size={13} />}
                    titulo={`Sexo: ${persona.sexo === "F" ? "Femenino" : "Masculino"}`}
                    pie="Decide qué estudios se abren."
                  />
                  <Nota
                    icono={<Layers size={13} />}
                    titulo={bateriaElegida ? `Batería: ${bateriaElegida.nombre}` : "Sin batería"}
                    pie={previa
                      ? `${previa.total} estudios para este sexo.`
                      : "Se puede abrir con estudios sueltos."}
                  />
                  <Nota
                    icono={<Building2 size={13} />}
                    titulo={empresaElegida ? empresaElegida.razon_social : "Sin empresa"}
                    pie="La orden queda a su nombre."
                  />
                  <Nota
                    icono={<Lock size={13} />}
                    titulo="Importe"
                    pie="Lo calcula la base al crear y queda congelado."
                  />
                </div>
              </div>
            )}

            {/* Estudios sueltos, además de la batería.
                Antes esto obligaba a crear la orden, irse a otra pantalla,
                buscar el estudio entre 120 y volver — con el paciente
                esperando en el mostrador. Ahora se agregan acá y salen ya
                en la hoja de ruta, sin salir de la pantalla. */}
            <div className="mt-5 border-t border-ink-soft/10 pt-4">
              <label className="mb-1.5 block text-xs text-ink-soft">
                ¿Algo más, además de la batería? <span className="text-ink-soft/60">(opcional)</span>
              </label>

              {/* Crear queda a la vista SIEMPRE, al lado del buscador.
                  Antes vivía al pie de la lista de resultados: buscar «exa»
                  encontraba EXAMEN NEUROLOGICO y con eso ya no había forma
                  de crear uno nuevo. */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                <div className="flex items-center gap-2 rounded-md border border-ink-soft/25 px-3 py-2 focus-within:border-primary">
                  <Search size={15} className="shrink-0 text-ink-soft" />
                  <input
                    disabled={!persona}
                    value={busquedaExtra}
                    onChange={(e) => { setBusquedaExtra(e.target.value); setExtraMarcado(0) }}
                    onKeyDown={teclasExtra}
                    placeholder="Buscar un estudio por nombre o código…"
                    className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
                  />
                </div>

                {/* En el flujo y no flotando: el buscador es lo último de la
                    tarjeta, así que un desplegable absoluto quedaba cortado
                    por el borde. Así la tarjeta crece y no tapa nada. */}
                {busquedaExtra.trim().length >= 2 && (
                  <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-ink-soft/15 bg-white">
                    {/* Las categorías van arriba: si alguien busca "radio"
                        casi seguro quiere las quince radiografías, no ir
                        eligiéndolas de a una. */}
                    {categoriasExtra.map((c, i) => (
                      <button
                        key={`cat-${c.id}`}
                        onMouseEnter={() => setExtraMarcado(i)}
                        onClick={() => sumarCategoria(c)}
                        className={`flex w-full items-center gap-2 border-b border-ink-soft/10 px-3 py-2 text-left text-sm ${
                          i === extraMarcadoReal ? "bg-primary/15" : "bg-primary/5"
                        }`}
                      >
                        <Layers size={14} className="shrink-0 text-primary" />
                        <span className="flex-1 font-medium text-primary">{c.nombre}</span>
                        <span className="text-xs text-primary/70">
                          {c.faltan.length} estudio{c.faltan.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}
                    {resultadosExtra.map((e, j) => {
                      /* Las categorías van primero, así que el índice del
                         estudio arranca después de ellas. */
                      const i = categoriasExtra.length + j
                      return (
                        <button
                          key={e.id}
                          onMouseEnter={() => setExtraMarcado(i)}
                          onClick={() => sumarExtra(e)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                            i === extraMarcadoReal ? "bg-primary/10" : ""
                          }`}
                        >
                          <Plus size={14} className="shrink-0 text-primary" />
                          <span className="flex-1 text-ink">{e.nombre}</span>
                          <span className="text-xs text-ink-soft">{e.categoria?.nombre}</span>
                        </button>
                      )
                    })}
                    {/* Crear va SIEMPRE, no sólo cuando no hay resultados. Buscar
                        "exa" encuentra EXAMEN NEUROLOGICO, y con la versión anterior
                        eso alcanzaba para que no se pudiera crear uno nuevo. */}
                    <button
                      onClick={() =>
                        setNuevoEstudio({ nombre: busquedaExtra.trim().toUpperCase(), categoriaId: "", unidad: "", ref_h: "", ref_m: "" })
                      }
                      className="flex w-full items-center gap-2 border-t border-ink-soft/10 bg-ink-soft/5 px-3 py-2 text-left text-sm text-primary hover:bg-primary/5"
                    >
                      <Plus size={14} className="shrink-0" />
                      Crear «{busquedaExtra.trim().toUpperCase()}» en el catálogo
                    </button>
                  </div>
                )}
                </div>
                <button
                  type="button"
                  disabled={!persona}
                  onClick={() =>
                    setNuevoEstudio({
                      nombre: busquedaExtra.trim().toUpperCase(), categoriaId: "",
                      unidad: "", ref_h: "", ref_m: "",
                    })
                  }
                  title="Crear un estudio que no está en el catálogo"
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-ink-soft/25 bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:border-primary/50 hover:text-primary disabled:opacity-40"
                >
                  <Plus size={15} /> Crear nuevo
                </button>
              </div>

              {nuevoEstudio && (
                <form
                  onSubmit={crearEstudioSuelto}
                  className="mt-2 rounded-md border-2 border-primary/30 bg-primary/5 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-ink">Estudio nuevo</p>

                  {nuevaCat && (
                    <div className="mb-3 rounded-md border-2 border-primary/25 bg-white p-2.5">
                      <p className="mb-2 text-[11px] font-medium text-ink">Categoría nueva</p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-40 flex-1">
                          <label className="mb-1 block text-[11px] text-ink-soft">Nombre</label>
                          <input
                            autoFocus
                            value={nuevaCat.nombre}
                            onChange={(ev) => setNuevaCat({ ...nuevaCat, nombre: ev.target.value.toUpperCase() })}
                            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="min-w-44">
                          <label className="mb-1 block text-[11px] text-ink-soft">Quién la carga</label>
                          <select
                            value={nuevaCat.rol_carga}
                            onChange={(ev) => setNuevaCat({ ...nuevaCat, rol_carga: ev.target.value })}
                            className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                          >
                            <option value="">Elegir…</option>
                            {Object.entries(ETIQUETA_ROL)
                              .filter(([codigo]) => codigo !== "R1" && codigo !== "R2")
                              .map(([codigo, nombre]) => (
                                <option key={codigo} value={codigo}>{nombre}</option>
                              ))}
                          </select>
                        </div>
                        <div className="min-w-32">
                          <label className="mb-1 block text-[11px] text-ink-soft">Arranca en</label>
                          <input
                            value={nuevaCat.valor_defecto}
                            onChange={(ev) => setNuevaCat({ ...nuevaCat, valor_defecto: ev.target.value.toUpperCase() })}
                            placeholder="NORMAL"
                            className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={crearCategoria}
                          disabled={!nuevaCat.nombre.trim() || !nuevaCat.rol_carga}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                        >
                          Crear categoría
                        </button>
                        <button
                          type="button"
                          onClick={() => setNuevaCat(null)}
                          className="rounded-md border-2 border-ink-soft/20 px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-ink-soft">
                        Quién la carga decide en qué bandeja aparecen sus estudios.
                        Sin eso quedan sin dueño y la orden nunca cierra.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-48 flex-1">
                      <label className="mb-1 block text-[11px] text-ink-soft">Nombre</label>
                      <input
                        autoFocus
                        value={nuevoEstudio.nombre}
                        onChange={(ev) => setNuevoEstudio({ ...nuevoEstudio, nombre: ev.target.value.toUpperCase() })}
                        className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="min-w-44">
                      <label className="mb-1 block text-[11px] text-ink-soft">Categoría</label>
                      <select
                        value={nuevoEstudio.categoriaId}
                        onChange={(ev) => setNuevoEstudio({ ...nuevoEstudio, categoriaId: ev.target.value })}
                        className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                      >
                        <option value="">Elegir…</option>
                        {categoriasCatalogo.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {/* Crear la categoría acá mismo. Lo pidió la clínica: si el
                        estudio nuevo no entra en ninguna, irse a otra pantalla
                        es perder la orden a medio hacer. */}
                    {!nuevaCat && (
                      <button
                        type="button"
                        onClick={() => setNuevaCat({ nombre: "", rol_carga: "", valor_defecto: "NORMAL" })}
                        className="whitespace-nowrap rounded-md border-2 border-ink-soft/20 px-2.5 py-1.5 text-xs text-ink-soft hover:border-primary/50 hover:text-primary"
                      >
                        + Categoría
                      </button>
                    )}
                    </div>

                    {/* Unidad y referencias, opcionales.

                        No se piden como obligatorias porque quien está en el mostrador
                        muchas veces no las sabe. Pero si las sabe —la empresa las mandó
                        por escrito, vienen en el pedido— tiene que poder ponerlas acá:
                        "después lo completa la bioquímica" es la forma más segura de que
                        no se complete nunca, y un estudio sin referencia no se compara
                        con nada. */}
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div className="w-28">
                        <label className="mb-1 block text-[11px] text-ink-soft">Unidad</label>
                        <input
                          value={nuevoEstudio.unidad}
                          onChange={(ev) => setNuevoEstudio({ ...nuevoEstudio, unidad: ev.target.value })}
                          placeholder="%, g/l…"
                          className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                        />
                      </div>
                      <div className="w-32">
                        <label className="mb-1 block text-[11px] text-ink-soft">Referencia varón</label>
                        <input
                          value={nuevoEstudio.ref_h}
                          onChange={(ev) => setNuevoEstudio({ ...nuevoEstudio, ref_h: ev.target.value })}
                          placeholder="43-53"
                          className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                        />
                      </div>
                      <div className="w-32">
                        <label className="mb-1 block text-[11px] text-ink-soft">Referencia mujer</label>
                        <input
                          value={nuevoEstudio.ref_m}
                          onChange={(ev) => setNuevoEstudio({ ...nuevoEstudio, ref_m: ev.target.value })}
                          placeholder="igual que varón"
                          className="w-full rounded-md border-2 border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                        />
                      </div>
                      <p className="flex-1 text-[11px] text-ink-soft">
                        {avisoReferencia(nuevoEstudio)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                    <button
                      type="submit"
                      disabled={!nuevoEstudio.nombre.trim() || !nuevoEstudio.categoriaId}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Crear y agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoEstudio(null)}
                      className="rounded-md border-2 border-ink-soft/20 px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-soft">

                    La categoría decide qué profesional lo va a cargar. La unidad
                    y los valores de referencia se completan después en Estudios
                    y Categorías, con la bioquímica.
                  </p>
                </form>
              )}

              {extras.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extras.map((e) => (
                    <span
                      key={e.id}
                      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary"
                    >
                      {e.nombre}
                      <button onClick={() => quitarExtra(e.id)} title="Quitar">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Paso>
        </div>

        {/* Paso 3 · lo que se va a crear.

            Es la única parte que se lee de verdad antes de confirmar, así
            que va lo importante arriba: cuántos estudios, para quién y de
            qué empresa. El detalle queda abajo, plegado. */}
        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-card border border-ink-soft/15 bg-white p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                3
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-tight text-ink">Resumen de la orden</p>
                <p className="text-xs text-ink-soft">Revisá todo antes de crearla.</p>
              </div>
              {listoParaCrear && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[10px] font-medium text-success">
                  <Check size={11} /> Lista para crear
                </span>
              )}
            </div>

            {/* El número grande es el que recepción le dice al paciente.
                Las tres cifras de abajo explican de dónde sale, para que no
                haya que reconstruirlo de memoria: batería + sueltos. */}
            {/* Apilados y no lado a lado: el resumen mide 430 px, y tres
                cifras en la mitad de eso dejan 60 px por rótulo — ahí
                «Categorías» no entra. Así cada una tiene 130. */}
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-primary">
                  <FileText size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs leading-tight text-ink-soft">Total de estudios</p>
                  <p className="text-3xl font-semibold leading-tight text-ink">{totalDeLaOrden}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-soft/15 bg-ink-soft/15">
                <Cifra k="Categorías" v={previa ? previa.categorias.filter((c) => !excluidas.includes(c.id)).length : 0} />
                <Cifra k="Batería" v={deLaBateria} />
                <Cifra k="Sueltos" v={extras.length} />
              </div>
            </div>

            {/* Persona y empresa, con su lápiz: el error de tipeo aparece
                justo acá, mirando el resumen antes de confirmar. */}
            <div className="mb-4 flex flex-col gap-3">
              {persona && (
                <FilaResumen
                  icono={<User size={15} />}
                  titulo="Persona"
                  principal={`${persona.apellido}, ${persona.nombre}`}
                  detalle={[
                    `${persona.tipo_doc} ${persona.nro_doc}`,
                    persona.sexo === "F" ? "Femenino" : "Masculino",
                    edadDe(persona.fecha_nac) !== null ? `${edadDe(persona.fecha_nac)} años` : null,
                  ].filter(Boolean).join("  ·  ")}
                  onEditar={() => { setEditP({ ...persona }); setPanel("editarPersona") }}
                />
              )}
              {empresaElegida && (
                <FilaResumen
                  icono={<Building2 size={15} />}
                  titulo="Empresa"
                  principal={empresaElegida.razon_social}
                  detalle={[
                    TIPO_EXAMEN_LABEL[tipoExamen],
                    bateriaElegida?.nombre,
                    tarea.trim() || null,
                  ].filter(Boolean).join("  ·  ")}
                  onEditar={() => { setEditE({ ...empresaElegida }); setPanel("editarEmpresa") }}
                />
              )}
            </div>

            {!previa && extras.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink-soft/25 px-3 py-4 text-center text-xs text-ink-soft">
                Elegí la persona y la batería para ver los estudios. Si viene
                por un estudio suelto, alcanza con buscarlo a la izquierda.
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-baseline justify-between gap-2 border-t border-ink-soft/10 pt-3">
                  <p className="text-base font-semibold text-ink">
                    Estudios incluidos
                  </p>
                  <p className="shrink-0 text-[13px] text-ink-soft">
                    {totalDeLaOrden} estudio{totalDeLaOrden === 1 ? "" : "s"}
                  </p>
                </div>

                {/* Los sueltos primero y aparte: son lo que alguien agregó a
                    mano, y conviene verlo antes de confirmar y no descubrirlo
                    en la hoja de ruta impresa. */}
                {extras.length > 0 && (
                  <ul className="mb-1 flex flex-col gap-1">
                    {extras.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-stretch rounded-lg border border-primary/25 bg-primary/[0.05]"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
                          <Plus size={17} className="shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink">
                            {e.nombre}
                          </span>
                          <span className="w-20 shrink-0 text-right text-xs text-primary">
                            suelto
                          </span>
                          <span className="w-3.5 shrink-0" />
                        </div>
                        <button
                          onClick={() => quitarExtra(e.id)}
                          title="Sacarlo de esta orden"
                          className="flex shrink-0 items-center px-2.5 text-ink-soft/40 hover:bg-danger/10 hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* El alto está limitado a propósito: CONDUCTOR son nueve
                    categorías y OTRAS DETERMINACIONES abre diecinueve
                    renglones. Sin tope, «Crear la orden» se va abajo de la
                    pantalla con el paciente esperando. */}
                {previa && (
                  <ul className="mb-3 flex max-h-[22rem] flex-col gap-1 overflow-y-auto pr-0.5">
                    {previa.categorias.map((c) => {
                      const fuera = excluidas.includes(c.id)
                      const quedan = c.estudios.filter((e) => !excluidosEst.includes(e.id)).length
                      const Icono = iconoDe(c.nombre)
                      return (
                        <li
                          key={c.id}
                          className={`flex items-stretch rounded-lg border ${
                            fuera
                              ? "border-warning/30 bg-warning/[0.07]"
                              : "border-ink-soft/15 bg-white"
                          }`}
                        >
                          {/* El renglón entero abre el detalle; la ✕ del final saca
                              la categoría de ESTA orden. La batería no se toca: la
                              próxima sale completa otra vez. */}
                          {/* Cuatro columnas fijas: icono, nombre, contador
                              y flecha. El contador tiene ancho propio para
                              que «18 estudios» y «1 estudio» empiecen en la
                              misma x y la flecha no se corra de renglón en
                              renglón. */}
                          <button
                            onClick={() => setAbierta(c.id)}
                            disabled={fuera}
                            title={fuera ? "" : "Ver y sacar estudios de esta categoría"}
                            className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-not-allowed"
                          >
                            <Icono
                              size={17}
                              className={`shrink-0 ${fuera ? "text-warning/60" : "text-primary"}`}
                            />
                            <span
                              className={`min-w-0 flex-1 text-sm font-medium leading-snug ${
                                fuera ? "text-ink-soft line-through" : "text-ink"
                              }`}
                            >
                              {c.nombre}
                            </span>
                            {fuera ? (
                              <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                                Sacada
                              </span>
                            ) : (
                              <span
                                className={`w-20 shrink-0 text-right text-xs tabular-nums ${
                                  quedan < c.estudios.length ? "font-semibold text-warning" : "text-ink-soft"
                                }`}
                              >
                                {quedan < c.estudios.length
                                  ? `${quedan} de ${c.estudios.length}`
                                  : `${c.estudios.length} estudio${c.estudios.length === 1 ? "" : "s"}`}
                              </span>
                            )}
                            <ChevronRight
                              size={15}
                              className={`w-4 shrink-0 ${
                                fuera ? "opacity-0" : "text-ink-soft/50"
                              }`}
                            />
                          </button>
                          <button
                            onClick={() =>
                              setExcluidas((prev) =>
                                fuera ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            title={fuera ? "Volver a incluirla" : "Sacar la categoría entera"}
                            className={`flex shrink-0 items-center px-2.5 ${
                              fuera
                                ? "text-warning hover:bg-warning/15"
                                : "text-ink-soft/40 hover:bg-danger/10 hover:text-danger"
                            }`}
                          >
                            {fuera ? <Plus size={15} /> : <X size={15} />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {(excluidas.length > 0 || excluidosEst.length > 0) && (
                  <p className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2.5 text-xs leading-snug text-warning">
                    <AlertTriangle size={12} className="mt-px shrink-0" />
                    <span>
                      {excluidas.length > 0 && `${excluidas.length} categoría${excluidas.length === 1 ? "" : "s"}`}
                      {excluidas.length > 0 && excluidosEst.length > 0 && " y "}
                      {excluidosEst.length > 0 && `${excluidosEst.length} estudio${excluidosEst.length === 1 ? "" : "s"}`}
                      {" "}fuera de esta orden. La batería no cambia: la
                      próxima sale completa.
                    </span>
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={crear}
            disabled={!listoParaCrear || creando}
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {creando ? "Creando…" : <><FileText size={16} /> Crear la orden <ArrowRight size={15} /></>}
          </button>

          {listoParaCrear ? (
            <p className="-mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-soft">
              <Lock size={11} className="shrink-0" />
              Se va a crear con {totalDeLaOrden} estudio{totalDeLaOrden === 1 ? "" : "s"} y el importe queda congelado.
            </p>
          ) : (
            <p className="-mt-2 text-center text-[11px] text-ink-soft">
              {!persona
                ? "Falta la persona."
                : !empresaId
                  ? "Falta la empresa."
                  : !plantillaId && extras.length === 0
                    ? "Falta elegir una batería o al menos un estudio."
                    : "Sacaste todos los estudios: la orden quedaría vacía."}
            </p>
          )}
        </aside>
      </div>

      {/* Sacar estudios de una categoría. Es una acción que cambia lo que
          se le va a hacer a una persona, así que tiene el lugar y el
          tamaño de una decisión y no el de un menú desplegable. */}
      {catAbierta && (
        <Panel
          titulo={catAbierta.nombre}
          subtitulo={`${catAbierta.estudios.filter((e) => !excluidosEst.includes(e.id)).length} de ${catAbierta.estudios.length} estudios entran en esta orden`}
          ancho="max-w-2xl"
          onCerrar={() => setAbierta(null)}
        >
          <p className="mb-3 text-sm text-ink-soft">
            Destildá los que no van. Se sacan sólo de esta orden: la batería
            no cambia y la próxima sale completa.
          </p>

          <div className="mb-4 grid gap-1.5 sm:grid-cols-2">
            {catAbierta.estudios.map((e) => {
              const sinEste = excluidosEst.includes(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() =>
                    setExcluidosEst((prev) =>
                      sinEste ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                    )
                  }
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm ${
                    sinEste
                      ? "border-dashed border-ink-soft/25 bg-ink-soft/[0.04] text-ink-soft/60"
                      : "border-ink-soft/20 bg-white text-ink hover:border-danger/40"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      sinEste
                        ? "border-ink-soft/30"
                        : "border-primary bg-primary text-white"
                    }`}
                  >
                    {!sinEste && <Check size={13} />}
                  </span>
                  <span className={`min-w-0 flex-1 leading-snug ${sinEste ? "line-through" : ""}`}>
                    {e.nombre}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-soft/10 pt-3">
            {catAbierta.estudios.some((e) => excluidosEst.includes(e.id)) && (
              <button
                onClick={() =>
                  setExcluidosEst((prev) =>
                    prev.filter((id) => !catAbierta.estudios.some((e) => e.id === id))
                  )
                }
                className="rounded-md border-2 border-ink-soft/20 px-3 py-2 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary"
              >
                Volver a incluir todos
              </button>
            )}
            <button
              onClick={() => {
                setExcluidas((prev) => [...prev, catAbierta.id])
                setAbierta(null)
              }}
              className="flex items-center gap-1.5 rounded-md border-2 border-danger/30 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/5"
            >
              <X size={13} /> Sacar la categoría entera
            </button>
            <button
              onClick={() => setAbierta(null)}
              className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Listo
            </button>
          </div>
        </Panel>
      )}

      {panel === "ficha" && persona && (
        <Panel titulo="Ficha de la persona" subtitulo={`${persona.apellido}, ${persona.nombre}`} onCerrar={cerrarPanel}>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-2.5 text-sm sm:grid-cols-2">
            <Dato k="Documento" v={`${persona.tipo_doc} ${persona.nro_doc}`} />
            <Dato k="Apellido y nombre" v={`${persona.apellido}, ${persona.nombre}`} />
            <Dato k="Sexo" v={persona.sexo === "F" ? "Femenino" : "Masculino"} />
            <Dato
              k="Fecha de nacimiento"
              v={persona.fecha_nac
                ? `${persona.fecha_nac}${edadDe(persona.fecha_nac) !== null ? ` · ${edadDe(persona.fecha_nac)} años` : ""}`
                : null}
            />
            <Dato k="Teléfono" v={persona.telefono} />
            <Dato k="Domicilio" v={persona.domicilio} />
            <Dato k="Ocupación" v={persona.ocupacion} />
            <Dato k="Estado civil" v={persona.estado_civil} />
          </dl>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => { setEditP({ ...persona }); setPanel("editarPersona") }}
              className="flex items-center gap-1.5 rounded-md border-2 border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/5"
            >
              <Pencil size={13} /> Editar datos
            </button>
            <button
              onClick={verHistorial}
              className="flex items-center gap-1.5 rounded-md border-2 border-ink-soft/20 px-3 py-2 text-xs text-ink-soft hover:text-ink"
            >
              <Clock size={13} /> Ver historial
            </button>
          </div>
          {/* El sexo no es un dato más: es el que decide qué estudios se
             abren y contra qué valores se comparan. */}
          <p className="mt-4 text-[11px] text-ink-soft">
            El sexo decide qué estudios abre la batería y contra qué valores se
            comparan los resultados. La edad no interviene en nada.
          </p>
        </Panel>
      )}

      {panel === "historial" && persona && (
        <Panel
          titulo="Historial completo"
          subtitulo={`${persona.apellido}, ${persona.nombre} · ${persona.tipo_doc} ${persona.nro_doc}`}
          ancho="max-w-3xl"
          onCerrar={cerrarPanel}
        >
          {!legajo ? (
            <p className="text-sm text-ink-soft">Buscando…</p>
          ) : legajo.length === 0 ? (
            <p className="text-sm text-ink-soft">Es su primer examen acá.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-soft">
                {legajo.length} {legajo.length === 1 ? "examen" : "exámenes"}, del más nuevo al más viejo.
              </p>
              <div className="max-h-96 overflow-y-auto rounded-md border border-ink-soft/15">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-ink-soft/5 text-ink-soft">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-medium">N°</th>
                      <th className="px-2.5 py-2 text-left font-medium">Fecha</th>
                      <th className="px-2.5 py-2 text-left font-medium">Empresa</th>
                      <th className="px-2.5 py-2 text-left font-medium">Tipo</th>
                      <th className="px-2.5 py-2 text-left font-medium">Estado</th>
                      <th className="px-2.5 py-2 text-left font-medium">Aptitud</th>
                      <th className="px-2.5 py-2 text-left font-medium">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legajo.map((o) => (
                      <tr key={o.id} className="border-t border-ink-soft/10">
                        <td className="px-2.5 py-1.5 tabular-nums text-ink">{o.numero}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-ink-soft">{o.fecha}</td>
                        <td className="px-2.5 py-1.5 text-ink-soft">{o.empresa?.razon_social}</td>
                        <td className="px-2.5 py-1.5 text-ink-soft">{TIPO_EXAMEN_LABEL[o.tipo_examen] ?? o.tipo_examen}</td>
                        <td className="px-2.5 py-1.5 text-ink-soft">{ETIQUETA_ESTADO[o.estado]}</td>
                        <td className="px-2.5 py-1.5 text-ink-soft">
                          {o.aptitud === "PENDIENTE" ? "—" : ETIQUETA_APTITUD[o.aptitud]}
                        </td>
                        <td className="px-2.5 py-1.5 tabular-nums text-ink-soft">{o.fecha_vencimiento ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}

      {panel === "editarPersona" && editP && (
        <Panel
          titulo="Editar los datos de la persona"
          subtitulo={`${persona.apellido}, ${persona.nombre}`}
          onCerrar={cerrarPanel}
        >
          <form onSubmit={guardarPersona}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Documento" requerido valor={editP.nro_doc ?? ""}
                onCambio={(v) => setEditP({ ...editP, nro_doc: v })} />
              <div>
                <label className="mb-1 block text-xs text-ink-soft">
                  Sexo <span className="text-danger">*</span>
                </label>
                <select
                  value={editP.sexo}
                  onChange={(ev) => setEditP({ ...editP, sexo: ev.target.value })}
                  className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <Campo label="Apellido" requerido valor={editP.apellido ?? ""}
                onCambio={(v) => setEditP({ ...editP, apellido: v })} />
              <Campo label="Nombre" requerido valor={editP.nombre ?? ""}
                onCambio={(v) => setEditP({ ...editP, nombre: v })} />
              <Campo label="Fecha de nacimiento" tipo="date" valor={editP.fecha_nac ?? ""}
                onCambio={(v) => setEditP({ ...editP, fecha_nac: v })} />
              <Campo label="Teléfono" valor={editP.telefono ?? ""}
                onCambio={(v) => setEditP({ ...editP, telefono: v })} />
              <Campo label="Domicilio" valor={editP.domicilio ?? ""}
                onCambio={(v) => setEditP({ ...editP, domicilio: v })} />
              <Campo label="Ocupación" valor={editP.ocupacion ?? ""}
                onCambio={(v) => setEditP({ ...editP, ocupacion: v })} />
              <Campo label="Estado civil" valor={editP.estado_civil ?? ""}
                onCambio={(v) => setEditP({ ...editP, estado_civil: v })} />
            </div>

            {/* Cambiar el sexo cambia la batería que se está por crear, y eso
               no se nota solo: conviene decirlo antes de guardar. */}
            {previa && editP.sexo !== persona.sexo && (
              <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-2 text-[11px] text-warning">
                <AlertTriangle size={12} className="mt-px shrink-0" />
                <span>
                  Al cambiar el sexo se vuelven a calcular los estudios de la
                  batería, y lo que hayas sacado se repone.
                </span>
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={guardando || !editP.apellido?.trim() || !editP.nombre?.trim() || !editP.nro_doc?.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cerrarPanel}
                className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Panel>
      )}

      {panel === "editarEmpresa" && editE && (
        <Panel
          titulo="Editar los datos de la empresa"
          subtitulo={editE.razon_social}
          onCerrar={cerrarPanel}
        >
          <form onSubmit={guardarEmpresa}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Razón social" requerido valor={editE.razon_social ?? ""}
                onCambio={(v) => setEditE({ ...editE, razon_social: v })} />
              <Campo label="Código" valor={editE.codigo ?? ""}
                onCambio={(v) => setEditE({ ...editE, codigo: v })} />
              <Campo label="CUIT" valor={editE.cuit ?? ""}
                onCambio={(v) => setEditE({ ...editE, cuit: v })} />
              <Campo label="Teléfono" valor={editE.telefono ?? ""}
                onCambio={(v) => setEditE({ ...editE, telefono: v })} />
              <div className="sm:col-span-2">
                <Campo label="Domicilio" valor={editE.domicilio ?? ""}
                  onCambio={(v) => setEditE({ ...editE, domicilio: v })} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={guardando || !editE.razon_social?.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cerrarPanel}
                className="rounded-md border-2 border-ink-soft/20 px-4 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Cancelar
              </button>
            </div>
            {/* Se corrige la empresa, no esta orden: el cambio vale para
               todas las órdenes que se abran de acá en más. */}
            <p className="mt-3 text-[11px] text-ink-soft">
              Cambia la empresa en todo el sistema, no sólo en esta orden.
            </p>
          </form>
        </Panel>
      )}
    </AppShell>
  )
}

/* Una ventana encima del alta. Se cierra con la ✕, con Escape o
   haciendo clic afuera; la orden que se está cargando queda intacta. */
function Panel({ titulo, subtitulo, ancho = "max-w-2xl", onCerrar, children }) {
  return (
    <div
      onMouseDown={onCerrar}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
    >
      <div
        onMouseDown={(ev) => ev.stopPropagation()}
        className={`w-full ${ancho} rounded-card border-2 border-ink-soft/15 bg-white shadow-xl`}
      >
        <div className="flex items-start gap-3 border-b border-ink-soft/15 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{titulo}</p>
            {subtitulo && <p className="truncate text-xs text-ink-soft">{subtitulo}</p>}
          </div>
          <button
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 rounded p-1 text-ink-soft hover:bg-ink-soft/10 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Dato({ k, v }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{k}</dt>
      <dd className="text-ink">{v || <span className="text-ink-soft/50">—</span>}</dd>
    </div>
  )
}

/* Una tarjeta de paso: número, título y la línea que dice qué se hace.
   Los tres pasos se ven iguales porque son lo mismo tres veces. */
function Paso({ n, titulo, subtitulo, extra, apagado, children }) {
  return (
    <section
      className={`rounded-card border border-ink-soft/15 bg-white p-5 ${
        apagado ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{titulo}</p>
          <p className="text-xs text-ink-soft">{subtitulo}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Nota({ icono, titulo, pie }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-primary">{icono}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-snug text-ink">{titulo}</p>
        <p className="text-[11px] leading-snug text-ink-soft">{pie}</p>
      </div>
    </div>
  )
}

/* El rótulo va sin recorte: en la primera versión el borde redondeado
   tenía overflow-hidden y «Categorías» se leía «Categor». */
function Cifra({ k, v }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white px-1 py-2.5 text-center">
      <p className="text-[11px] leading-tight text-ink-soft">{k}</p>
      <p className="mt-1 text-lg font-semibold leading-none tabular-nums text-ink">{v}</p>
    </div>
  )
}

function FilaResumen({ icono, titulo, principal, detalle, onEditar }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-soft/10 text-ink-soft">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-soft">{titulo}</p>
        <p className="text-[15px] font-medium leading-snug text-ink">{principal}</p>
        {detalle && <p className="text-xs leading-snug text-ink-soft">{detalle}</p>}
      </div>
      <button
        onClick={onEditar}
        className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Pencil size={12} /> Editar
      </button>
    </div>
  )
}

function Campo({ label, valor, onCambio, tipo = "text", requerido, deshabilitado }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-soft">
        {label} {requerido && <span className="text-danger">*</span>}
      </label>
      <input
        type={tipo}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-md border-2 border-ink-soft/20 px-2.5 py-2 text-sm outline-none focus:border-primary disabled:bg-ink-soft/5"
      />
    </div>
  )
}
