-- =====================================================================
--  017 · DAR DE ALTA UN USUARIO DESDE LA APLICACIÓN
--
--  RF01: los usuarios los crea el Administrador. Hasta ahora sólo se
--  podía desde la consola, con scripts/crear-usuario.js, porque crear
--  una cuenta necesita la SERVICE_ROLE_KEY y esa clave no puede viajar
--  al navegador — quien la tenga puede todo, sin RLS.
--
--  Eso servía mientras el que instalaba era el que programaba. Ya no: la
--  clínica está en Tucumán y el jueves hay que crear seis o siete
--  usuarios reales sin que nadie abra una terminal.
--
--  La salida es esta función. Corre DENTRO de la base, así que la clave
--  de servicio no entra en juego, y controla el rol adentro: sólo el
--  Administrador. La contraseña se guarda con el mismo bcrypt que usa
--  GoTrue —$2a$10$, que es lo que produce crypt(..., gen_salt('bf', 10))—
--  y por eso el usuario creado así entra igual que uno creado por la API.
--
--  Los campos están copiados de una cuenta real que funciona, con dos
--  que sólo se descubren probando: aud va vacío, y auth.identities.email
--  es una columna generada que no se puede insertar.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  Alta completa: cuenta + fila de usuario + rol, o nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_usuario_completo(
  p_usuario     varchar,
  p_nombre      varchar,
  p_rol         varchar,
  p_password    text,
  p_profesional bigint DEFAULT NULL
) RETURNS bigint AS $fn$
DECLARE
  v_email text;
  v_auth  uuid;
  v_id    bigint;
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Los usuarios los da de alta el Administrador (RF01)';
  END IF;

  IF p_usuario IS NULL OR btrim(p_usuario) = '' THEN
    RAISE EXCEPTION 'Falta el nombre de usuario';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña tiene que tener al menos 8 caracteres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rol WHERE codigo = p_rol) THEN
    RAISE EXCEPTION 'No existe el rol %', p_rol;
  END IF;

  -- El médico laboral firma el protocolo con su matrícula: sin
  -- profesional asociado entra al sistema y no puede informar nada.
  IF p_rol = 'R3' AND p_profesional IS NULL THEN
    RAISE EXCEPTION 'El Médico laboral necesita un profesional asociado: sin matrícula no puede firmar';
  END IF;

  v_email := lower(btrim(p_usuario)) || '@cmlnoa.local';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Ya hay un usuario %', p_usuario;
  END IF;

  v_auth := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous,
    -- Estos cuatro van en CADENA VACÍA, no en NULL. GoTrue los lee como
    -- texto y un NULL le revienta el scan: «error finding user: sql: Scan
    -- error on column index 3», que por fuera aparece como «Database
    -- error querying schema». Nada dice cuál columna es.
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    -- aud va VACÍO, no 'authenticated'. Es lo que escribe GoTrue en esta
    -- instalación y lo que busca al validar: con 'authenticated' la cuenta
    -- se crea perfecta, el hash valida, y el login igual rebota con
    -- «Invalid login credentials» sin decir por qué.
    v_auth, '00000000-0000-0000-0000-000000000000', '', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"email_verified": true}'::jsonb, now(), now(), false, false,
    '', '', '', ''
  );

  -- GoTrue crea también la identidad; sin ella algunos flujos no la ven
  -- auth.identities.email es una columna GENERADA: sale sola de
  -- identity_data->>'email'. Insertarla da 428C9.
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_auth::text, v_auth,
    jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
    'email', now(), now()
  );

  INSERT INTO usuario (usuario, nombre, auth_id, profesional_id, debe_cambiar)
  VALUES (btrim(p_usuario), btrim(p_nombre), v_auth, p_profesional, true)
  RETURNING id INTO v_id;

  INSERT INTO usuario_rol (usuario_id, rol_codigo) VALUES (v_id, p_rol);

  RETURN v_id;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION crear_usuario_completo IS
  'RF01. Cuenta, fila de usuario y rol, o nada. Sólo el Administrador. Nace con debe_cambiar en true';


-- ---------------------------------------------------------------------
--  Restablecer la contraseña de otro
--  Alguien se la olvida un martes a la mañana y no puede trabajar. El
--  Administrador se la cambia y el sistema le vuelve a pedir una nueva
--  al entrar: la provisional no queda como definitiva.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restablecer_password(
  p_usuario_id bigint,
  p_password   text
) RETURNS void AS $fn$
DECLARE v_auth uuid;
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Sólo el Administrador restablece contraseñas';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña tiene que tener al menos 8 caracteres';
  END IF;

  SELECT auth_id INTO v_auth FROM usuario WHERE id = p_usuario_id;
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'Ese usuario no tiene cuenta asociada';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   WHERE id = v_auth;

  UPDATE usuario SET debe_cambiar = true WHERE id = p_usuario_id;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restablecer_password IS
  'RF01. El Administrador la cambia y el sistema pide una nueva al entrar: la provisional no queda';


REVOKE ALL ON FUNCTION crear_usuario_completo(varchar,varchar,varchar,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION restablecer_password(bigint,text)                           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_usuario_completo(varchar,varchar,varchar,text,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION restablecer_password(bigint,text)                           TO authenticated, service_role;

COMMIT;
