-- =====================================================================
--  010 · QUIÉN PUEDE LLAMAR A CADA FUNCIÓN
--
--  Apareció al escribir los casos bloqueantes. Las funciones de negocio
--  son SECURITY DEFINER —tienen que serlo, porque escriben en tablas que
--  el usuario no toca directamente— pero eso significa que SALTAN RLS
--  por completo. Y estaban con permiso de ejecución para PUBLIC, o sea
--  también para `anon`: la clave que viaja al navegador.
--
--  Comprobado contra el sistema andando, sin ninguna sesión:
--    POST /rest/v1/rpc/crear_orden       → creó la orden
--    POST /rest/v1/rpc/emitir_protocolo  → pasó el control de rol y sólo
--                                          frenó en la regla de negocio
--
--  O sea: cualquiera con la clave pública podía abrir órdenes, y con la
--  orden completa podía firmar un APTO. RLS estaba bien; el agujero
--  estaba al lado, en la puerta que RLS no mira.
--
--  Se arreglan las dos mitades:
--    1. sacarle el permiso de ejecución a PUBLIC y a anon
--    2. controlar el rol ADENTRO de cada función, que es lo que sigue
--       valiendo aunque mañana alguien reparta permisos de más
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  crear_orden · la abre Recepción o el Administrador (RF11)
--  Igual que en 006, con dos cambios: el control de rol, y que si no
--  viene el usuario se toma el de la sesión (una orden sin saber quién
--  la abrió es un agujero en la auditoría, RF27).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_orden(
  p_persona     bigint,
  p_empresa     bigint,
  p_plantilla   bigint,
  p_tarea       text        DEFAULT NULL,
  p_tipo_examen varchar(12) DEFAULT 'PRELABORAL',
  p_usuario     bigint      DEFAULT NULL
) RETURNS bigint AS $fn$
DECLARE
  v_numero bigint;
  v_sexo   char(1);
  v_orden  bigint;
BEGIN
  -- Va acá adentro y no sólo en los permisos: la función corre como su
  -- dueño, así que sin esto alcanza con poder llamarla.
  IF NOT (soy_admin() OR tengo_rol('R2')) THEN
    RAISE EXCEPTION 'Una orden la abre Recepción o el Administrador';
  END IF;

  -- el UPDATE bloquea la fila: dos puestos a la vez no sacan el mismo número (CP-12)
  UPDATE numerador
     SET proximo_valor = proximo_valor + 1
   WHERE codigo = 'ORDEN'
  RETURNING proximo_valor - 1 INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'No existe el numerador ORDEN';
  END IF;

  SELECT sexo INTO v_sexo FROM persona WHERE id = p_persona;
  IF v_sexo IS NULL THEN
    RAISE EXCEPTION 'La persona % no existe', p_persona;
  END IF;

  INSERT INTO orden (numero, persona_id, empresa_id, plantilla_id,
                     tipo_examen, tarea, fecha_vencimiento, creado_por)
  VALUES (v_numero, p_persona, p_empresa, p_plantilla,
          p_tipo_examen, p_tarea,
          current_date + interval '12 months',
          coalesce(p_usuario, mi_usuario_id()))
  RETURNING id INTO v_orden;

  -- los estudios de la batería que aplican a este sexo (RF12)
  INSERT INTO orden_estudio (orden_id, estudio_id)
  SELECT v_orden, pi.estudio_id
    FROM plantilla_item pi
    JOIN estudio e ON e.id = pi.estudio_id AND e.activo
   WHERE pi.plantilla_id = p_plantilla
     AND pi.sexo_aplica IN ('A', v_sexo);

  -- una fila por categoría involucrada, para poder despachar de a bloques (RF16)
  INSERT INTO orden_categoria (orden_id, categoria_id)
  SELECT DISTINCT v_orden, e.categoria_id
    FROM orden_estudio oe
    JOIN estudio e ON e.id = oe.estudio_id
   WHERE oe.orden_id = v_orden;

  -- el importe se congela: un cambio de precio no reescribe lo ya facturado
  UPDATE orden SET importe = calcular_presupuesto(v_orden) WHERE id = v_orden;

  RETURN v_orden;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;


-- ---------------------------------------------------------------------
--  emitir_protocolo · la aptitud es del Médico laboral y de nadie más
--  (RF22 regla a · CP-19 · CP-21)
--
--  Además firma con SU matrícula: p_medico dejó de ser un dato que el
--  que llama elige, y pasó a salir del usuario de la sesión.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION emitir_protocolo(
  p_orden          bigint,
  p_aptitud        varchar(12),
  p_medico         bigint  DEFAULT NULL,
  p_preexistencias text    DEFAULT NULL,
  p_incapacidad    numeric DEFAULT NULL
) RETURNS void AS $fn$
DECLARE
  v_faltan int;
  v_prof   bigint;
