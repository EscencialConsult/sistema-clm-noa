-- =====================================================================
--  021 · El registro de qué migraciones se aplicaron
--
--  Hasta acá la base no sabía en qué versión estaba. Las migraciones se
--  aplicaban por /docker-entrypoint-initdb.d, que Postgres ejecuta UNA
--  sola vez: cuando el directorio de datos está vacío. Después, nunca
--  más.
--
--  O sea que agregar una migración nueva al repositorio y hacer git pull
--  en la clínica no hacía absolutamente nada. El archivo quedaba ahí sin
--  aplicarse, sin error y sin aviso. Cualquier corrección que tocara la
--  base era imposible de hacer llegar.
--
--  Esta tabla es lo que permite actualizar: quien aplica las migraciones
--  anota acá cuál corrió, y así se sabe cuáles faltan.
--
--  El hash existe para detectar el error más caro de todos: que alguien
--  edite una migración que YA corrió en producción. Ahí la base de la
--  clínica y el repositorio dicen cosas distintas para siempre, y no hay
--  forma de darse cuenta mirando. Con el hash, el que aplica se planta.
--
--  Acá sólo se crea la tabla. Quién la llena es el que aplica —el script
--  de instalación adentro del contenedor, o migrar.js desde afuera—,
--  porque el hash se calcula leyendo el archivo y desde SQL no se puede.
-- =====================================================================

CREATE TABLE IF NOT EXISTS migracion (
  nombre        varchar(160) PRIMARY KEY,
  hash          char(64)     NOT NULL,
  aplicada_at   timestamptz  NOT NULL DEFAULT now(),
  aplicada_por  varchar(20)  NOT NULL DEFAULT 'instalacion'
                CHECK (aplicada_por IN ('instalacion', 'actualizacion', 'adopcion'))
);

COMMENT ON TABLE  migracion IS
  'Qué migraciones se aplicaron a esta base. Sin esto no se puede actualizar.';
COMMENT ON COLUMN migracion.hash IS
  'SHA-256 del archivo. Si cambia, alguien editó una migración ya aplicada.';
COMMENT ON COLUMN migracion.aplicada_por IS
  'instalacion: base nueva · actualizacion: migrar.js · adopcion: ya estaba aplicada antes de existir este registro';

ALTER TABLE migracion ENABLE ROW LEVEL SECURITY;

-- Nadie la escribe desde la aplicación. La llenan los scripts, que entran
-- como dueños de la base y no pasan por las políticas. Se deja legible
-- para el Administrador para poder mostrar la versión en pantalla y
-- responder "¿en qué versión estás?" sin entrar al servidor.
DROP POLICY IF EXISTS leer_migracion ON migracion;
CREATE POLICY leer_migracion ON migracion FOR SELECT
  USING (soy_admin());

REVOKE ALL ON migracion FROM anon, authenticated;
GRANT SELECT ON migracion TO authenticated;
