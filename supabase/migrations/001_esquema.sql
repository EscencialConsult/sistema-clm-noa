-- =====================================================================
--  CENTRO MÉDICO LABORAL DEL NOA S.R.L.
--  Sistema de gestión — Incremento 1: PRELABORAL
--  Esquema de base de datos · PostgreSQL
--
--  Escencial Consultora · Septiembre de 2026
--
--  v2 — 18 tablas. Simplificado sobre la v1 (29 tablas) después de
--       revisar el sistema en producción: se quitó todo lo que no
--       existe hoy en su pantalla ni en su papel.
--       La v1 queda en _historial/01_esquema_v1_29tablas.sql
--
--  Cambios respecto de la v1:
--    ▼ Se quitaron 12 tablas: provincia, localidad, grupo_empresario,
--      empresa_contacto, proveedor, estudio_parametro, parametro_opcion,
--      precio_empresa, orden_estudio_valor y las 3 de cuestionarios.
--    ▲ Se agregó orden_categoria: el sistema actual guarda resultado y
--      detalle también a nivel categoría, no solo por estudio.
--    ▲ Se agregó orden.importe: congela el total al crear la orden, para
--      que un cambio de precio no reescriba lo ya facturado.
--
--  Orden de ejecución:
--     01_esquema.sql      ← este archivo
--     02_catalogo.sql     ← categorías y estudios
--     03_datos_base.sql   ← roles, plantillas, empresas, numerador
-- =====================================================================

BEGIN;

-- =====================================================================
--  1 · SEGURIDAD Y AUDITORÍA
-- =====================================================================

CREATE TABLE rol (
  codigo       varchar(20)  PRIMARY KEY,
  nombre       varchar(60)  NOT NULL,
  descripcion  text
);
COMMENT ON TABLE rol IS 'R1 administrador · R2 recepción · R3 médico laboral · R4 médico clínico · R5 laboratorio · R6 rayos · R7 audiometría · R8 psicología';

CREATE TABLE profesional (
  id               bigserial    PRIMARY KEY,
  apellido_nombre  varchar(120) NOT NULL,
  especialidad     varchar(120),
  matricula_prov   varchar(30),
  matricula_nac    varchar(30),
  es_externo       boolean      NOT NULL DEFAULT false,
  activo           boolean      NOT NULL DEFAULT true
);
COMMENT ON COLUMN profesional.matricula_nac IS 'Las dos matrículas se imprimen juntas al pie del protocolo: M.P. 934 - M.N. 5060';
COMMENT ON COLUMN profesional.es_externo IS 'Cardiología, oftalmología y laboratorio derivado informan desde su propio sistema';

CREATE TABLE usuario (
  id              bigserial    PRIMARY KEY,
  usuario         varchar(40)  NOT NULL UNIQUE,
  auth_id         uuid         UNIQUE,          -- el usuario en Supabase Auth
  nombre          varchar(120) NOT NULL,
  profesional_id  bigint       REFERENCES profesional(id),
  debe_cambiar    boolean      NOT NULL DEFAULT true,
  activo          boolean      NOT NULL DEFAULT true
);
COMMENT ON TABLE usuario IS 'Hoy la operación completa se hace con un único usuario compartido';
COMMENT ON COLUMN usuario.auth_id IS 'La contraseña la administra Supabase Auth. Acá solo vive el vínculo, el nombre y los roles';

CREATE TABLE usuario_rol (
  usuario_id  bigint      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rol_codigo  varchar(20) NOT NULL REFERENCES rol(codigo),
  PRIMARY KEY (usuario_id, rol_codigo)
);