BEGIN
  IF NOT tengo_rol('R3') THEN
    RAISE EXCEPTION 'La aptitud la fija únicamente el Médico laboral';
  END IF;

  IF p_aptitud NOT IN ('APTO','NO_APTO') THEN
    RAISE EXCEPTION 'La aptitud debe ser APTO o NO_APTO';
  END IF;

  -- Sin profesional asociado no hay matrícula que poner en el protocolo,
  -- así que no puede informar (CP-22 pide las dos matrículas).
  SELECT profesional_id INTO v_prof FROM usuario WHERE id = mi_usuario_id();
  IF v_prof IS NULL THEN
    RAISE EXCEPTION 'Este usuario no tiene profesional asociado: sin matrícula no se firma';
  END IF;
  IF p_medico IS NOT NULL AND p_medico <> v_prof THEN
    RAISE EXCEPTION 'No se puede informar a nombre de otro profesional';
  END IF;

  SELECT count(*) INTO v_faltan
    FROM orden_estudio
   WHERE orden_id = p_orden AND estado <> 'CARGADO';

  -- un estudio derivado tampoco deja cerrar: primero tiene que volver (RF19)
  IF v_faltan > 0 THEN
    RAISE EXCEPTION 'Quedan % estudios sin cargar', v_faltan;   -- CP-19
  END IF;

  UPDATE orden
     SET aptitud           = p_aptitud,
         preexistencias    = p_preexistencias,
         incapacidad_pct   = p_incapacidad,
         medico_laboral_id = v_prof,
         estado            = 'INFORMADA',
         informado_at      = now()
   WHERE id = p_orden;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;


-- ---------------------------------------------------------------------
--  cargar_categoria_normal · CP-13
--
--  «Se marca una categoría entera como NORMAL y los estudios quedan
--  cargados en una sola acción.» Es lo que hace la bioquímica con un
--  hemograma sin novedades: hoy tilda catorce casillas una por una.
--
--  Va SECURITY INVOKER a propósito. No necesita saltar RLS —la política
--  cargar_orden_estudio ya dice quién toca cada categoría— y dejándola
--  como invoker el permiso se controla solo. El chequeo explícito está
--  para que el error diga qué pasó, en lugar de actualizar cero filas y
--  hacer creer que salió bien.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cargar_categoria_normal(
  p_orden     bigint,
  p_categoria bigint
) RETURNS int AS $fn$
DECLARE
  v_estado varchar(12);
  v_rol    varchar(4);
  v_n      int;
BEGIN
  SELECT estado INTO v_estado FROM orden WHERE id = p_orden;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'No existe la orden %', p_orden;
  END IF;
  IF v_estado = 'INFORMADA' THEN
    RAISE EXCEPTION 'La orden ya está informada: para cambiar algo hay que reabrirla';
  END IF;

  SELECT rol_carga INTO v_rol FROM categoria WHERE id = p_categoria;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'No existe la categoría %', p_categoria;
  END IF;
  IF NOT (soy_admin() OR tengo_rol('R2') OR v_rol = ANY (mis_roles())) THEN
    RAISE EXCEPTION 'La categoría % no es de tu área', p_categoria;
  END IF;

  UPDATE orden_estudio oe
     SET estado      = 'CARGADO',
         resultado   = 'NORMAL',
         cargado_por = mi_usuario_id(),
         cargado_at  = now()
    FROM estudio e
   WHERE e.id = oe.estudio_id
     AND oe.orden_id    = p_orden
     AND e.categoria_id = p_categoria
     AND oe.estado      = 'PENDIENTE';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $fn$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cargar_categoria_normal IS
  'RF16 / CP-13. Deja una categoría entera en NORMAL de una sola vez. Invoker: RLS decide quién puede';


-- ---------------------------------------------------------------------
--  Y ahora sí, quién puede llamarlas.
--  anon es la clave que viaja al navegador: no ejecuta nada de negocio.
--
--  Las de apoyo (mi_usuario_id, mis_roles, tengo_rol, soy_admin) SÍ
--  quedan para anon: las usan las propias políticas de RLS al evaluar
--  una consulta sin sesión. Sin ese permiso, esa consulta devolvería un
--  error en vez de la lista vacía que corresponde.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION crear_orden(bigint,bigint,bigint,text,varchar,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION emitir_protocolo(bigint,varchar,bigint,text,numeric)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION calcular_presupuesto(bigint)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cargar_categoria_normal(bigint,bigint)                FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION crear_orden(bigint,bigint,bigint,text,varchar,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION emitir_protocolo(bigint,varchar,bigint,text,numeric)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_presupuesto(bigint)                          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cargar_categoria_normal(bigint,bigint)                TO authenticated, service_role;

COMMIT;
