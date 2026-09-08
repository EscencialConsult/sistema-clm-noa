-- =====================================================================
--  02 · CATÁLOGO — categorías y estudios  ·  v2 (esquema de 18 tablas)
--  Generado desde el catálogo de la aplicación. No editar a mano:
--  corregir la planilla de validación y volver a generar.
-- =====================================================================

BEGIN;

-- ---------- categorías ----------
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('EXAMENES FISICOS', 1, 'R4', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('HEMOGRAMA', 2, 'R5', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('ORINA COMPLETA', 3, 'R5', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('OTRAS DETERMINACIONES', 4, 'R5', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('HEPATOGRAMA', 5, 'R5', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('TOXICOLOGICO', 6, 'R5', 'NEGATIVO');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('RADIOGRAFIAS', 7, 'R6', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('CARDIOLOGIA', 8, 'R3', 'NORMAL');
INSERT INTO categoria (nombre, orden, rol_carga, valor_defecto) VALUES ('ESPECIALIDADES', 9, 'R8', 'NORMAL');

-- ---------- estudios ----------

-- EXAMENES FISICOS · 18 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CABEZA', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CUELLO', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('DENTADURA', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PROTESIS', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('GLANDULAS MAMARIAS', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('APARATO RESPIRATORIO', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 6, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('APARATO CARDIOVASCULAR', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 7, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('REGION ABDOMINAL', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HERNIAS', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('REGION ANAL', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('MIEMBROS', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 11, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TENSION ARTERIAL', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 12, 'mmHg', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TALLA', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 13, 'mts', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PESO', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 14, 'Kg', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('I.M.C.', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 15, 'Kg/m2', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CIRCUNFERENCIA DE CINTURA', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 16, 'cm', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('VISION CROMATICA', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 17, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('AGUDEZA VISUAL', (SELECT id FROM categoria WHERE nombre='EXAMENES FISICOS'), 18, NULL, NULL, NULL);

-- HEMOGRAMA · 14 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ERITROCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 1, 'Mill/mm3', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('LEUCOCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 2, 'x mm3', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEMATOCRITO', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 3, '%', '43-53', '38-45');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEMOGLOBINA', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 4, 'g%', '13-18', '12-15');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RECUENTO DE PLAQUETAS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 5, 'mm3', '150000-350000', '150000-350000');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ERITROSEDIMENTACION 1° H', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 6, 'mm', '2-10', '3-12');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('MIELOCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 7, '%', '0', '0');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('METAMIELOCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 8, '%', '0-1', '0-1');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('N. DE CAYADO', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 9, '%', '3-5', '3-5');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('N. SEGMENTADOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 10, '%', '56-66', '56-66');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('EOSINOFILOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 11, '%', '0-5', '0-5');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BASOFILOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 12, '%', '0-1', '0-1');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('LINFOCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 13, '%', '27-37', '27-37');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('MONOCITOS', (SELECT id FROM categoria WHERE nombre='HEMOGRAMA'), 14, '%', '4-6', '4-6');

-- ORINA COMPLETA · 16 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLOR', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ASPECTO', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('SEDIMENTO', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('REACCION', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('DENSIDAD', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PH', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 6, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CELULAS', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 7, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('LEUCOCITOS', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEMATIES', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('MUCUS', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CILINDROS', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 11, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('GLUCOSA', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 12, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CUERPO CETONICO', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 13, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PROTEINAS', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 14, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PIGMENTOS BILIARES', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 15, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEMOGLOBINA', (SELECT id FROM categoria WHERE nombre='ORINA COMPLETA'), 16, NULL, NULL, NULL);

-- OTRAS DETERMINACIONES · 19 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('UREMIA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 1, 'G/L', '0,10-0,45', '0,10-0,45');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('GLUCEMIA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 2, 'G/L', '0,70-1,10', '0,70-1,10');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CREATININA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 3, 'mg/l', '8-14', '8-14');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('URICEMIA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 4, 'mg/l', '25-60', '20-50');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLESTEROL TOTAL', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 5, 'g/l', '<2,0', '<2,0');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HDL COLESTEROL', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 6, 'g/l', '0,52±0,1', '0,65±0,16');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('LDL COLESTEROL', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 7, 'g/l', '<1,40', '<1,40');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TRIGLICERIDOS', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 8, 'g/l', '<1,50', '<1,50');
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('GRUPO SANGUINEO', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('FACTOR RH', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('SUB UNIDAD BETA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 11, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('V.D.R.L.', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 12, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEPATITIS A', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 13, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('IONOGRAMA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 14, 'mEq/l', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TSH', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 15, 'uUI/ml', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('T4 LIBRE', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 16, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEMOGLOBINA GLICOSILADA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 17, '%', NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLINESTERASA', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 18, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('IGE', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 19, NULL, NULL, NULL);

-- HEPATOGRAMA · 9 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TRANSAMINASA GLUTAMICO PIRUVICA (TGP)', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TRANSAMINASA GLUTAMICO OXALACETICA (TGO)', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('FOSFATASA ALCALINA', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TIEMPO DE PROTROMBINA', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ACTIVIDAD PROTROMBINA', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BILIRRUBINEMIA DIRECTA', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 6, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BILIRRUBINEMIA INDIRECTA', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 7, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BILIRRUBINEMIA TOTAL', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('GAMMA GT', (SELECT id FROM categoria WHERE nombre='HEPATOGRAMA'), 9, NULL, NULL, NULL);

-- TOXICOLOGICO · 11 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COCAINA', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('MARIHUANA (CANNABINOIDES)', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BENZODIACEPINAS', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ANFETAMINAS', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('BARBITURICOS', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('METANFETAMINA', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('LEVOMEPROMAZINA', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CLORPROMAZINA', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ALCOHOLEMIA', (SELECT id FROM categoria WHERE nombre='TOXICOLOGICO'), 11, NULL, NULL, NULL);

-- RADIOGRAFIAS · 15 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TORAX', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLUMNA DORSAL', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLUMNA LUMBOSACRA', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLUMNA CERVICAL', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('COLUMNA FERGUSSON', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX AMBAS MANOS', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 6, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX MANO DERECHA (F Y P)', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 7, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX CODO DERECHO', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX CODO IZQUIERDO', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX BRAZO DERECHO', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX FEMUR IZQUIERDO', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 11, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX MACIZO FACIAL', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 12, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX DEDO PULGAR (F Y P)', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 13, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX TOBILLO IZQUIERDO', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 14, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('RX AMBOS TOBILLOS (F Y P)', (SELECT id FROM categoria WHERE nombre='RADIOGRAFIAS'), 15, NULL, NULL, NULL);

-- CARDIOLOGIA · 2 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('E.C.G.', (SELECT id FROM categoria WHERE nombre='CARDIOLOGIA'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ERGOMETRIA', (SELECT id FROM categoria WHERE nombre='CARDIOLOGIA'), 2, NULL, NULL, NULL);

-- ESPECIALIDADES · 17 estudios
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('AUDIOMETRIA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 1, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ESPIROMETRIA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 2, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('EQUILIBRIOMETRICO', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 3, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ELECTROENCEFALOGRAMA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 4, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('EXAMEN NEUROLOGICO', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 5, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('EXAMEN OFTALMOLOGICO', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 6, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CAMPIMETRIA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 7, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('EXAMEN PSICOLOGICO', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 8, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TEST DE EPWORTH', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 9, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TEST DE TOLOUSE', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 10, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('TEST DE RAVEN', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 11, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('INDICE DE FRAMINGHAM', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 12, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('PPD', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 13, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('INTERCONSULTA PSIQUIATRICA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 14, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CONSULTA CON ESPECIALISTA', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 15, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HOMOLOGACION', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 16, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('ESTUDIOS AMBIENTALES', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 17, NULL, NULL, NULL);

-- ---------- conceptos facturables ----------
-- Lista de precios del 01/08/2026, sin IVA. Rubro 0003 = prelaborales.
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Básico de ley', 55000, '0003', 1);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Perfil lipídico', 25000, '0003', 2);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Hepatograma completo', 25000, '0003', 3);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Urea y creatinina', 27000, '0003', 4);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Grupo y factor', 11000, '0003', 5);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Rx columna lumbosacra', 25000, '0003', 6);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Rx columna cervical', 25000, '0003', 7);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Audiometría', 15000, '0003', 8);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Interconsulta psiquiátrica', 90000, '0003', 9);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Consulta con especialista', 66000, '0003', 10);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Estudios ambientales', 65000, '0003', 11);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Psicotécnico', 59000, '0003', 12);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Espirometría', 35000, '0003', 13);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('IgE', 35000, '0003', 14);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Electroencefalograma', 50000, '0003', 15);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Ergometría', 50000, '0003', 16);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Colinesterasa', 30000, '0003', 17);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Homologación', 30000, '0003', 18);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Hemoglobina glicosilada', 25000, '0003', 19);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Test de Epworth', 18000, '0003', 20);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Índice de Framingham', 18000, '0003', 21);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Sub unidad beta', 20000, '0003', 22);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Equilibriométrico', 15000, '0003', 23);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('I.M.C.', 15000, '0003', 24);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('PPD', 12000, '0003', 25);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('V.D.R.L.', 11000, '0003', 26);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Cocaína', 30000, '0003', 27);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Cannabinoides', 30000, '0003', 28);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Alcoholemia', 30000, '0003', 29);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Benzodiacepinas', 30000, '0003', 30);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Opiáceos', 30000, '0003', 31);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Anfetaminas', 30000, '0003', 32);
INSERT INTO concepto (nombre, precio, rubro, orden) VALUES ('Éxtasis', 30000, '0003', 33);

-- ---------- qué estudios cubre cada concepto ----------

-- Básico de ley · $55.000 · 52 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='CABEZA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='CUELLO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='DENTADURA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='PROTESIS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='GLANDULAS MAMARIAS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='APARATO RESPIRATORIO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='APARATO CARDIOVASCULAR';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='REGION ABDOMINAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='HERNIAS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='REGION ANAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='MIEMBROS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='TENSION ARTERIAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='TALLA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='PESO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='I.M.C.';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='CIRCUNFERENCIA DE CINTURA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='VISION CROMATICA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='EXAMENES FISICOS' AND e.nombre='AGUDEZA VISUAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='ERITROCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='LEUCOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='HEMATOCRITO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='HEMOGLOBINA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='RECUENTO DE PLAQUETAS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='ERITROSEDIMENTACION 1° H';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='MIELOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='METAMIELOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='N. DE CAYADO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='N. SEGMENTADOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='EOSINOFILOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='BASOFILOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='LINFOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='HEMOGRAMA' AND e.nombre='MONOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='COLOR';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='ASPECTO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='SEDIMENTO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='REACCION';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='DENSIDAD';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='PH';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='CELULAS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='LEUCOCITOS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='HEMATIES';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='MUCUS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='CILINDROS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='GLUCOSA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='CUERPO CETONICO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='PROTEINAS';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='PIGMENTOS BILIARES';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='ORINA COMPLETA' AND e.nombre='HEMOGLOBINA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='UREMIA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='GLUCEMIA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='RADIOGRAFIAS' AND e.nombre='TORAX';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Básico de ley' AND k.nombre='CARDIOLOGIA' AND e.nombre='E.C.G.';

-- Perfil lipídico · $25.000 · 4 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Perfil lipídico' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='COLESTEROL TOTAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Perfil lipídico' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='HDL COLESTEROL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Perfil lipídico' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='LDL COLESTEROL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Perfil lipídico' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='TRIGLICERIDOS';

-- Hepatograma completo · $25.000 · 9 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='TRANSAMINASA GLUTAMICO PIRUVICA (TGP)';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='TRANSAMINASA GLUTAMICO OXALACETICA (TGO)';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='FOSFATASA ALCALINA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='TIEMPO DE PROTROMBINA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='ACTIVIDAD PROTROMBINA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='BILIRRUBINEMIA DIRECTA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='BILIRRUBINEMIA INDIRECTA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='BILIRRUBINEMIA TOTAL';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hepatograma completo' AND k.nombre='HEPATOGRAMA' AND e.nombre='GAMMA GT';

-- Urea y creatinina · $27.000 · 2 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Urea y creatinina' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='UREMIA';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Urea y creatinina' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='CREATININA';

-- Grupo y factor · $11.000 · 2 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Grupo y factor' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='GRUPO SANGUINEO';
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Grupo y factor' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='FACTOR RH';

-- Rx columna lumbosacra · $25.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Rx columna lumbosacra' AND k.nombre='RADIOGRAFIAS' AND e.nombre='COLUMNA LUMBOSACRA';

-- Rx columna cervical · $25.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Rx columna cervical' AND k.nombre='RADIOGRAFIAS' AND e.nombre='COLUMNA CERVICAL';

-- Audiometría · $15.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Audiometría' AND k.nombre='ESPECIALIDADES' AND e.nombre='AUDIOMETRIA';

-- Interconsulta psiquiátrica · $90.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Interconsulta psiquiátrica' AND k.nombre='ESPECIALIDADES' AND e.nombre='INTERCONSULTA PSIQUIATRICA';

-- Consulta con especialista · $66.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Consulta con especialista' AND k.nombre='ESPECIALIDADES' AND e.nombre='CONSULTA CON ESPECIALISTA';

-- Estudios ambientales · $65.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Estudios ambientales' AND k.nombre='ESPECIALIDADES' AND e.nombre='ESTUDIOS AMBIENTALES';

-- Psicotécnico · $59.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Psicotécnico' AND k.nombre='ESPECIALIDADES' AND e.nombre='EXAMEN PSICOLOGICO';

-- Espirometría · $35.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Espirometría' AND k.nombre='ESPECIALIDADES' AND e.nombre='ESPIROMETRIA';

-- IgE · $35.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='IgE' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='IGE';

-- Electroencefalograma · $50.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Electroencefalograma' AND k.nombre='ESPECIALIDADES' AND e.nombre='ELECTROENCEFALOGRAMA';

-- Ergometría · $50.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Ergometría' AND k.nombre='CARDIOLOGIA' AND e.nombre='ERGOMETRIA';

-- Colinesterasa · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Colinesterasa' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='COLINESTERASA';

-- Homologación · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Homologación' AND k.nombre='ESPECIALIDADES' AND e.nombre='HOMOLOGACION';

-- Hemoglobina glicosilada · $25.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Hemoglobina glicosilada' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='HEMOGLOBINA GLICOSILADA';

-- Test de Epworth · $18.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Test de Epworth' AND k.nombre='ESPECIALIDADES' AND e.nombre='TEST DE EPWORTH';

-- Índice de Framingham · $18.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Índice de Framingham' AND k.nombre='ESPECIALIDADES' AND e.nombre='INDICE DE FRAMINGHAM';

-- Sub unidad beta · $20.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Sub unidad beta' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='SUB UNIDAD BETA';

-- Equilibriométrico · $15.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Equilibriométrico' AND k.nombre='ESPECIALIDADES' AND e.nombre='EQUILIBRIOMETRICO';

-- I.M.C. · $15.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='I.M.C.' AND k.nombre='EXAMENES FISICOS' AND e.nombre='I.M.C.';

-- PPD · $12.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='PPD' AND k.nombre='ESPECIALIDADES' AND e.nombre='PPD';

-- V.D.R.L. · $11.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='V.D.R.L.' AND k.nombre='OTRAS DETERMINACIONES' AND e.nombre='V.D.R.L.';

-- Cocaína · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Cocaína' AND k.nombre='TOXICOLOGICO' AND e.nombre='COCAINA';

-- Cannabinoides · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Cannabinoides' AND k.nombre='TOXICOLOGICO' AND e.nombre='MARIHUANA (CANNABINOIDES)';

-- Alcoholemia · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Alcoholemia' AND k.nombre='TOXICOLOGICO' AND e.nombre='ALCOHOLEMIA';

-- Benzodiacepinas · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Benzodiacepinas' AND k.nombre='TOXICOLOGICO' AND e.nombre='BENZODIACEPINAS';

-- Opiáceos · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Opiáceos' AND k.nombre='TOXICOLOGICO' AND e.nombre='OPIACEOS';

-- Anfetaminas · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Anfetaminas' AND k.nombre='TOXICOLOGICO' AND e.nombre='ANFETAMINAS';

-- Éxtasis · $30.000 · 1 estudio(s)
INSERT INTO concepto_estudio (concepto_id, estudio_id) SELECT c.id, e.id FROM concepto c, estudio e JOIN categoria k ON k.id = e.categoria_id WHERE c.nombre='Éxtasis' AND k.nombre='TOXICOLOGICO' AND e.nombre='EXTASIS';


-- ---------- estudios agregados tras revisar el sistema en producción ----------
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('V.D.R.L.', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 90, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('HEPATITIS A', (SELECT id FROM categoria WHERE nombre='OTRAS DETERMINACIONES'), 91, NULL, NULL, NULL);
INSERT INTO estudio (nombre, categoria_id, orden, unidad, ref_h, ref_m) VALUES ('CUESTIONARIO DE STOP BANG', (SELECT id FROM categoria WHERE nombre='ESPECIALIDADES'), 90, NULL, NULL, NULL);
COMMIT;
