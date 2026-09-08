-- =====================================================================
--  002 · ROLES
--  Van antes que el catálogo porque categoria.rol_carga los referencia:
--  si el catálogo corre primero, la clave foránea lo rechaza.
-- =====================================================================

BEGIN;

INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R1', 'Administrador', 'Usuarios, catálogo, plantillas y auditoría. Corrige cualquier dato con traza');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R2', 'Recepción', 'Admisión, órdenes, impresiones y corrección de errores');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R3', 'Médico laboral', 'Aptitud, preexistencias, incapacidad y emisión del protocolo');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R4', 'Médico clínico', 'Examen físico, antropometría, visión y cuestionarios');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R5', 'Laboratorio', 'Hemograma, orina, otras determinaciones, hepatograma y toxicológico');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R6', 'Rayos', 'Radiografías y adjunto del proveedor de imágenes');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R7', 'Audiometría', 'Audiograma y espirometría');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R8', 'Psicología', 'Psicotécnicos e informe psicológico');
INSERT INTO rol (codigo, nombre, descripcion) VALUES ('R9', 'Cobranzas', 'Consulta de prestaciones facturables y estado de cuenta');

COMMIT;
