# Checklist — el día que llega la PC de la clínica

Guía propia, pensada para hacerla solo, sin poder preguntarle a Santiago ni a
Marcela en el momento. Es el mismo procedimiento que ya está en `INSTALAR.md`
(esa es la referencia completa, con el porqué de cada paso) — esto es el
mismo orden pero como lista de tareas para tildar, con lo que más te puede
trabar marcado aparte.

**Regla general: no saltees pasos ni los hagas en otro orden.** El punto 0
(red) va antes que las claves porque la dirección del servidor queda grabada
adentro de la app al compilarla — si te salteás el orden, se arma bien pero
nadie puede entrar, y no tira ningún error que lo explique.

---

## Antes de tocar la PC

- [ ] Verificar que la PC es **dedicada** (no la de recepción, no la de un
      médico). Si no lo es, frenar acá y resolver eso primero — es la causa
      más común de que el sistema se caiga después sin que nadie sepa por qué.
- [ ] Conectar la **UPS**.
- [ ] Conectar el **disco externo** de backups y dejarlo puesto siempre.
- [ ] Windows: quitar suspensión y apagado de disco (Configuración → Energía
      → "Nunca").
- [ ] Instalar **Docker Desktop**.
- [ ] Instalar **Node.js 22 o superior**. Confirmar con:
  ```bash
  node --version
  ```
  Si dice 20 o menos, el sistema arranca pero las pruebas del final fallan
  todas con "native WebSocket not found". No sigas hasta que diga 22+.

## 0 · Red — ANTES de generar claves

- [ ] Pedirle al que maneja el router una **IP fija** para esta PC (ej.
      `192.168.1.50`).
- [ ] Decidir `SITE_URL` — la IP directa es lo más simple si estás solo:
  ```bash
  export SITE_URL=http://192.168.1.50
  ```
- [ ] Anotar esa IP en algún lado físico (no solo en la terminal) — la vas a
      necesitar de nuevo en el paso de backup y en el de comprobación.

## 1 · Bajar el proyecto

```bash
git clone https://github.com/EscencialConsult/sistema-clm-noa.git
cd sistema-clm-noa
```

Clona directo en `main` — no hace falta cambiar de rama (la vieja rama
`estructura` ya no se usa, quedó vieja).

## 2 · Claves

```bash
node scripts/generar-claves.js
```

## 3 · Levantar

```bash
docker compose up -d
```

- [ ] Esperar unos minutos (baja imágenes la primera vez).
- [ ] Confirmar que las migraciones corrieron:
  ```bash
  docker compose logs db | grep "Control OK"
  ```
  Tiene que decir `Control OK: todo cargado y con RLS activo.` — si no
  aparece, **no sigas**, mirá `docker compose logs db` completo.

## 4 · Bucket de informes

```bash
node scripts/crear-bucket.js
```

## 5 · Primer usuario (admin)

```bash
node scripts/crear-usuario.js admin@cmlnoa.local admin "Administrador" R1
```

- [ ] Guardar la contraseña provisional que devuelve (o no — el sistema
      obliga a cambiarla en el primer ingreso).
- [ ] Crear el usuario del médico laboral (R3) — necesita el id del
      profesional:
  ```bash
  docker compose exec -T db psql -U supabase_admin -d postgres \
    -c "SELECT id, apellido_nombre, matricula_prov FROM profesional"

  node scripts/crear-usuario.js kaplan@cmlnoa.local rkaplan "Rubén Kaplan" R3 1
  ```
- [ ] Crear el resto de los usuarios que va a usar la clínica desde el día
      uno (recepción R2, laboratorio R5, rayos R6, etc.) — un usuario por
      persona, nunca compartido.

## 6 · Probar que entra

- [ ] Desde la misma PC: `http://localhost` → tiene que abrir el login.
- [ ] Desde **otro puesto de la clínica**:
  ```bash
  curl http://192.168.1.50:8000/rest/v1/
  ```
  Si no responde: casi siempre es el firewall de Windows del servidor —
  permitir los puertos **80** y **8000** en la red privada.

## 7 · Backup automático — no es opcional

