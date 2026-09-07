---
proyecto: KAPLAN — CML NOA (maqueta React, Incremento 1 Prelaboral)
fuente: cerebro-facundo/proyectos/kaplan-cml-noa/wiki/kaplan-kit-de-marca.md
colors:
  primary: "#0066CC"       # Azul Corporativo — CTA principal, isologo, acentos de marca
  primary-deep: "#0B2545"  # Azul Institucional — navbar/sidebar, franjas de fondo oscuras
  accent: "#3399FF"        # Celeste Médico — hover, bordes de tarjetas informativas
  surface: "#FFFFFF"       # Fondo por defecto — identidad clínica, NO warm neutral
  ink: "#0B2545"           # Texto principal (reusa el azul institucional)
  ink-soft: "#667085"      # Texto secundario, metadatos, líneas divisorias
  warning: "#D97706"       # Ámbar semántico — fuera de rango (RF17), NO es color de marca
  danger: "#DC2626"        # Rojo semántico — devuelto, vencido
  success: "#16A34A"       # Verde semántico — completo, apto
typography:
  body: "Inter"            # uso diario: formularios, tablas, menús — la que se usa en TODA la UI operativa
  display: "no-usar-en-UI" # tipografía Display institucional es exclusiva de piezas de marketing, nunca en pantallas de carga
rounded:
  sm: "6px"
  md: "10px"
  card: "14px"
spacing_base: "4px"
---

# DESIGN.md — KAPLAN / CML NOA

> Maqueta de UX en React + Tailwind v4 para validar pantallas del Incremento 1 (Prelaboral) antes de construir el frontend definitivo en Angular (decisión ya cerrada con el cliente, ver ficha técnica RNF-20). Este repo es descartable como código — lo que sobrevive es la decisión de diseño validada acá.

Fuente de verdad de la identidad: [[kaplan-kit-de-marca]] en el cerebro. Si hace falta un color/tamaño que no está acá, se agrega **primero** a esa nota, nunca directo al código.

---

## La Regla del Acento Único

El azul corporativo (`--color-primary`, `#0066CC`) se reserva para **una sola acción por pantalla** — el botón/link que de verdad importa (Ingresar, Generar Orden, Emitir Protocolo). El resto de los botones son secundarios (borde, sin relleno) o texto plano. Si dos elementos de la misma pantalla compiten por el azul sólido, uno de los dos está mal jerarquizado — no se resuelve poniendo los dos en degradé u opacidades distintas, se resuelve decidiendo cuál importa más.

## La Regla del Semáforo Ajeno a la Marca

Los estados clínicos/operativos (fuera de rango, devuelto, vencido, completo, apto) **nunca** usan el azul de marca — usan ámbar/rojo/verde semánticos estándar (`warning`/`danger`/`success` del token). Esto evita el bug típico de "todo es azul así que nada se distingue": el azul es identidad, no semántica de estado.

## La Regla Plana por Defecto

Sin sombras decorativas porque sí. Un `shadow` solo aparece si el elemento realmente flota sobre otro (un modal, la card de login sobre la foto de fondo, un dropdown) — nunca en una card de contenido dentro del flujo normal de la página. Se usa `border` con `--color-ink-soft` al 15-20% de opacidad para separar secciones, no sombra — subido a `border-2`/20% en el Dashboard (2026-09) porque con 1px/10% se leía "vacío/genérico"; el borde se refuerza, no se agrega sombra.

## La Regla de la Textura, No el Color, Contra el Vacío

Cuando una pantalla se siente "muy blanca", la solución **no** es teñir el fondo (`surface` sigue siendo blanco puro, ver tokens) — es agregar una textura sutil e invisible a simple vista (grilla de puntos al 10-12% de opacidad de `--color-ink-soft`, `background-size` chico) sobre el `<main>` del `AppShell`. Dilatación cero de la paleta, cero gradientes — sigue siendo blanco, solo deja de sentirse estéril.

## La Regla de la Tipografía Única

Inter en toda la interfaz operativa, variando peso (400 cuerpo, 500-600 énfasis, 700 títulos de sección). La tipografía Display institucional del kit **no entra al sistema** — es exclusiva de cartelería/marketing, nunca de una pantalla donde alguien está cargando un resultado de laboratorio.

## La Regla de la Raíz Literal

`/` es el login, no un redirect a `/login`. Si hay sesión activa (mock), `/` redirige a la bandeja según el rol logueado. No hay landing pública en este incremento — el sistema es 100% interno (RNF-20).

## La Regla del Sidebar por Rol

El sidebar de navegación no es un menú único — cambia su contenido según el rol de la sesión activa (Administrador ve Usuarios/Catálogo/Auditoría; un profesional de carga ve solo Bandeja/Pacientes/Legajos de su especialidad; RNF-17: 0 opciones ajenas visibles). Es un solo componente `Sidebar`, pero su lista de items sale de una config por rol, nunca hardcodeada por pantalla.

Es además colapsable: al ocultar, **se esconden las etiquetas de texto, los íconos quedan exactamente en el mismo lugar** (no se centran ni se reacomodan) — es la única transición permitida (`width`, con excepción explícita a "transform/opacity únicamente" porque no hay equivalente de transform para un sidebar que cambia de ancho). El logo también cambia: completo cuando está expandido, isotipo solo cuando está colapsado — nunca se deja el logo completo apretado en una barra angosta.

---

## La Regla de la Excepción del Login

El login es la única pantalla donde se permite foto/gradiente de fondo con tinte de marca y card semi-transparente (`bg-white/90` + `backdrop-blur`) — es la puerta de entrada institucional, no una pantalla operativa. Se probó un fondo animado con shader WebGL (`FondoAnimado.jsx`) y se descartó — daba problemas de cache/consistencia entre navegadores y no sumaba lo suficiente como para justificar la complejidad; el fondo del login es estático. **Ninguna otra pantalla del sistema** (bandeja, formularios de carga, legajo, dashboards) usa glassmorphism ni fondos animados — ahí rige la Regla Plana por Defecto sin excepción, porque son pantallas donde alguien está leyendo datos clínicos, no una vidriera.

## Qué NO hacer

- Gradientes decorativos o glassmorphism en cualquier pantalla que no sea el login (ver excepción arriba) — el resto es un sistema clínico/administrativo, no una landing de producto.
- Nada de emojis en la UI de producción (el mockup de referencia tenía un 👋 en "Hola, Administrador" — se reemplaza por tipografía sola).
- Nada de badges de colores random por categoría — los únicos colores de estado son los 3 semánticos del token (`warning`/`danger`/`success`).
- Ningún hex/px hardcodeado en un componente que no salga de este archivo o de `src/index.css`.
