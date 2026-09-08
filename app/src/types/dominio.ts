/* ---------------------------------------------------------------------
   El vocabulario del sistema. Tiene que decir EXACTAMENTE lo mismo que
   los CHECK del esquema (supabase/migrations/001_esquema.sql).

   Existe por una razón concreta: la maqueta usaba "completo" donde el
   esquema dice "COMPLETA". En Carnicerías el mismo error costó caro —
   el SQL decía 'cajero' y el Angular 'vendedor', y mientras no
   coincidieron, ninguna política de ese rol se aplicaba y el acceso se
   negaba en silencio. Con estos tipos, eso no compila.
   --------------------------------------------------------------------- */

/** orden.estado — 001_esquema.sql */
export const ESTADO_ORDEN = ["ABIERTA", "EN_CURSO", "COMPLETA", "INFORMADA"] as const
export type EstadoOrden = (typeof ESTADO_ORDEN)[number]

/** orden.aptitud */
export const APTITUD = ["PENDIENTE", "APTO", "NO_APTO"] as const
export type Aptitud = (typeof APTITUD)[number]

/** orden.tipo_examen */
export const TIPO_EXAMEN = ["PRELABORAL", "PERIODICO", "EGRESO"] as const
export type TipoExamen = (typeof TIPO_EXAMEN)[number]

/** orden_estudio.estado — DERIVADO: fue a un laboratorio externo (RF19) */
export const ESTADO_ESTUDIO = ["PENDIENTE", "DERIVADO", "CARGADO"] as const
export type EstadoEstudio = (typeof ESTADO_ESTUDIO)[number]

/** persona.sexo — define qué estudios se agregan y contra qué referencia se compara */
export const SEXO = ["M", "F"] as const
export type Sexo = (typeof SEXO)[number]

/** plantilla_item.sexo_aplica — A ambos · M solo varón · F solo mujer */
export const SEXO_APLICA = ["A", "M", "F"] as const
export type SexoAplica = (typeof SEXO_APLICA)[number]

/** persona.tipo_doc */
export const TIPO_DOC = ["DNI", "LC", "LE", "CI", "PAS"] as const
export type TipoDoc = (typeof TIPO_DOC)[number]

/** rol.codigo — los ocho roles operativos de la SRS (A1–A8) */
export const ROL = {
  ADMINISTRADOR: "R1",
  RECEPCION: "R2",
  MEDICO_LABORAL: "R3",
  MEDICO_CLINICO: "R4",
  LABORATORIO: "R5",
  RAYOS: "R6",
  AUDIOMETRIA: "R7",
  PSICOLOGIA: "R8",
} as const
export type Rol = (typeof ROL)[keyof typeof ROL]

/** Cómo se muestra cada estado en pantalla. El valor guardado nunca cambia. */
export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  ABIERTA: "Abierta",
  EN_CURSO: "En curso",
  COMPLETA: "Completa",
  INFORMADA: "Informada",
}

export const ETIQUETA_APTITUD: Record<Aptitud, string> = {
  PENDIENTE: "Pendiente",
  APTO: "Apto",
  NO_APTO: "No apto",
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  R1: "Administrador",
  R2: "Recepción",
  R3: "Médico laboral",
  R4: "Médico clínico",
  R5: "Laboratorio",
  R6: "Rayos",
  R7: "Audiometría",
  R8: "Psicología",
}
