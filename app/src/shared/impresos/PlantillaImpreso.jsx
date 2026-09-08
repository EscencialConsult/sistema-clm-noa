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

/** conValores=true muestra Resultado/Valor/Observación (protocolo).
 *  conValores=false muestra solo Estudio (hoja de ruta: nada cargado aún). */
export function TablaEstudios({ categorias, conValores }) {
  return (
    <table className="imp-tabla">
      <thead>
        <tr>
          <th>Estudio</th>
          {conValores && (
            <>
              <th>Resultado</th>
              <th>Valor</th>
              <th>Referencia</th>
              <th>Observación</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {categorias.map((cat) => (
          <FragmentoCategoria key={cat.id} cat={cat} conValores={conValores} />
        ))}
      </tbody>
    </table>
  )
}

function FragmentoCategoria({ cat, conValores }) {
  return (
    <>
      <tr className="imp-cat">
        <td colSpan={conValores ? 5 : 1}>{cat.nombre}</td>
      </tr>
      {cat.items.map((it, i) => (
        <tr key={i}>
          <td>
            {it.nombre}
            {it.unidad ? ` (${it.unidad})` : ""}
          </td>
          {conValores && (
            <>
              <td className={it.fueraDeRango ? "imp-fuera" : undefined}>{it.resultado ?? "—"}</td>
              <td className={it.fueraDeRango ? "imp-fuera" : undefined}>{it.detalle ?? "—"}</td>
              <td>{it.referencia ?? "—"}</td>
              <td>{it.observacion ?? ""}</td>
            </>
          )}
        </tr>
      ))}
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
