import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, UserPlus, Printer, AlertTriangle, Check, ArrowRight, Plus, X, Layers } from "lucide-react"
import AppShell from "../../layouts/AppShell"
import { nuevaOrdenService } from "./services/nuevaOrdenService"
import { catalogoService } from "../catalogo/services/catalogoService"
import { TIPO_DOC, TIPO_EXAMEN, ETIQUETA_ESTADO, ETIQUETA_APTITUD } from "../../types/dominio"
import MenuImpreso from "../../shared/impresos/MenuImpreso"
import { imprimirHojaDeRuta } from "./imprimir/HojaDeRuta"

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

const TIPO_EXAMEN_LABEL = { PRELABORAL: "Prelaboral", PERIODICO: "Periódico", EGRESO: "Egreso" }

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

  /* paso 2 · estudios sueltos, además de la batería */
  const [busquedaExtra, setBusquedaExtra] = useState("")
  const [resultadosExtra, setResultadosExtra] = useState([])
  const [categoriasExtra, setCategoriasExtra] = useState([])
  const [extras, setExtras] = useState([])
  const [extraMarcado, setExtraMarcado] = useState(0)
  /* Alta rápida de un estudio que no está en el catálogo. */
  const [nuevoEstudio, setNuevoEstudio] = useState(null)
  const [categoriasCatalogo, setCategoriasCatalogo] = useState([])

  /* paso 3 */
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
    if (!plantillaId || !persona) { setPrevia(null); return }
    nuevaOrdenService
      .previsualizar(Number(plantillaId), persona.sexo)
      .then(setPrevia)
      .catch((e) => setError(e.message))
  }, [plantillaId, persona])

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
  async function crearEstudioSuelto(e) {
    e.preventDefault()
    setError(null)
    try {
      const creado = await catalogoService.guardarEstudio(
        { nombre: nuevoEstudio.nombre, orden: 99 },
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

      setCreada(await nuevaOrdenService.getOrdenCreada(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
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

          <dl className="mb-5 grid grid-cols-2 gap-y-2 text-sm">
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
            columnas en blanco: se llenan a mano y después se cargan.
          </p>
        </div>
      </AppShell>
    )
  }

  /* ---------------- el formulario ---------------- */
  /* La batería dejó de ser obligatoria: alguien puede venir sólo por una
     audiometría. Lo que sí hace falta es que la orden tenga ALGO — una
     batería, o al menos un estudio suelto—, para que nadie cree por
     descuido una orden vacía que después nadie entiende. */
  const listoParaCrear = persona && empresaId && (plantillaId || extras.length > 0)

  const empresaElegida = empresas.find((e) => String(e.id) === String(empresaId)) ?? null

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

      <div className="grid max-w-5xl grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          {/* Paso 1 */}
          <section className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">1 · El documento</p>

            <form onSubmit={buscar} className="flex gap-2">
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                className="rounded-md border-2 border-ink-soft/20 px-2.5 py-2.5 text-sm outline-none focus:border-primary"
              >
                {TIPO_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  autoFocus
                  value={nroDoc}
                  onChange={(e) => setNroDoc(e.target.value)}
                  placeholder="Número de documento"
                  className="w-full rounded-md border-2 border-ink-soft/20 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={!nroDoc.trim() || buscando}
                className="rounded-md bg-primary px-5 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-40"
              >
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </form>

            {persona && (
              <div className="mt-4 rounded-md border-2 border-success/30 bg-success/5 p-3.5">
                <p className="text-sm text-ink">
                  {persona.apellido}, {persona.nombre}
                </p>
                <p className="text-xs text-ink-soft">
                  {persona.tipo_doc} {persona.nro_doc} ·{" "}
                  {persona.sexo === "F" ? "Femenino" : "Masculino"}
                  {persona.fecha_nac && ` · ${persona.fecha_nac}`}
                </p>
                {historial.length > 0 ? (
                  <div className="mt-3 border-t border-success/20 pt-2.5">
                    <p className="mb-1.5 text-xs font-medium text-ink-soft">
                      Ya tiene {historial.length} {historial.length === 1 ? "examen" : "exámenes"}
                    </p>
                    <ul className="flex flex-col gap-0.5 text-xs text-ink-soft">
                      {historial.slice(0, 4).map((o) => (
                        <li key={o.id}>
                          N° {o.numero} · {o.fecha} · {o.empresa?.razon_social} ·{" "}
                          {ETIQUETA_ESTADO[o.estado]}
                          {o.aptitud !== "PENDIENTE" && ` · ${ETIQUETA_APTITUD[o.aptitud]}`}
                          {o.fecha_vencimiento && ` · vence ${o.fecha_vencimiento}`}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-ink-soft">
                      Si tiene uno vigente, confirmá con la empresa antes de repetirlo.
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-soft">Es su primer examen acá.</p>
                )}
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
                <div className="mb-3 grid grid-cols-2 gap-3">
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
          </section>

          {/* Paso 2 */}
          <section className={`rounded-card border-2 border-ink-soft/15 bg-white p-5 ${persona ? "" : "opacity-50"}`}>
            <p className="mb-3 text-sm font-medium text-ink">2 · Empresa y batería</p>
            <div className="grid grid-cols-2 gap-3">
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
                    {empresaElegida && (
                      <button
                        onClick={() => { setEmpresaId(""); setBusquedaEmpresa(""); setEmpresaAbierta(true) }}
                        title="Cambiar de empresa"
                        className="shrink-0 text-ink-soft hover:text-danger"
                      >
                        <X size={13} />
                      </button>
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

            {/* Estudios sueltos, además de la batería.
                Antes esto obligaba a crear la orden, irse a otra pantalla,
                buscar el estudio entre 120 y volver — con el paciente
                esperando en el mostrador. Ahora se agregan acá y salen ya
                en la hoja de ruta, sin salir de la pantalla. */}
            <div className="mt-5 border-t border-ink-soft/10 pt-4">
              <label className="mb-1 block text-xs text-ink-soft">
                ¿Algo más, además de la batería? <span className="text-ink-soft/60">(opcional)</span>
              </label>

              <div className="relative">
                <div className="flex items-center gap-2 rounded-md border-2 border-ink-soft/20 px-2.5 py-2 focus-within:border-primary">
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

                {/* No está en el catálogo: se crea acá, sin perder la orden.
                    La empresa pide algo que la clínica todavía no cargó y
                    el paciente está esperando; salir a Estudios y
                    Categorías significaba empezar el alta de nuevo. */}
                {busquedaExtra.trim().length >= 2 &&
                  categoriasExtra.length === 0 &&
                  resultadosExtra.length === 0 &&
                  !nuevoEstudio && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-ink-soft/15 bg-white p-3 shadow-lg">
                      <p className="mb-2 text-xs text-ink-soft">
                        No hay ningún estudio con «{busquedaExtra.trim()}».
                      </p>
                      <button
                        onClick={() =>
                          setNuevoEstudio({
                            nombre: busquedaExtra.trim().toUpperCase(),
                            categoriaId: "",
                          })
                        }
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus size={13} /> Crear «{busquedaExtra.trim().toUpperCase()}» en el catálogo
                      </button>
                    </div>
                  )}

                {(categoriasExtra.length > 0 || resultadosExtra.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-soft/15 bg-white shadow-lg">
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
                  </div>
                )}
              </div>

              {nuevoEstudio && (
                <form
                  onSubmit={crearEstudioSuelto}
                  className="mt-2 rounded-md border-2 border-primary/30 bg-primary/5 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-ink">Estudio nuevo</p>
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
          </section>
        </div>

        {/* Paso 3 · lo que va a pasar */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-card border-2 border-ink-soft/15 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink">3 · Qué se va a abrir</p>

            {!previa && extras.length === 0 ? (
              <p className="text-xs text-ink-soft">
                Elegí la persona y la batería para ver los estudios. Si viene
                por un estudio suelto, alcanza con buscarlo abajo.
              </p>
            ) : !previa ? (
              /* Sin batería, pero con estudios sueltos: es el caso de
                 quien viene sólo por una audiometría. */
              <>
                <p className="mb-3 text-sm text-ink">
                  {extras.length} estudio{extras.length === 1 ? "" : "s"}
                  <span className="text-ink-soft"> · sin batería</span>
                </p>
                <ul className="mb-3 flex flex-col gap-1 rounded-md border border-primary/25 bg-primary/5 p-2 text-xs">
                  {extras.map((e) => (
                    <li key={e.id} className="flex items-center gap-1.5 text-primary">
                      <Plus size={11} className="shrink-0" />
                      {e.nombre}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-ink-soft">
                  El importe lo calcula la base al crear la orden.
                </p>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink">
                  {previa.total}
                  {extras.length > 0 && (
                    <span className="text-primary"> + {extras.length}</span>
                  )}
                  {" estudios"}
                  <span className="text-ink-soft">
                    {" "}· {persona.sexo === "F" ? "mujer" : "varón"}
                  </span>
                </p>

                {/* Los sueltos se muestran aparte de las categorías de la
                    batería: son lo que alguien agregó a mano, y conviene
                    verlo antes de confirmar y no descubrirlo en la hoja
                    de ruta impresa. */}
                {extras.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-1 rounded-md border border-primary/25 bg-primary/5 p-2 text-xs">
                    {extras.map((e) => (
                      <li key={e.id} className="flex items-center gap-1.5 text-primary">
                        <Plus size={11} className="shrink-0" />
                        {e.nombre}
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="mb-3 flex flex-col gap-1.5 text-xs">
                  {previa.categorias.map((c) => (
                    <li key={c.id} className="flex justify-between text-ink-soft">
                      <span>{c.nombre}</span>
                      <span>{c.estudios.length}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-ink-soft">
                  Los estudios salen de la batería según el sexo. No hay nada
                  que tildar a mano. El importe lo calcula la base al crear la
                  orden y queda congelado.
                </p>
              </>
            )}
          </div>

          <button
            onClick={crear}
            disabled={!listoParaCrear || creando}
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-3 text-sm text-white hover:opacity-90 disabled:opacity-40"
          >
            {creando ? "Creando…" : <>Crear la orden <ArrowRight size={15} /></>}
          </button>
          {!listoParaCrear && (
            <p className="-mt-2 text-center text-[11px] text-ink-soft">
              Falta {!persona ? "la persona" : !empresaId ? "la empresa" : "elegir una batería o al menos un estudio"}.
            </p>
          )}
        </aside>
      </div>
    </AppShell>
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
