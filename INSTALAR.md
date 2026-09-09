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

## 0 · Si esto va al servidor de la clínica

Saltear esta parte en una máquina de desarrollo. En la clínica **es el paso que
más cuesta deshacer después**, porque la dirección del servidor queda grabada
dentro de la aplicación al compilarla (ver el recuadro más abajo).

### La máquina

| | Por qué |
|---|---|
| **Una PC dedicada** | No la de recepción, no la de un médico. Si alguien la apaga o la usa para otra cosa, se cae el sistema para todos |
| **UPS** | Un corte de luz con la base escribiendo puede dejarla inconsistente. Es el respaldo más barato que existe |
| **Disco externo** | Ahí van los backups de todas las noches (paso 7). Que quede conectado |
| **Que no se suspenda** | Configurarla para que nunca entre en suspensión ni apague el disco |

### La red — esto va ANTES de generar las claves

El servidor necesita una **IP fija** en la red de la clínica. Pedírsela a quien
maneje el router, o fijarla en el adaptador.

Después hay que decidir con qué nombre lo ven las demás PC, y escribirlo en
`SITE_URL`. Dos opciones:

| Opción | Cómo | Cuándo conviene |
|---|---|---|
| **La IP directa** | `SITE_URL=http://192.168.1.50` | Más simple. Si algún día cambia la IP, hay que recompilar |
| **Un nombre** | `SITE_URL=http://servidor-cml` y una línea en el `hosts` de cada PC | Más prolijo, pero hay que tocar puesto por puesto |

En Windows el `hosts` está en `C:\Windows\System32\drivers\etc\hosts` y se edita
como Administrador. La línea es:

```
192.168.1.50    servidor-cml
```

**Fijalo antes de seguir**, con la IP real del servidor:

```bash
export SITE_URL=http://192.168.1.50
```

> **Por qué importa el orden.** La aplicación no lee esa dirección cuando
> arranca: la trae grabada de cuando se compiló. Si generás las claves o
> compilás con la dirección equivocada, los puestos abren la pantalla de login y
> no pueden entrar, sin ningún error que lo explique. Se arregla corrigiendo el
> `.env` y recompilando con `docker compose up -d --build`, pero es media hora
> perdida y un susto al pedo.

### Comprobar que se llega desde otro puesto

Con el sistema ya levantado, parada **en otra PC de la clínica**:

```bash
curl http://192.168.1.50:8000/rest/v1/
```

Si no responde, casi siempre es el firewall de Windows del servidor: hay que
permitir los puertos **80** y **8000** en la red privada. Mientras eso no ande,
el sistema funciona sólo en la máquina donde está instalado — que es lo mismo
que no servir.

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

## 4 · Crear el bucket de los informes

```bash
node scripts/crear-bucket.js
```

Acá se guardan los informes que llegan de afuera ya firmados: el ECG, la
campimetría, el EEG y las declaraciones juradas escaneadas.

Va aparte de las migraciones porque cuando estas corren, la tabla de buckets
todavía es la versión base de la imagen y le faltan columnas — el servicio de
Storage las agrega recién al arrancar.

## 5 · Crear el primer usuario

```bash
node scripts/crear-usuario.js admin@cmlnoa.local admin "Administrador" R1
```

Te devuelve una contraseña provisional. El sistema obliga a cambiarla en el
primer ingreso, así que no hace falta anotarla en ningún lado.

Los roles: `R1` administrador · `R2` recepción · `R3` médico laboral ·
`R4` médico clínico · `R5` laboratorio · `R6` rayos · `R7` audiometría ·
`R8` psicología.

**El médico laboral (`R3`) lleva un dato más:** el id del profesional, porque el
protocolo se firma con su matrícula. Sin eso entra al sistema pero no puede
informar ninguna orden.

```bash
docker compose exec -T db psql -U supabase_admin -d postgres \
  -c "SELECT id, apellido_nombre, matricula_prov FROM profesional"

node scripts/crear-usuario.js kaplan@cmlnoa.local rkaplan "Rubén Kaplan" R3 1
```

**Un usuario por persona.** Compartir una cuenta deja la auditoría sin sentido,
que es lo único que después permite saber quién cargó qué.

## 6 · Entrar

| | |
|---|---|
| **Producción** | `http://localhost` — el contenedor `app` |
| **Desarrollo** | `cd app && npm install && npm run dev` → `http://localhost:5173`, con recarga automática |

Al entrar se escribe solo el usuario (`admin`), sin el correo.

## 7 · Programar el backup de todas las noches

Esto **no es opcional en la clínica**. Son historias clínicas: si se pierde el
disco y no hay copia, no hay de dónde sacarlas.

Probá primero que corra a mano, apuntando al disco externo:

```bash
node scripts/backup.js D:/backups-cmlnoa
```

Sale un archivo `cmlnoa-<fecha>.sql.enc`, **cifrado con AES-256-GCM**. Va cifrado
porque después ese mismo archivo sube a la nube: el proveedor guarda el respaldo
sin poder leer nada. Se conservan 30 días; los más viejos se borran solos.

Y ahora que corra solo, todas las noches a las 02:00 (Windows, en una consola
como Administrador — cambiá la ruta si el proyecto está en otro lado):

```bat
schtasks /Create /TN "CML NOA - Backup" /SC DAILY /ST 02:00 /RL HIGHEST /RU SYSTEM ^
  /TR "cmd /c cd /d C:\cmlnoa\sistema-clm-noa && node scripts\backup.js D:\backups-cmlnoa"
```

En Linux, lo mismo con cron: `0 2 * * * cd /opt/cmlnoa && node scripts/backup.js /mnt/backup`

Comprobá al otro día que el archivo de anoche esté ahí. Una tarea programada que
nadie miró nunca es lo mismo que no tener backup.

### La clave de los backups

`generar-claves.js` dejó una `BACKUP_KEY` en el `.env`. Con esa clave se cifran y
se abren las copias.

**Guardá una copia de esa clave fuera del servidor** — impresa, en la caja de la
clínica. El `.env` vive en el servidor: si el servidor se pierde y la clave estaba
solamente ahí, los respaldos siguen existiendo pero no se pueden abrir, y no
sirven para nada.

### Restaurar

```bash
node scripts/restaurar.js backups/cmlnoa-2026-09-08-02-00-00.sql.enc
```

Pisa la base actual, así que pide que escribas `restaurar` para seguir. Después
acomoda los permisos de los esquemas internos y reinicia los servicios: sin eso,
los datos vuelven bien pero **no entra nadie al sistema**.

Cada tres meses hay que restaurar en una PC de prueba y **entrar al sistema** para
confirmar que el backup sirve (procedimiento P-02). Que los datos estén no alcanza.

---

## Comprobar que quedó bien

```bash
node scripts/verificar-frontend.js       # el frontend y la base dicen lo mismo
node scripts/probar-casos.js             # los casos bloqueantes
cd app && node scripts/probar-permisos.mjs   # qué puede cada rol
cd app && node scripts/probar-aptitud.mjs
cd app && node scripts/probar-alta-orden.mjs
cd app && node scripts/probar-terceros.mjs
```

Cada una se crea sus propios usuarios y datos, y borra todo al terminar.
Se pueden correr sobre la clínica sin tocar nada real.

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
