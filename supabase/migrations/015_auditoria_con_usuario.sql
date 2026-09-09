-- =====================================================================
--  015 · LA AUDITORÍA NO ESTABA REGISTRANDO QUIÉN
--
--  RF27: «El sistema registra toda modificación sensible con usuario,
--  fecha y hora, valor anterior y valor nuevo.»
--
--  Tenía fecha y hora. Usuario, no:
--
--      SELECT count(*) FILTER (WHERE usuario_id IS NULL) FROM auditoria;
--      → 10454 de 10454
--
--  El motivo está en el comentario de la función original: «el id del
--  usuario lo pone la aplicación en la sesión de la conexión», leyendo
--  current_setting('app.usuario_id'). Eso funciona con un backend que
--  abre una conexión por usuario. Acá no hay backend: PostgREST reparte
--  un pool de conexiones entre todos, y nadie ejecuta ese SET. La
--  variable nunca existió, el nullif la convertía en NULL, y la
--  auditoría anotaba fielmente que alguien —no se sabe quién— cambió
--  una aptitud.
--
--  Lo que sí llega hasta el trigger es el JWT de la petición, que es de
--  donde mi_usuario_id() saca el usuario. Se usa eso, y se deja el
--  current_setting como respaldo para cuando algo corre por psql (una
--  migración, un script de mantenimiento): ahí no hay JWT y conviene
--  poder decir quién fue si el operador se molesta en declararlo.
--
--  Una auditoría que no dice quién no sirve para lo único que se le
--  pide. Y el caso de prueba pasaba igual, porque comprobaba que la
--  fila apareciera y que nadie pudiera borrarla — no que nombrara a
--  alguien.
--
--  Las 10.454 filas viejas quedan como están: son de pruebas, y
--  reescribir auditoría es exactamente lo que la auditoría no debe
--  permitir.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS trigger AS $fn$
DECLARE
  v_usuario bigint;
  v_campo   text;
  v_ant     text;
  v_nue     text;
BEGIN
  -- 1 · el usuario de la sesión, sacado del JWT de la petición.
  --     Es el camino normal: todo lo que entra por la aplicación.
  BEGIN
    v_usuario := mi_usuario_id();
  EXCEPTION WHEN others THEN
    v_usuario := NULL;
  END;

  -- 2 · respaldo para lo que corre por psql, donde no hay JWT: un script
  --     de mantenimiento puede declarar quién lo ejecuta con
  --     SET app.usuario_id = '3';
  IF v_usuario IS NULL THEN
    BEGIN
      v_usuario := nullif(current_setting('app.usuario_id', true), '')::bigint;
    EXCEPTION WHEN others THEN
      v_usuario := NULL;
    END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_campo IN ARRAY TG_ARGV LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_campo, v_campo)
        INTO v_ant, v_nue USING OLD, NEW;
      IF v_ant IS DISTINCT FROM v_nue THEN
        INSERT INTO auditoria (usuario_id, tabla, registro_id, campo,
                               valor_anterior, valor_nuevo)
        VALUES (v_usuario, TG_TABLE_NAME, NEW.id, v_campo, v_ant, v_nue);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria (usuario_id, tabla, registro_id, campo, valor_nuevo)
    VALUES (v_usuario, TG_TABLE_NAME, NEW.id, '(alta)', 'creado');
  END IF;

  RETURN NEW;
END $fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER sigue siendo imprescindible: un trigger corre con los
-- permisos de QUIEN LO DISPARA, y auditoria no tiene política de escritura
-- a propósito (RNF-11). Sin esto, cada INSERT de un usuario normal muere
-- con 42501 y la auditoría bloquea todo el sistema.

COMMENT ON FUNCTION fn_registrar_auditoria IS
  'RF27. Toma el usuario del JWT de la petición (mi_usuario_id). El current_setting queda de respaldo para lo que corre por psql';

COMMIT;
