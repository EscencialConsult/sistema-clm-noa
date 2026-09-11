import { getDatosParaImprimir } from "../../../shared/impresos/datosImpresionService"
import { imprimirComponente } from "../../../shared/impresos/imprimir"
import { CabeceraImpreso, DatosOrden, TablaEstudios } from "../../../shared/impresos/PlantillaImpreso"

/* ---------------------------------------------------------------------
   ClickUp 03 · Hoja de ruta impresa.
   Se entrega al crear la orden (RF11) y acompaña al paciente por cada
   puesto de carga. Formato confirmado: Informe_Formularios_y_Plan_Fase1,
   sección 2.12 — "EXAMEN PRELABORAL", N° de orden arriba a la derecha,
   tabla Estudio/Resultado/Observación/Valor agrupada por especialidad,
   con las cuatro columnas en blanco: nada se cargó todavía, se llenan a
   mano en el puesto (ClickUp 03, criterio "las cuatro columnas en
   blanco, para escribir a mano").

   Un bloque por categoría, no una tabla larga con todas juntas: el
   papel real se corta en tiras, una por puesto (CU-06, alt. 5a — "la
   hoja se corta en tiras, una por profesional"). Cada bloque repite el
   encabezado completo y lleva el nombre de SU categoría arriba a la
   izquierda, espejado con el N° de orden — así cada puesto recibe una
   tira que ya dice de qué es, en vez de una fila perdida en una tabla
   de varias páginas.

   Los bloques se acomodan uno debajo de otro y aprovechan la hoja:
   RADIOGRAFIAS con un solo estudio gastaba una carilla entera. Como el
   papel se corta igual, dos categorías en una hoja son un corte más y
   no un problema. Lo que nunca puede pasar es que una categoría quede
   partida entre dos páginas —esa tira saldría cortada al medio—, y de
   eso se encarga `imp-bloque` con break-inside: avoid.

   Con `unaPorPagina` se vuelve al comportamiento viejo, para quien
   prefiera no cortar.

   Sin firmas: a diferencia del protocolo, en la hoja de ruta no van
   (indicación de la clínica) — cada profesional carga en el sistema,
   no firma un papel por categoría.

   Un solo motor para imprimir y para "descargar como PDF": el diálogo
   de impresión del navegador (ver MenuImpreso.jsx). No hay una función
   de descarga aparte — se sacó porque generaba el archivo con una
   captura de pantalla (calidad muy inferior a imprimir de verdad).
   --------------------------------------------------------------------- */

export function HojaDeRuta({ datos, unaPorPagina = false }) {
  const ultima = datos.categorias.length - 1
  return (
    <div className="hoja-impresion">
      {datos.categorias.map((cat, i) => (
        <div
          key={cat.id}
          className={
            unaPorPagina
              ? (i < ultima ? "imp-salto-pagina" : undefined)
              : "imp-bloque"
          }
        >
          {/* La guía de corte va ARRIBA de cada bloque menos el primero:
              así viaja con el bloque cuando éste se pasa a la página
              siguiente, en vez de quedar colgada al pie de la anterior. */}
          {!unaPorPagina && i > 0 && (
            <div className="imp-corte"><span>✂ cortar aquí</span></div>
          )}
          {/* El título sale del tipo de examen de la orden, no fijo.
              Estaba escrito "EXAMEN PRELABORAL" a mano: si recepción
              elegía Periódico o Egreso —las tres opciones que pide
              RF11— el protocolo salía bien, pero el papel que lleva el
              paciente seguía diciendo PRELABORAL. */}
          <CabeceraImpreso
            titulo={`EXAMEN ${datos.tipo_examen ?? "PRELABORAL"}`}
            numero={datos.numero}
            categoria={cat.nombre}
          />
          <DatosOrden orden={datos} />
          <TablaEstudios categorias={[cat]} modo="blanco" sinTituloCategoria />
        </div>
      ))}
    </div>
  )
}

export async function imprimirHojaDeRuta(ordenId, { unaPorPagina = false } = {}) {
  const datos = await getDatosParaImprimir(ordenId)
  imprimirComponente(<HojaDeRuta datos={datos} unaPorPagina={unaPorPagina} />)
}
