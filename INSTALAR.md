# Levantar el sistema

Sirve igual para una máquina de desarrollo y para el servidor de la clínica.
Todo corre adentro: **no hace falta internet** una vez que las imágenes están bajadas.
Ni siquiera para la tipografía — está en el servidor, no en Google. Hay una
prueba que lo verifica sola (`app/scripts/probar-tipografia.mjs`): abre las
pantallas con internet bloqueado y comprueba que no salga un solo pedido afuera.

---

## Antes de empezar

| Necesitás | Para qué |
|---|---|
| **Docker Desktop** (o Docker Engine + Compose) | Levanta la base, la autenticación, la API y el almacenamiento |
| **Node.js 22 o superior** | Para los scripts de claves, usuarios, backup y actualización |
| ~4 GB de RAM libres | Son seis contenedores |

> **La versión de Node importa.** Con Node 20 la instalación anda, pero las
> baterías de prueba del final se caen todas con *"native WebSocket not
> found"*: la librería de Supabase necesita 22 o más. Se descubrió cuando el
> servidor de integración quedó en 20 y las cuatro pruebas fallaron a los
> cero segundos. Comprobalo con `node --version` antes de empezar.

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

### La red — por nombre, sin IP fija

Los puestos entran al servidor **por su nombre**, no por su número:

```
http://servidor-cml
```

No hace falta pedirle una IP fija a nadie, ni fijarla en el adaptador. Windows
resuelve solo el nombre de otra PC de la misma red, que es exactamente lo que
hacen hoy para llegar a una carpeta compartida.

Son dos cosas, y las dos se hacen en el servidor:

**1 · Ponerle ese nombre a la PC.** *Configuración → Sistema → Información del
sistema → Cambiar el nombre de este equipo*, escribir `servidor-cml` y
reiniciar. Sin espacios, sin acentos, todo en minúsculas.

**2 · Dejarlo escrito en el `.env`:**

```bash
export SITE_URL=http://servidor-cml
```

Y listo. Nada más de red.

> **Esto cambió, y para bien.** Antes la dirección quedaba grabada adentro del
> programa al compilarlo: había que fijar la IP *antes* de generar las claves,
> y si algún día cambiaba, tocaba recompilar. Ya no. La aplicación le pide los
> datos **al mismo lugar del que la bajó el navegador**, así que funciona igual
> entrando por `servidor-cml`, por la IP que le toque ese día, o por un enlace
> de Cloudflare para mostrarla de afuera. **Un cambio de IP no rompe nada y no
> obliga a recompilar.**

Un solo puerto, el **80**, el común de cualquier página. Los puestos no
necesitan llegar a ningún otro: el propio servidor reparte por dentro lo que
va a la base y lo que va a las pantallas.

#### Si alguna PC no encuentra el nombre

Pasa en redes con más de un router o con Wi-Fi de invitados separada. Se
resuelve en el puesto que falla, sin tocar el servidor: abrir
`C:WindowsSystem32driversetchosts` **como Administrador** y agregar al
final la IP que tenga el servidor en ese momento:

```
192.168.1.50    servidor-cml
```

Esa línea sí queda atada a la IP. Si el problema aparece en varios puestos,
conviene pedirle al del router una **reserva de DHCP** para el servidor: le da
siempre el mismo número sin configurarle nada a la PC, y el `hosts` deja de
moverse.

### Comprobar que se llega desde otro puesto

Con el sistema ya levantado, parada **en otra PC de la clínica**, abrir el
navegador en:

```
http://servidor-cml
```

Tiene que aparecer la pantalla de login. Si aparece y **se puede entrar**, la
red está bien: significa que el nombre resolvió y que el puerto 80 pasa.

Si no carga nada, son dos causas y se distinguen desde la misma PC:

```bash
ping servidor-cml
```

