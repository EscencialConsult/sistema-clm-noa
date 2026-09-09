import { getDatosParaImprimir } from "../../../shared/impresos/datosImpresionService"
import { imprimirComponente } from "../../../shared/impresos/imprimir"
import { descargarComoPdf } from "../../../shared/impresos/descargarPdf"
import {
  CabeceraImpreso,
  DatosOrden,
  TablaEstudios,
  FirmasImpreso,
  LeyendaPropuesta,
} from "../../../shared/impresos/PlantillaImpreso"
import { ETIQUETA_APTITUD } from "../../../types/dominio"

/* ---------------------------------------------------------------------
   ClickUp 09 · Protocolo impreso.
   Solo se puede emitir después de emitir_protocolo() (RF22/RF23): la
   base ya garantizó que no queda ningún estudio sin cargar y que la
   aptitud la fijó el médico laboral. Esta pantalla no vuelve a validar
   nada de eso — solo imprime lo que la orden ya tiene guardado.

   Pendiente de confirmar con el cliente (Informe_Formularios, 5.2):
   cómo se arma el protocolo final cuando se entrega a la empresa —no
   hay foto de cómo quedan unidas la planilla clínica, el laboratorio,
   el toxicológico y los informes externos. Este impreso reproduce el
   formato ya validado del prototipo (CML-Prelaborales.html: pProto) con
   los datos reales; el orden/portada final de las hojas sueltas queda
   marcado como abierto, no inventado acá.
   --------------------------------------------------------------------- */

export function Protocolo({ datos }) {
  const medico = datos.medico_laboral
  return (
    <div className="hoja-impresion">
      <CabeceraImpreso titulo={`PROTOCOLO — EXAMEN ${datos.tipo_examen ?? ""}`} numero={datos.numero} />
      <DatosOrden orden={datos} />
      <TablaEstudios categorias={datos.categorias} modo="con-datos" />

      <div className="imp-res">
        <div>
          <b>RESULTADO:</b> {ETIQUETA_APTITUD[datos.aptitud] ?? "Pendiente"}
        </div>
        <div>
          <b>INCAPACIDAD:</b> {datos.incapacidad_pct ?? "—"} %
        </div>
      </div>

      {datos.preexistencias && (
        <p className="imp-obs">
          <b>Preexistencias:</b> {datos.preexistencias}
        </p>
      )}
      {datos.observaciones && (
        <p className="imp-obs">
          <b>Especialidades / observaciones:</b> {datos.observaciones}
        </p>
      )}

      <FirmasImpreso
        segunda={
          medico ? (
            <>
              {medico.apellido_nombre}
              <br />
              {medico.especialidad}
              <br />
              {medico.matricula_prov && `M.P. ${medico.matricula_prov}`}
              {medico.matricula_prov && medico.matricula_nac && " – "}
              {medico.matricula_nac && `M.N. ${medico.matricula_nac}`}
            </>
          ) : (
            "Firma del médico laboral"
          )
        }
      />

      <LeyendaPropuesta />
    </div>
  )
}

/** Entry point: trae los datos reales de la orden y abre el diálogo de impresión.
 *  No se llama antes de que la orden esté INFORMADA — el botón que la
 *  dispara debe estar deshabilitado hasta entonces (lo resuelve la
 *  pantalla de aptitud, no este módulo). */
export async function imprimirProtocolo(ordenId) {
  const datos = await getDatosParaImprimir(ordenId)
  imprimirComponente(<Protocolo datos={datos} />)
}

/** RF23 "en formato de archivo": descarga directa de un clic, sin pasar
 *  por el diálogo de impresión del navegador. Mismo componente, mismos
 *  datos — nunca dos layouts distintos para el mismo documento. */
export async function descargarProtocoloPdf(ordenId) {
  const datos = await getDatosParaImprimir(ordenId)
  await descargarComoPdf(<Protocolo datos={datos} />, `protocolo-${datos.numero}.pdf`)
}
