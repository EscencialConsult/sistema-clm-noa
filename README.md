# sistema-clm-noa

Sistema de Gestión de Medicina Laboral — Centro Médico Laboral del NOA S.R.L.
(Escencial Consultora). **Incremento 1: Prelaboral.**

Cómo levantarlo: **[INSTALAR.md](INSTALAR.md)** · Cómo trabajar sobre esto: **[TRABAJAR.md](TRABAJAR.md)**

## Qué hay acá

| Carpeta | Qué es |
|---|---|
| `app/` | Las pantallas — React, organizadas por funcionalidad en `features/` |
| `supabase/` | La base: 7 migraciones con el esquema, el catálogo, las políticas RLS, las funciones y los triggers |
| `scripts/` | Generar claves, crear usuarios, verificar migraciones |
| `Docs/` | Requerimientos funcionales, ficha técnica y cotización real |

## Cómo funciona

Corre **entero adentro de la clínica**, sobre la red local: Supabase autoalojado
(PostgreSQL, autenticación, API y almacenamiento) más las pantallas. Sin internet
sigue funcionando — es el requisito que lo define, porque el sistema anterior se
cayó y volvieron al papel.

**No hay backend propio.** La API se genera desde las tablas, y la lógica vive en
la base como funciones y triggers: crear la orden, calcular el presupuesto,
marcar los valores fuera de rango y registrar la auditoría.

**La seguridad está en la base, no en la pantalla.** La aplicación lleva una clave
pública que cualquiera puede leer en el navegador, así que esconder botones no
protege nada: lo que protege son las políticas RLS, que se evalúan en cada
consulta venga de donde venga.

## Estado

La base, la autenticación y los permisos funcionan y están verificados contra la
pila corriendo. Las pantallas de admisión, carga y aptitud están en construcción.

La documentación del proyecto —requerimientos, casos de uso, casos de prueba,
diseño y procedimientos— está en `Documentacion_CML_NOA/`, fuera de este
repositorio.