| Qué pasa | Qué es | Cómo se arregla |
|---|---|---|
| El `ping` no encuentra el nombre | La PC no resuelve `servidor-cml` | El `hosts` de acá arriba |
| El `ping` contesta pero el navegador no carga | El firewall del servidor | Permitir el puerto **80** en la red privada |

Alcanza con el **80**. El 8000 no hace falta abrirlo: los puestos no le hablan
nunca. Mientras esto no ande, el sistema funciona sólo en la máquina donde está
instalado — que es lo mismo que no servir.

---

## 1 · Bajar el proyecto

```bash
git clone https://github.com/EscencialConsult/sistema-clm-noa.git
cd sistema-clm-noa
```

Ya clona en `main`, que es la rama que se despliega — no hace falta cambiar de
rama. (La vieja `estructura` fue el nombre de la rama donde empezó este
backend; se fusionó a `main` hace tiempo y ya no existe.)

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
schtasks /Create /TN "CML NOA - Backup" /SC DAILY /ST 02:00 /RL HIGHEST ^
  /RU "%USERNAME%" /IT ^
  /TR "cmd /c cd /d C:\cmlnoa\sistema-clm-noa && node scripts\backup.js D:\backups-cmlnoa"
```

**Ojo con quién corre esa tarea. No pongas `/RU SYSTEM`.**

`backup.js` saca el volcado con `docker compose exec`, y Docker Desktop en
Windows sólo existe adentro de la sesión del usuario que inició Windows.
`SYSTEM` no tiene esa sesión: la tarea correría, no encontraría Docker, y
fallaría **todas las noches sin decir nada**. Un backup que nadie mira y que
además nunca corrió es peor que no tener backup, porque da tranquilidad falsa.

Por eso va con el usuario de la máquina y con `/IT`, y por eso el paso 8
—inicio de sesión automático— no es opcional: sin sesión iniciada no hay
Docker, y sin Docker no hay backup ni sistema.

**Comprobalo al otro día.** No que la tarea diga "se ejecutó correctamente":
que el archivo de anoche esté en el disco y pese lo que tiene que pesar.

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

## 8 · Que el servidor vuelva solo después de un corte

**Esto no es opcional en la clínica.** Es lo que decide si el sistema existe
o no la mañana después de un corte de luz.

Los seis servicios están puestos con `restart: unless-stopped`, así que
vuelven solos **siempre que Docker esté corriendo**. Y ahí está el problema:
Docker Desktop en Windows no arranca hasta que alguien inicia sesión.

Sin esto, el 100 % de las veces pasa lo mismo: se corta la luz, la máquina
reinicia, Windows queda en la pantalla de inicio, Docker nunca arranca, el
sistema no existe — y nadie se entera hasta que una recepcionista intenta
abrir una orden.

**a · Que Windows inicie sesión solo, y quede bloqueado.**

```bat
netplwiz
```

Destildá "Los usuarios deben escribir su nombre y contraseña", y poné la
contraseña del usuario del servidor. Después, para que la pantalla quede
bloqueada igual (la sesión sigue viva, Docker sigue corriendo, pero nadie
puede tocar nada sin la contraseña):

```bat
schtasks /Create /TN "CML NOA - Bloquear al iniciar" /SC ONLOGON /RL HIGHEST ^
  /TR "cmd /c timeout /t 90 && rundll32.exe user32.dll,LockWorkStation"
```

Los 90 segundos son para que Docker termine de levantar antes del bloqueo.

> **Por qué la sesión queda abierta.** Es la única forma de que Docker Desktop
> corra sin nadie presente. La pantalla bloqueada cubre el acceso físico. Si
> más adelante la clínica prefiere no dejar sesión abierta, la alternativa es
> mover el servidor a Linux, donde Docker corre como servicio y nada de esto
> hace falta.

**b · Que Docker Desktop arranque con la sesión.**

Docker Desktop → engranaje → General → tildar **"Start Docker Desktop when you
sign in"**.

**c · Que el sistema se levante solo.**

```bat
schtasks /Create /TN "CML NOA - Levantar" /SC ONLOGON /RL HIGHEST ^
  /RU "%USERNAME%" /IT ^
  /TR "cmd /c cd /d C:\cmlnoa\sistema-clm-noa && node scripts\levantar.js"
