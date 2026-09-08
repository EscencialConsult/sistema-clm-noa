# Mock Service Layer — KAPLAN maqueta

Todo lo de acá (`src/mock/`) es **100% descartable**. Ningún componente importa de esta carpeta directamente — siempre pasan por `src/services/`, que es lo único que sobrevive cuando llegue el backend real (Node/Express + PostgreSQL, ver ficha técnica del proyecto).

Los JSON usan `snake_case` a propósito, para que el día de mañana el mapeo a columnas de PostgreSQL sea directo sin renombrar campos.

## Qué es real vs. inventado

- **Nombres de estudios, categorías, precios de referencia** (`estudios_pendientes.json`, textos de `dashboard_admin.json`): salen del catálogo real de `cotizacion.html` y de los 27 RF del cliente — no son inventados, aunque los IDs y las cantidades sí son de relleno.
- **Personas, empresas, órdenes concretas** (`personas.json`, `empresas.json`, `ordenes.json`): 100% inventados, calcados de los mockups de referencia que pasó el cliente para tener números realistas en pantalla.
- **Usuarios/contraseñas** (`usuarios.json`): inventados para poder loguearse en la maqueta. `admin`/`admin` y `mlopez`/`1234` — nunca usar estas credenciales como patrón real, ver RNF-09/10 (auth real + HTTPS).

## Mocks activos

| Servicio | Mock que consume | Pantalla que lo usa | Por qué se reemplaza y con qué |
|---|---|---|---|
| `authService` | `usuarios.json` + `localStorage` | Login (`/`) | Por auth real contra el backend Node/Express (RF01/RF02), con hash de contraseña y JWT/sesión de servidor |
| `dashboardService` | `dashboard_admin.json` | Dashboard Administrador | Por endpoints agregados reales (`/api/dashboard/admin`) que calculen KPIs desde PostgreSQL |
| `ordenesService` | `ordenes.json`, `estudios_pendientes.json`, `personas.json`, `empresas.json` | Bandeja del profesional / Médico laboral | Por `/api/ordenes` y `/api/estudios-pendientes` reales, filtrados por rol en el backend (RF02) |
| `alertasService` | `alertas_personales.json` | Bandeja del profesional | Por un endpoint real de alertas por usuario |

## Cuando llegue el backend real

1. Borrar toda la carpeta `src/mock/` entera.
2. En cada archivo de `src/services/`, reescribir el cuerpo de cada método a un `fetch`/cliente HTTP real — mismo nombre de archivo, mismo objeto exportado, misma firma de función. Ningún componente debería necesitar cambios.
3. `authService.getSesionActual()` deja de leer `localStorage` y pasa a validar contra el token real de sesión del servidor.