CREATE TABLE auditoria (
  id              bigserial   PRIMARY KEY,
  usuario_id      bigint      REFERENCES usuario(id),
  fecha_hora      timestamptz NOT NULL DEFAULT now(),
  tabla           varchar(60) NOT NULL,
  registro_id     bigint      NOT NULL,
  campo           varchar(60),
  valor_anterior  text,
  valor_nuevo     text,
  motivo          text
);
CREATE INDEX ix_auditoria_registro ON auditoria (tabla, registro_id);
CREATE INDEX ix_auditoria_fecha    ON auditoria (fecha_hora DESC);
COMMENT ON TABLE auditoria IS 'Los cuatro datos que pidió el cliente: quién, cuándo, qué cambió, valor anterior y nuevo. Ningún rol la edita';

-- =====================================================================
--  2 · PADRÓN
-- =====================================================================

CREATE TABLE persona (
  id            bigserial    PRIMARY KEY,
  tipo_doc      varchar(6)   NOT NULL DEFAULT 'DNI'
                CHECK (tipo_doc IN ('DNI','LC','LE','CI','PAS')),
  nro_doc       varchar(20)  NOT NULL,
  apellido      varchar(80)  NOT NULL,
  nombre        varchar(80)  NOT NULL,
  sexo          char(1)      NOT NULL CHECK (sexo IN ('M','F')),
  fecha_nac     date,
  estado_civil  varchar(20),
  telefono      varchar(40),
  domicilio     varchar(160),
  ocupacion     varchar(80),
  CONSTRAINT uq_persona_doc UNIQUE (tipo_doc, nro_doc)
);
CREATE INDEX ix_persona_apellido ON persona (apellido, nombre);
COMMENT ON CONSTRAINT uq_persona_doc ON persona IS 'Una persona, un legajo. Hoy no se busca por documento y la misma figura hasta cuatro veces';
COMMENT ON COLUMN persona.sexo IS 'Define qué estudios se agregan (coca y marihuana al varón, subunidad beta a la mujer) y contra qué referencia se compara';
COMMENT ON COLUMN persona.fecha_nac IS 'La edad se calcula, no se almacena';

CREATE TABLE empresa (
  id            bigserial    PRIMARY KEY,
  codigo        varchar(20)  UNIQUE,
  razon_social  varchar(160) NOT NULL,
  cuit          varchar(15),
  domicilio     varchar(160),
  telefono      varchar(40),
  activo        boolean      NOT NULL DEFAULT true
);
CREATE INDEX ix_empresa_razon ON empresa (razon_social);
COMMENT ON COLUMN empresa.codigo IS 'Permite buscar tipeando, sin desplegar la lista';

-- =====================================================================
--  3 · CATÁLOGO  (los formularios de carga se generan desde acá)
-- =====================================================================

CREATE TABLE categoria (
  id             bigserial   PRIMARY KEY,
  nombre         varchar(60) NOT NULL UNIQUE,
  orden          smallint    NOT NULL DEFAULT 0,
  rol_carga      varchar(20) REFERENCES rol(codigo),
  valor_defecto  varchar(40) DEFAULT 'NORMAL',
  activo         boolean     NOT NULL DEFAULT true
);
COMMENT ON TABLE categoria IS 'Son las pestañas del sistema actual. Hoy no se pueden crear: «yo no sé cómo se abre una categoría»';
COMMENT ON COLUMN categoria.valor_defecto IS 'NORMAL en todas, salvo TOXICOLOGICO que arranca en NEGATIVO';

CREATE TABLE estudio (
  id            bigserial    PRIMARY KEY,
  codigo        varchar(20)  UNIQUE,
  nombre        varchar(140) NOT NULL,
  categoria_id  bigint       NOT NULL REFERENCES categoria(id),
  orden         smallint     NOT NULL DEFAULT 0,
  unidad        varchar(20),
  ref_h         varchar(40),
  ref_m         varchar(40),
  activo        boolean      NOT NULL DEFAULT true,
  CONSTRAINT uq_estudio_cat_nombre UNIQUE (categoria_id, nombre)
);
CREATE INDEX ix_estudio_categoria ON estudio (categoria_id, orden);
COMMENT ON COLUMN estudio.orden IS 'El orden del papel: eritrocitos, leucocitos, hematocrito... no alfabético';
COMMENT ON COLUMN estudio.unidad IS 'Se imprime en el protocolo: %, g/l, mm';
COMMENT ON COLUMN estudio.ref_h IS 'Se imprime en el protocolo — V(43-53). Cinco determinaciones difieren por sexo';
COMMENT ON COLUMN estudio.ref_m IS 'Se imprime en el protocolo — M(38-45)';

