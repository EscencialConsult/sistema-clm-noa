# Levantar el sistema

Sirve igual para una máquina de desarrollo y para el servidor de la clínica.
Todo corre adentro: **no hace falta internet** una vez que las imágenes están bajadas.

---

## Antes de empezar

| Necesitás | Para qué |
|---|---|
| **Docker Desktop** (o Docker Engine + Compose) | Levanta la base, la autenticación, la API y el almacenamiento |
| **Node.js 20 o superior** | Solo para los scripts de claves y de usuarios |
| ~4 GB de RAM libres | Son seis contenedores |

---

## 1 · Bajar el proyecto

```bash
git clone https://github.com/EscencialConsult/sistema-clm-noa.git
cd sistema-clm-noa
git checkout estructura
```

## 2 · Generar las claves

```bash
node scripts/generar-claves.js
```

Crea `.env` y `app/.env` con la contraseña de la base y las claves de sesión.
**Los dos están fuera del repositorio** y no se comparten.

Si alguna vez hay que rehacerlas: `node scripts/generar-claves.js --forzar`.
Ojo, eso corta las sesiones abiertas.

## 3 · Levantar

```bash
docker compose up -d
```

La primera vez tarda unos minutos bajando imágenes. Después arranca en segundos.

**Mirá que las migraciones hayan corrido:**

```bash
docker compose logs db | grep "Control OK"
```

Tiene que decir:

```
NOTICE:  tablas=18 categorias=9 estudios=120 empresas=38 baterias=8
NOTICE:  Control OK: todo cargado y con RLS activo.
```

Si eso no aparece, algo falló en la carga y **la base quedó a medio armar**: mirá
`docker compose logs db` completo antes de seguir.

## 4 · Crear el primer usuario

```bash
node scripts/crear-usuario.js admin@cmlnoa.local admin "Administrador" R1
```

Te devuelve una contraseña provisional. El sistema obliga a cambiarla en el
primer ingreso, así que no hace falta anotarla en ningún lado.

Los roles: `R1` administrador · `R2` recepción · `R3` médico laboral ·
`R4` médico clínico · `R5` laboratorio · `R6` rayos · `R7` audiometría ·
`R8` psicología.

**Un usuario por persona.** Compartir una cuenta deja la auditoría sin sentido,
que es lo único que después permite saber quién cargó qué.

## 5 · Entrar

| | |
|---|---|
| **Producción** | `http://localhost` — el contenedor `app` |
| **Desarrollo** | `cd app && npm install && npm run dev` → `http://localhost:5173`, con recarga automática |

Al entrar se escribe solo el usuario (`admin`), sin el correo.

---

## Comprobar que quedó bien

```bash
cd app && node scripts/probar-login.mjs
```

Entra igual que el navegador, con la clave pública, y muestra qué ve cada rol.

Y esta es la prueba que más importa — **sin sesión no se saca ni una fila**:

```bash
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2)
curl -s "http://localhost:8000/rest/v1/persona?select=apellido" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Tiene que devolver `[]`. Esa clave es la que viaja al navegador y cualquiera
puede leerla: si devolviera datos, la protección no estaría funcionando.

---

## Cuando algo no anda

| Síntoma | Qué pasa |
|---|---|
| `docker compose ps` muestra algo en `Restarting` | Mirá `docker compose logs <servicio>`. Casi siempre es una variable que falta en `.env` |
| Entrás pero está todo vacío | El usuario existe en Auth pero no tiene fila en `usuario`. Crealo con el script, no a mano |
| `Control OK` no aparece | Las migraciones fallaron. **No sigas**: la base está incompleta |
| Cambiaste una migración y no toma | Solo corren al crear la base. Para rehacerla: `docker compose down -v && docker compose up -d` — **borra todos los datos** |

### Antes de tocar las migraciones

```bash
node scripts/verificar-migraciones.js
```

Compara los `INSERT` contra las columnas que de verdad existen. Sirve para no
descubrir a mitad de la carga que una columna se había quitado.

---

## Lo que NO se hace en producción

- **No usar `docker compose down -v`** en el servidor de la clínica: borra la base entera.
- **No habilitar el auto-deploy.** Está apagado a propósito (`deploy.sh`): desplegar
  sin que nadie pruebe, sobre un sistema que atiende pacientes, no es una opción.
- **No compartir el `.env`** por WhatsApp ni por correo. Si una clave se filtra,
  se regeneran todas.

El procedimiento completo de operación —backups, qué hacer si se rompe el
servidor, si se corta la luz o internet— está en `08_Procedimientos` de la
documentación.
