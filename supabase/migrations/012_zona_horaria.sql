-- =====================================================================
--  012 · LA BASE TIENE QUE VIVIR EN LA HORA DE LA CLÍNICA
--
--  Apareció un lunes 21:33 de Tucumán. La base respondía:
--
--      TimeZone = UTC · current_date = 2026-09-09
--
--  Es decir: para el sistema ya era mañana. Todo lo que usa
--  `current_date` estaba tres horas adelantado.
--
--  Qué rompía, concretamente:
--
--  · orden.fecha se llena con current_date. Una orden abierta a las
--    21:30 quedaba con la fecha del día siguiente, y desaparecía del
--    listado del día y de «pendientes del día». La recepcionista la
--    acaba de crear y no la encuentra.
--
--  · fecha_vencimiento es current_date + 12 meses, así que también
--    salía corrida un día.
--
--  Las columnas `timestamptz` (creado_at, cargado_at, informado_at) no
--  tienen este problema: guardan un instante absoluto y se muestran en
--  la zona de quien consulta. El problema es sólo de las fechas sueltas.
--
--  Se arregla acá y no en las pantallas. Que el navegador calcule «hoy»
--  en hora local no alcanza: si la base sigue estampando UTC, lo que se
--  guarda y lo que se busca no coinciden igual, y encima la diferencia
--  aparece sólo después de las 21:00 —cuando ya no hay nadie mirando.
--
--  Tucumán no tiene horario de verano desde 2009, pero se usa el nombre
--  de la zona y no un desplazamiento fijo: si algún día vuelve, esto
--  sigue estando bien.
-- =====================================================================

BEGIN;

ALTER DATABASE postgres SET timezone TO 'America/Argentina/Tucuman';

-- ALTER DATABASE toma efecto en sesiones NUEVAS. Esta sesión ya está
-- abierta, así que se cambia también acá para que el control de abajo
-- mida lo que va a pasar de verdad.
SET timezone TO 'America/Argentina/Tucuman';

DO $$
DECLARE v_zona text; v_fecha date;
BEGIN
  SELECT current_setting('TimeZone'), current_date INTO v_zona, v_fecha;
  RAISE NOTICE 'Zona horaria: % · hoy para la base: %', v_zona, v_fecha;
  IF v_zona <> 'America/Argentina/Tucuman' THEN
    RAISE EXCEPTION 'La zona horaria no quedó aplicada: %', v_zona;
  END IF;
END $$;

COMMIT;