-- =====================================================================
--  4 · BATERÍAS  (el «básico de ley» y las de cada empresa)
-- =====================================================================

CREATE TABLE plantilla (
  id          bigserial    PRIMARY KEY,
  empresa_id  bigint       REFERENCES empresa(id),
  nombre      varchar(120) NOT NULL,
  activo      boolean      NOT NULL DEFAULT true
);
CREATE INDEX ix_plantilla_empresa ON plantilla (empresa_id) WHERE activo;
COMMENT ON COLUMN plantilla.empresa_id IS 'NULL es plantilla global, como el básico de ley';

CREATE TABLE plantilla_item (
  id            bigserial PRIMARY KEY,
  plantilla_id  bigint    NOT NULL REFERENCES plantilla(id) ON DELETE CASCADE,
  estudio_id    bigint    NOT NULL REFERENCES estudio(id),
  sexo_aplica   char(1)   NOT NULL DEFAULT 'A' CHECK (sexo_aplica IN ('A','M','F')),
  CONSTRAINT uq_plantilla_item UNIQUE (plantilla_id, estudio_id, sexo_aplica)
);
COMMENT ON COLUMN plantilla_item.sexo_aplica IS 'A ambos · M solo varón (cocaína y marihuana) · F solo mujer (subunidad beta). Reemplaza el «Gómez Pardo H / Gómez Pardo M» de hoy';

-- =====================================================================
--  5 · CONCEPTOS FACTURABLES
-- =====================================================================

CREATE TABLE concepto (
  id      bigserial     PRIMARY KEY,
  nombre  varchar(120)  NOT NULL UNIQUE,
  precio  numeric(12,2) NOT NULL DEFAULT 0,
  activo  boolean       NOT NULL DEFAULT true
);
COMMENT ON TABLE concepto IS 'Un concepto puede cubrir varios estudios: el básico de ley son 55.000 y cubre 52 determinaciones';

CREATE TABLE concepto_estudio (
  concepto_id  bigint NOT NULL REFERENCES concepto(id) ON DELETE CASCADE,
  estudio_id   bigint NOT NULL REFERENCES estudio(id),
  PRIMARY KEY (concepto_id, estudio_id)
);

-- =====================================================================
--  6 · ORDEN DE SERVICIO
-- =====================================================================

CREATE TABLE numerador (
  codigo         varchar(30) PRIMARY KEY,
  proximo_valor  bigint      NOT NULL
);
COMMENT ON TABLE numerador IS 'Continúa la serie existente. Evita que dos puestos generen el mismo número a la vez';

