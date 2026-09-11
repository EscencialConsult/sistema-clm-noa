/* ---------------------------------------------------------------------
   Buscar una orden por documento o por apellido.

   Lo usan el Listado de Órdenes y Pendientes del Día. Va acá y no
   duplicado en cada pantalla porque lo que tiene que pasar es que las
   dos se comporten IGUAL: quien aprende a buscar en una no tiene que
   volver a aprender en la otra.

   El documento se compara sin puntos ni espacios. En el mostrador el DNI
   se dicta y se tipea de las dos formas —«28456712» y «28.456.712»— y en
   la base está guardado de una sola. Comparar tal cual escrito hace que
   la mitad de las búsquedas no encuentre nada, y el que busca concluye
   que la persona no está.

   Por apellido se compara sin acentos: «penaloza» tiene que encontrar a
   PEÑALOZA. Nadie pone el acento cuando busca.
   --------------------------------------------------------------------- */

const sinTildes = (s) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

const soloDigitos = (s) => (s ?? "").replace(/\D/g, "")

/** ¿Esta orden coincide con lo que se escribió? Sin texto, coinciden todas. */
export function coincide(orden, texto) {
  const t = (texto ?? "").trim()
  if (!t) return true

  /* Si escribieron números, es un documento: se comparan sólo los
     dígitos de los dos lados. Buscar «284» tiene que encontrar al
     28456712 — se tipea de a poco y el resultado se va achicando. */
  const digitos = soloDigitos(t)
  if (digitos && soloDigitos(orden.documento).includes(digitos)) return true

  /* Y si no, por apellido o nombre. También por número de orden, que es
     lo que dice el papel que trae el paciente en la mano. */
  const busca = sinTildes(t)
  return (
    sinTildes(orden.paciente).includes(busca) ||
    String(orden.numero ?? "").includes(t)
  )
}