- [ ] Probar a mano primero:
  ```bash
  node scripts/backup.js D:/backups-cmlnoa
  ```
- [ ] Programar la tarea diaria a las 02:00 (ver el comando exacto en
      `INSTALAR.md`, sección 7). **Ojo: `/RU` tiene que ser tu usuario, nunca
      `SYSTEM`** — si no, la tarea corre pero no encuentra Docker y falla
      todas las noches sin avisar.
- [ ] Guardar la `BACKUP_KEY` del `.env` **impresa, fuera del servidor** (en
      la caja de la clínica). Sin esa clave los backups existen pero no se
      pueden abrir.
- [ ] Al otro día: comprobar que el archivo de anoche está en el disco y que
      pesa algo — no confiar en que la tarea "dice que corrió bien".

## 8 · Que vuelva solo después de un corte de luz

Esto es lo que más importa hacer bien estando solo, porque si falla no te
enterás hasta que una recepcionista no puede abrir una orden.

- [ ] `netplwiz` → inicio de sesión automático del usuario del servidor.
- [ ] Tarea programada que bloquea la pantalla 90 segundos después del
      inicio (comando exacto en `INSTALAR.md`).
- [ ] Docker Desktop → "Start Docker Desktop when you sign in".
- [ ] Tarea programada que corre `scripts/levantar.js` al iniciar sesión.
- [ ] **Probarlo de verdad: reiniciar la máquina.** Esperar 2-3 minutos,
      entrar desde otro puesto. Si entra, quedó bien. Hacer esta prueba el
      día de la instalación, no el día del primer corte de luz real.

## 9 · Verificación final — correr todo esto antes de dar por terminado

```bash
node scripts/verificar-frontend.js
node scripts/probar-casos.js
cd app && node scripts/probar-permisos.mjs
node scripts/probar-aptitud.mjs
node scripts/probar-alta-orden.mjs
node scripts/probar-terceros.mjs
```

Y la prueba de seguridad que más importa — sin sesión no se saca ni una fila:

```bash
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2)
curl -s "http://localhost:8000/rest/v1/persona?select=apellido" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Tiene que devolver `[]`. Si devuelve datos de pacientes, **frenar todo** —
la protección no está funcionando y hay que resolverlo antes de dejar el
sistema en uso.

---

## Si algo no anda y estás solo

No hay nadie a quien preguntarle en el momento, así que:

1. **No inventes un arreglo a mano.** Mirá primero la tabla "Cuando algo no
   anda" al final de `INSTALAR.md` — cubre los cuatro problemas más comunes
   (contenedor reiniciando, usuario sin fila, migraciones que no corrieron,
   migración editada que no toma).
2. **Guardá el log antes de tocar nada**: `docker compose logs > log-del-dia.txt`
   — si después necesitás mandarle esto a Santiago por WhatsApp para que te
   ayude a distancia, lo tenés a mano.
3. **Nunca `docker compose down -v`** para "probar si arranca de nuevo" — esa
   bandera `-v` borra la base entera. Si dudás, no la uses.
4. Si de verdad quedó trabado: la base tiene backup del día anterior (o de
   antes de instalar, si es el primer día). Perder un día de instalación es
   recuperable; perder la base sin backup no.

---

## Lo que YA está resuelto y no hay que decidir de nuevo

- El formato de los impresos (Hoja de ruta, Protocolo) — confirmado contra el
  papel real de la clínica, no hace falta validarlo de nuevo.
- La leyenda al pie del Protocolo ("Formato de protocolo propuesto por
  Escencial Consultora — pendiente de validación con el cliente") — **queda
  como está**, todavía no está confirmada con el cliente, no la saques por tu
  cuenta el día de la instalación.
- Puertos y claves de Kong (8000/80 en la PC dedicada) — ya vienen bien por
  default en `docker-compose.yml`, esos overrides con variables de entorno
  (`KONG_PUERTO_PUBLICO`, `APP_PUERTO_PUBLICO`) son solo para cuando el
  sistema corre compartido en el servidor X270 de oficina, no en la PC de la
  clínica.
