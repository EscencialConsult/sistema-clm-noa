/* ---------------------------------------------------------------------
   Piezas comunes a los dos impresos (hoja de ruta y protocolo), para no
   repetir el encabezado ni la tabla de estudios en cada uno.

   Formato confirmado contra el legajo real:
   - Encabezado + N° de orden arriba a la derecha (Informe_Formularios,
     2.12 · Hoja de ruta).
   - Tabla "Estudio · Resultado · Observación · Valor" agrupada por
     categoría (misma sección).
   - Firmas al pie: postulante + profesional (2.1 · Planilla clínica).

   Nada de tokens de marca acá (--color-primary, etc.): un impreso
   institucional que se lleva el paciente no es una pantalla de la app,
   es el mismo papel blanco y negro de siempre — coincide con lo que ya
   estaba validado en el prototipo (CML-Prelaborales.html).
   --------------------------------------------------------------------- */

export function CabeceraImpreso({ titulo, numero }) {
  return (
    <div className="imp-ph">
      <h1>Centro Médico Laboral del NOA</h1>
      <p className="imp-s">Dr. Rubén Mario Kaplan · Médico Cirujano – Laboral</p>
      {numero != null && <p className="imp-num">N° {numero}</p>}
      <div className="imp-pt">{titulo}</div>
    </div>
  )
}

export function DatosOrden({ orden }) {
  const p = orden.persona ?? {}
  const empresaYTipo = [orden.empresa?.razon_social, orden.tipo_examen].filter(Boolean).join(" — ")
  return (
    <div className="imp-pd">
      <div>
        <b>Nombre:</b> {p.apellido}, {p.nombre}
      </div>
      <div>
        <b>Documento:</b> {p.tipo_doc} {p.nro_doc}
      </div>
      <div>
        <b>Empresa / examen:</b> {empresaYTipo}
      </div>
      <div>
        <b>Fecha:</b> {orden.fecha}
      </div>
      {orden.tarea && (
        <div>
          <b>Tarea a desempeñar:</b> {orden.tarea}
        </div>
      )}
      {orden.edad != null && (
        <div>
          <b>Edad:</b> {orden.edad} años
        </div>
      )}
    </div>
  )
}

/**
 * Las cuatro columnas confirmadas (ClickUp 03 / Informe_Formularios 2.12):
 * Estudio · Resultado · Observación · Valor — SIEMPRE las cuatro, en ese
 * orden, en los dos impresos. Lo que cambia entre uno y otro es si están
 * en blanco (hoja de ruta, RF13: nada se cargó todavía, se llenan a
 * mano) o con lo que ya está guardado (protocolo, RF23).
 *
 * modo: "blanco" | "con-datos"
 *
 * El valor de referencia (ref_h/ref_m) no es una quinta columna: va
 * pegado al valor, entre paréntesis, como se ve en el papel real
 * ("4,8 (V 3,5-5,5)") — así lo pide ClickUp 09: "resultado y
 * observación juntos", no una grilla más ancha que la de siempre.
 */
export function TablaEstudios({ categorias, modo }) {
  const conDatos = modo === "con-datos"
  return (
    <table className="imp-tabla">
      <thead>
        <tr>
          <th>Estudio</th>
          <th>Resultado</th>
          <th>Observación</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {categorias.map((cat) => (
          <FragmentoCategoria key={cat.id} cat={cat} conDatos={conDatos} />
        ))}
      </tbody>
    </table>
  )
}

function FragmentoCategoria({ cat, conDatos }) {
  return (
    <>
      <tr className="imp-cat">
        <td colSpan={4}>{cat.nombre}</td>
      </tr>
      {cat.items.map((it, i) => {
        const valor = conDatos
          ? [it.detalle, it.referencia && `(${it.referencia})`].filter(Boolean).join(" ") || "—"
          : ""
        return (
          <tr key={i}>
            <td>
              {it.nombre}
              {it.unidad ? ` (${it.unidad})` : ""}
            </td>
            <td className={it.fueraDeRango ? "imp-fuera" : undefined}>{conDatos ? it.resultado ?? "—" : ""}</td>
            <td>{conDatos ? it.observacion ?? "" : ""}</td>
            <td className={it.fueraDeRango ? "imp-fuera" : undefined}>{valor}</td>
          </tr>
        )
      })}
    </>
  )
}

export function FirmasImpreso({ segunda }) {
  return (
    <div className="imp-sig">
      <div>Firma del postulante</div>
      <div>{segunda}</div>
    </div>
  )
}

/** ClickUp 09, criterio de cierre: "Queda dicho al cliente que el
 *  formato es propuesta nuestra". No alcanza con que quede escrito en
 *  el código — tiene que verlo quien recibe el papel. */
export function LeyendaPropuesta() {
  return (
    <p className="imp-leyenda">
      Formato de protocolo propuesto por Escencial Consultora — pendiente de validación con el
      cliente (no hay un legajo de referencia de cómo se compagina hoy el documento final).
    </p>
  )
}
