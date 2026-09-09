# Cómo trabajar sobre esto

Para quien se suma al proyecto. Da por hecho que ya levantaste el sistema
siguiendo [INSTALAR.md](INSTALAR.md).

---

## Lo que ya está hecho

**La base entera.** No hay que escribir backend: no existe una carpeta con
controladores ni servicios de servidor. La API se genera sola desde las tablas.

| | |
|---|---|
| 18 tablas | esquema completo del prelaboral |
| 9 categorías, 120 estudios | el catálogo real del centro |
| 38 empresas, 8 baterías | los datos que usan hoy |
| Permisos por rol (RLS) | probados: cada rol ve solo lo suyo |
| Funciones | `crear_orden`, `calcular_presupuesto`, `emitir_protocolo`, `cargar_categoria_normal` |
| Triggers | fuera de rango por sexo, avance de estado, auditoría |
| Login | real, contra Supabase Auth |

**Lo que falta son las pantallas.** Están las carpetas vacías en
`app/src/features/`, una por cada parte del sistema.

---

## Cómo se consulta la base desde React

Siempre a través de `lib/supabase.js`, que es el único lugar que crea el cliente:

```js
import { supabase } from "../../../lib/supabase"
```

Estos ejemplos están todos probados contra la base corriendo.

### Buscar una persona por documento

```js
const { data } = await supabase
  .from("persona")
  .select("id, apellido, nombre, sexo, fecha_nac")
  .eq("nro_doc", documento)
  .maybeSingle()          // null si no existe: es el caso normal en admisión
```

### Dar de alta una persona

```js
const { data, error } = await supabase
  .from("persona")
  .insert({ tipo_doc: "DNI", nro_doc, apellido, nombre, sexo })
  .select()
  .single()
```

Si el documento ya existe, la base lo rechaza: hay una restricción de unicidad.
Ese error hay que mostrarlo, no esconderlo — es lo que evita que la misma
persona quede cargada cuatro veces, como pasa hoy.

### Empresas y baterías, para los desplegables

```js
const { data: empresas } = await supabase
  .from("empresa").select("id, razon_social").eq("activo", true).order("razon_social")

const { data: baterias } = await supabase
  .from("plantilla").select("id, nombre").eq("activo", true).order("nombre")
```

### Crear una orden

Esto **no** es un `insert`: es una función de la base, porque tiene que hacer
varias cosas juntas o ninguna.

```js
const { data: ordenId, error } = await supabase.rpc("crear_orden", {
  p_persona: personaId,
  p_empresa: empresaId,
  p_plantilla: bateriaId,
  p_tarea: "Conductor",
})
```

Sola hace: saca el número de la serie, **copia los estudios que corresponden al
sexo de la persona**, calcula el vencimiento a doce meses y congela el importe.

Con la batería de conductor: al varón le abre 55 estudios y $140.000, a la mujer
56 y $160.000 — la diferencia es la subunidad beta. Nadie tilda nada.

### La bandeja del día

Ya está resuelta en una vista, no hay que armar el `join`:

```js
const { data } = await supabase
  .from("v_orden_avance")
  .select("numero, paciente, documento, empresa, estado, estudios, cargados, pendientes, fuera_de_rango, importe")
  .order("numero", { ascending: false })
```

Devuelve, por ejemplo:

```json
{"numero":37946, "paciente":"LOPEZ, CARLOS", "empresa":"NCA",
 "estado":"ABIERTA", "estudios":55, "pendientes":55, "importe":140000.00}
```

### Las categorías con sus estudios, para la pantalla de carga

```js
const { data } = await supabase
  .from("categoria")
  .select("id, nombre, valor_defecto, estudio(id, nombre, unidad, ref_h, ref_m)")
  .order("orden")
```

`valor_defecto` es `NORMAL` en todas menos en toxicológico, que arranca en
`NEGATIVO`. Es lo que permite que la operadora no escriba "normal" catorce veces.

### Guardar un resultado

```js
await supabase
  .from("orden_estudio")
  .update({ resultado: "NORMAL", detalle: "44", estado: "CARGADO" })
  .eq("id", ordenEstudioId)
```

**No hay que calcular si está fuera de rango**: un trigger lo compara contra
`ref_h` o `ref_m` según el sexo de la persona y marca `fuera_de_rango` solo.
Tampoco hay que cambiar el estado de la orden: pasa sola a `COMPLETA` cuando no
queda ninguno pendiente.

### Toda una categoría en NORMAL, de una sola vez

```js
const { data: cargados } = await supabase.rpc("cargar_categoria_normal", {
  p_orden: ordenId,
  p_categoria: categoriaId,
})
```

