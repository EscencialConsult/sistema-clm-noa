import { getDatosParaImprimir } from "../../../shared/impresos/datosImpresionService"
import { imprimirComponente } from "../../../shared/impresos/imprimir"
import { CabeceraImpreso, DatosOrden, TablaEstudios, FirmasImpreso } from "../../../shared/impresos/PlantillaImpreso"

/* ---------------------------------------------------------------------
   ClickUp 03 · Hoja de ruta impresa.
   Se entrega al crear la orden (RF11) y acompaña al paciente por cada
   puesto de carga. Formato confirmado: Informe_Formularios_y_Plan_Fase1,
   sección 2.12 — "EXAMEN PRELABORAL", N° de orden arriba a la derecha,
   tabla Estudio/Resultado/Observación/Valor agrupada por especialidad,
   con las cuatro columnas en blanco: nada se cargó todavía, se llenan a
   mano en el puesto (ClickUp 03, criterio "las cuatro columnas en
   blanco, para escribir a mano").
   --------------------------------------------------------------------- */

export function HojaDeRuta({ datos }) {
  return (
    <div className="hoja-impresion">
      <CabeceraImpreso titulo="EXAMEN PRELABORAL" numero={datos.numero} />
      <DatosOrden orden={datos} />
      <TablaEstudios categorias={datos.categorias} modo="blanco" />
      <FirmasImpreso segunda="Firma del profesional" />
    </div>
  )
}

/** Entry point: trae los datos reales de la orden y abre el diálogo de impresión. */
export async function imprimirHojaDeRuta(ordenId) {
  const datos = await getDatosParaImprimir(ordenId)
  imprimirComponente(<HojaDeRuta datos={datos} />)
}