```

`levantar.js` espera a que Docker responda —después de encender puede tardar
un minuto largo—, levanta todo, comprueba que los seis servicios quedaron en
pie y lo deja anotado en `arranque.log`.

**d · Probalo de verdad: reiniciá la máquina.**

No alcanza con crear las tareas. Reiniciá, esperá dos o tres minutos sin tocar
nada, y desde **otro puesto** abrí el sistema. Si entra, quedó bien.

```bash
cat arranque.log      # tiene que decir "Sistema levantado"
```

Hacé esta prueba el día de la instalación, no el día del primer corte de luz.

---

## 9 · Cómo se actualiza más adelante

Cuando haya correcciones o cosas nuevas, en el servidor:

```bash
node scripts/actualizar.js --ver     # ¿hay algo nuevo? no toca nada
node scripts/actualizar.js           # actualiza
```

Hace todo en orden y se detiene en el primer error: backup **antes** de tocar
nada, baja los cambios, aplica las migraciones que falten, reconstruye la
aplicación, reinicia y corre las seis baterías de prueba. Si algo falla, te
dice dónde quedó el backup para volver atrás.

**En los puestos: F5.** No hay nada instalado en ellos — abren el navegador.
El servidor está configurado para que nunca les quede media versión vieja.

**Elegí el horario.** A las 8 de la mañana, antes del primer paciente. No a
las 11 con la sala llena.

**En el servidor no se editan archivos.** Si alguien tocó algo, `actualizar.js`
se planta y no sigue: un cambio hecho a mano en la clínica se pierde en la
próxima actualización y nadie se acuerda de que existía.

### Que avise solo cuando hay algo nuevo

Nadie va a acordarse de correr `--ver` todos los días. Esta tarea lo consulta a
la mañana y deja el aviso **abajo en la pantalla del sistema**, junto a la
versión:

```bat
schtasks /Create /TN "CML NOA - Revisar actualizaciones" /SC DAILY /ST 07:30 ^
  /RU "%USERNAME%" /IT ^
  /TR "cmd /c cd /d C:\cmlnoa\sistema-clm-noa && node scripts\revisar-actualizacion.js"
```

**Sólo avisa. No actualiza nada.** Es a propósito: reiniciar el sistema es una
decisión de quien sabe si hay gente esperando, no del reloj. Un despliegue
automático a las 10:40 tira abajo la carga de un examen y nadie entiende por qué.

Sin internet no falla: informa y termina bien, para que la tarea no aparezca
como fallida todos los días y se termine ignorando.

### No hace falta ninguna clave para actualizar

El repositorio es **público**, así que `git pull` en el servidor funciona sin
usuario ni contraseña ni token. No hay credenciales de GitHub en la clínica, que
es una cosa menos que cuidar y una menos que se pueda filtrar.

**Si algún día el repositorio pasa a privado**, el servidor necesita una llave de
sólo lectura (*deploy key*): se genera con `ssh-keygen` en el servidor, se carga
la parte pública en Settings → Deploy keys del repositorio **sin marcar
"Allow write access"**, y el `git clone` pasa a hacerse por SSH. Es lectura
solamente: desde el servidor no se puede escribir al repositorio.

Lo que **no** se instala en la clínica es nada de GitHub Actions. Eso corre en
las máquinas de GitHub cada vez que alguien sube un cambio, y ahí se entera antes
de que llegue acá.

### Qué migraciones tiene aplicadas esta base

```bash
node scripts/migrar.js --ver
```

La base lleva el registro de qué se le aplicó. Por eso se puede actualizar sin
adivinar, y por eso una migración que ya corrió **no se edita nunca**: se
corrige con una nueva. Si alguien edita una vieja, el sistema se planta y avisa.

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