Es el botón que la bioquímica va a usar todo el día: un hemograma sin novedades
son catorce casillas iguales. Devuelve cuántos estudios cargó, y sólo toca los
que estaban pendientes — no pisa nada ya escrito.

Si la categoría no es del área de quien la llama, devuelve error. No hace falta
esconder el botón: la base ya decide.

### Emitir el protocolo

```js
const { error } = await supabase.rpc("emitir_protocolo", {
  p_orden: ordenId,
  p_aptitud: "APTO",
  p_preexistencias: "HDL levemente bajo",
})
```

Si queda algún estudio sin cargar, devuelve error y no emite. Es a propósito.

**`p_medico` ya no se manda.** La matrícula sale del usuario de la sesión: cada
médico firma con la suya y no se puede informar a nombre de otro. Y sólo el
médico laboral puede llamarla — si la llama cualquier otro rol, rebota.

---

## Cuatro cosas que conviene tener presentes

**1 · Los permisos no se programan en la pantalla.**
La app lleva una clave pública que cualquiera puede leer en el navegador.
Esconder un botón no protege nada: la base rechaza igual. Si una consulta
devuelve `[]` o un error `42501`, probablemente **esté funcionando bien** —
ese rol no debía poder.

**2 · No inventes estados ni roles.**
Están en `app/src/types/dominio.ts`. Si escribís `"completo"` donde el esquema
dice `"COMPLETA"`, la consulta no falla: simplemente no trae nada, y se pierde
media tarde buscándolo. Ya pasó en este proyecto y en Carnicerías.

**3 · La lógica va en la base, no en el componente.**
Si estás por escribir un cálculo que tiene que dar igual desde cualquier
pantalla —un número correlativo, un precio, una comparación clínica— va como
función o trigger. Preguntá antes de resolverlo en el `.jsx`.

**4 · Las pantallas no cambian cuando cambia el origen de los datos.**
Los servicios de cada feature son la frontera. `authService` pasó de datos
inventados a Supabase real sin tocar una sola línea de las pantallas. Mantené
eso: el componente llama al servicio, el servicio habla con la base.

---

## Para probar sin romper nada

```bash
node scripts/verificar-frontend.js       # el frontend y la base dicen lo mismo
node scripts/probar-casos.js             # los casos bloqueantes
cd app && node scripts/probar-permisos.mjs   # qué puede cada rol
cd app && node scripts/probar-aptitud.mjs
cd app && node scripts/probar-alta-orden.mjs
cd app && node scripts/probar-terceros.mjs
```

Cada una se crea sus propios usuarios y sus propios datos, y borra todo al
terminar. Se pueden correr sobre la clínica sin tocar nada real, y devuelven 1
si algo falla.

**Corrélas antes de commitear.** No porque sí: casi todo lo que rompimos este
proyecto compilaba perfecto. Una columna renombrada, una vista sin la columna
que la pantalla pide, una función sin permiso de ejecución — `npm run build`
dice que está todo bien y la pantalla muestra «no hay datos».

`verificar-frontend.js` es el que atrapa esa clase: lee el código, saca cada
tabla, columna y función que nombra, y las compara contra la base.

Las otras cuatro recorren circuitos con el mismo cliente que usa el navegador y
sesiones reales de cada rol. Probar por psql como dueño de la base no sirve: ahí
los permisos no se aplican, y un caso como «recepción no puede fijar la aptitud»
da verde aunque recepción sí pueda. Ya pasó.

Y si dudás de si algo se puede ver sin estar logueado:

```bash
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2)
curl -s "http://localhost:8000/rest/v1/LA_TABLA?select=*" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Tiene que devolver `[]`. Si devuelve datos, hay un agujero — así se encontró que
las vistas mostraban nombre y DNI de pacientes sin ninguna sesión.

---

## Qué pantalla toma cada uno

| Carpeta | Qué va | Caso de uso |
|---|---|---|
| `features/padron/` | ✔ hecho — dentro de Nueva Orden y de Legajos | CU-05 |
| `features/ordenes/` | ✔ hecho — admisión, empresa y batería, crear orden, hoja de ruta | CU-06 |
| `features/carga/` | ✔ hecho — las dos grillas: categorías arriba, estudios abajo | CU-07 |
| `features/aptitud/` | ✔ hecho — bandeja de dictamen, APTO/NO APTO, protocolo | CU-11, CU-12 |
| `features/legajo/` | ✔ hecho — buscar persona y ver su historial | CU-11 |
| `features/catalogo/` | ✔ hecho — categorías, estudios y conceptos | CU-03 |
| `features/baterias/` | ✔ hecho — con el sexo por ítem | CU-04 |

Los casos de uso completos, con sus caminos alternativos, están en
`Documentacion_CML_NOA/02_Casos_de_Uso/`.