CREATE TABLE orden (
  id                 bigserial     PRIMARY KEY,
  numero             bigint        NOT NULL UNIQUE,
  persona_id         bigint        NOT NULL REFERENCES persona(id),
  empresa_id         bigint        NOT NULL REFERENCES empresa(id),
  plantilla_id       bigint        REFERENCES plantilla(id),
  tipo_examen        varchar(12)   NOT NULL DEFAULT 'PRELABORAL'
                     CHECK (tipo_examen IN ('PRELABORAL','PERIODICO','EGRESO')),
  tarea              varchar(140),
  fecha              date          NOT NULL DEFAULT current_date,
  fecha_vencimiento  date,
  estado             varchar(12)   NOT NULL DEFAULT 'ABIERTA'
                     CHECK (estado IN ('ABIERTA','EN_CURSO','COMPLETA','INFORMADA')),
  aptitud            varchar(12)   NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (aptitud IN ('PENDIENTE','APTO','NO_APTO')),
  preexistencias     text,
  incapacidad_pct    numeric(5,2),
  observaciones      text,
  importe            numeric(12,2),
  medico_laboral_id  bigint        REFERENCES profesional(id),
  informado_at       timestamptz,
  creado_por         bigint        REFERENCES usuario(id),
  creado_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_orden_persona ON orden (persona_id, fecha DESC);
CREATE INDEX ix_orden_empresa ON orden (empresa_id, fecha);
CREATE INDEX ix_orden_estado  ON orden (estado, fecha);
COMMENT ON COLUMN orden.estado IS 'EN_CURSO falta cargar algo · COMPLETA está todo y espera al médico laboral. Hoy ambos son «sin acción»';
COMMENT ON COLUMN orden.preexistencias IS 'Se registran aunque el resultado sea APTO';
COMMENT ON COLUMN orden.importe IS 'Total congelado al crear la orden. Un cambio de precio no reescribe lo ya facturado';

-- nivel «Tipo de» de la pantalla actual: la categoría con su propio resultado
CREATE TABLE orden_categoria (
  id            bigserial    PRIMARY KEY,
  orden_id      bigint       NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  categoria_id  bigint       NOT NULL REFERENCES categoria(id),
  resultado     varchar(120),
  detalle       text,
  CONSTRAINT uq_orden_categoria UNIQUE (orden_id, categoria_id)
);
COMMENT ON TABLE orden_categoria IS 'Permite despachar una categoría entera con un clic: HEMOGRAMA → NORMAL';

-- nivel «Estudios» de la pantalla actual
CREATE TABLE orden_estudio (
  id              bigserial    PRIMARY KEY,
  orden_id        bigint       NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  estudio_id      bigint       NOT NULL REFERENCES estudio(id),
  estado          varchar(12)  NOT NULL DEFAULT 'PENDIENTE'
                  CHECK (estado IN ('PENDIENTE','DERIVADO','CARGADO')),
  resultado       varchar(120),
  detalle         text,
  observacion     text,
  cargado_por     bigint       REFERENCES usuario(id),
  cargado_at      timestamptz,
  fuera_de_rango  boolean      NOT NULL DEFAULT false,
  CONSTRAINT uq_orden_estudio UNIQUE (orden_id, estudio_id)
);
CREATE INDEX ix_ordest_estado ON orden_estudio (estado);
COMMENT ON COLUMN orden_estudio.estado IS 'DERIVADO: enviado a un laboratorio o especialista externo (RF19). No cuenta como pendiente del centro, pero impide cerrar la orden hasta que vuelva. A quién se derivó va en observacion';
COMMENT ON COLUMN orden_estudio.resultado IS 'NORMAL, NEGATIVO — se imprime en la columna Resultado';
COMMENT ON COLUMN orden_estudio.detalle IS 'El valor medido: 4,8 — se compara contra ref_h/ref_m según el sexo';
COMMENT ON COLUMN orden_estudio.observacion IS 'El texto extra: «prótesis mamaria». Se imprime junto al resultado';

CREATE TABLE adjunto (
  id              bigserial    PRIMARY KEY,
  orden_id        bigint       NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  nombre_archivo  varchar(200) NOT NULL,
  ruta            varchar(400) NOT NULL,
  descripcion     varchar(200),
  subido_por      bigint       REFERENCES usuario(id),
  subido_at       timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE adjunto IS 'Informes externos ya firmados (ECG, campimetría) y las declaraciones juradas escaneadas. No se re-tipean';

-- =====================================================================
--  7 · VISTAS DE APOYO
-- =====================================================================

CREATE VIEW v_orden_avance AS
SELECT o.id, o.numero, o.fecha, o.estado, o.aptitud, o.importe,
       p.apellido || ', ' || p.nombre  AS paciente,
       p.tipo_doc || ' ' || p.nro_doc  AS documento,
       p.sexo,
       e.razon_social AS empresa,
       count(oe.*)                                    AS estudios,
       count(*) FILTER (WHERE oe.estado = 'CARGADO')   AS cargados,
       count(*) FILTER (WHERE oe.estado = 'PENDIENTE') AS pendientes,
       count(*) FILTER (WHERE oe.fuera_de_rango)       AS fuera_de_rango
FROM orden o
JOIN persona p ON p.id = o.persona_id
JOIN empresa e ON e.id = o.empresa_id
LEFT JOIN orden_estudio oe ON oe.orden_id = o.id
GROUP BY o.id, o.numero, o.fecha, o.estado, o.aptitud, o.importe,
         p.apellido, p.nombre, p.tipo_doc, p.nro_doc, p.sexo, e.razon_social;

CREATE VIEW v_pendientes AS
SELECT o.numero, o.fecha,
       p.apellido || ', ' || p.nombre AS paciente,
       e.razon_social AS empresa,
       c.nombre       AS categoria,
       es.nombre      AS estudio,
       c.rol_carga    AS rol_responsable
FROM orden_estudio oe
JOIN orden     o  ON o.id  = oe.orden_id
JOIN persona   p  ON p.id  = o.persona_id
JOIN empresa   e  ON e.id  = o.empresa_id
JOIN estudio   es ON es.id = oe.estudio_id
JOIN categoria c  ON c.id  = es.categoria_id
WHERE oe.estado = 'PENDIENTE'
  AND o.estado <> 'INFORMADA';

CREATE VIEW v_vencimientos AS
SELECT o.numero, o.fecha, o.fecha_vencimiento,
       p.apellido || ', ' || p.nombre AS paciente,
       p.tipo_doc || ' ' || p.nro_doc AS documento,
       e.razon_social AS empresa,
       (o.fecha_vencimiento - current_date) AS dias
FROM orden o
JOIN persona p ON p.id = o.persona_id
JOIN empresa e ON e.id = o.empresa_id
WHERE o.aptitud <> 'PENDIENTE'
  AND o.fecha_vencimiento BETWEEN current_date AND current_date + 30;

-- Las vistas deben correr con los permisos de QUIEN CONSULTA, no de quien
-- las creó. Sin esto saltean el RLS de las tablas de abajo: se probó y
-- v_orden_avance devolvía nombre y DNI del paciente sin ninguna sesión.
-- Toda vista que se agregue nace con esto.
ALTER VIEW v_orden_avance  SET (security_invoker = true);
ALTER VIEW v_pendientes    SET (security_invoker = true);
ALTER VIEW v_vencimientos  SET (security_invoker = true);

COMMIT;

-- =====================================================================
--  NOTAS DE IMPLEMENTACIÓN
--
--  1 · La pantalla de carga se arma leyendo `categoria` y sus `estudio`.
--      Reproduce las dos grillas del sistema actual: la de arriba escribe
--      en `orden_categoria`, la de abajo en `orden_estudio`.
--
--  2 · Al crear la orden se copian los `plantilla_item` que corresponden
--      al sexo de la persona:
--         varón  → sexo_aplica IN ('A','M')
--         mujer  → sexo_aplica IN ('A','F')
--      Una sola empresa, una sola batería: se termina el «Gómez Pardo H».
--
--  3 · Fuera de rango, al guardar:
--         ref := CASE persona.sexo WHEN 'F' THEN coalesce(ref_m, ref_h)
--                                           ELSE coalesce(ref_h, ref_m) END
--      Advierte, no bloquea.
--
--  4 · Estados de la orden:
--         ABIERTA  → EN_CURSO   al primer estudio cargado
--         EN_CURSO → COMPLETA   cuando no queda ninguno pendiente
--         COMPLETA → INFORMADA  al fijar la aptitud y emitir el protocolo
--      Emitida, los resultados quedan bloqueados: reabrir exige motivo,
--      que queda en `auditoria`.
--
--  5 · Presupuesto: se recorren los `concepto` de la orden, contando uno
--      solo si todos sus `concepto_estudio` están pedidos y ninguno fue
--      cubierto por un concepto anterior. El total se guarda una vez en
--      `orden.importe` y no se recalcula nunca más.
-- =====================================================================
