#!/bin/bash
# =====================================================================
#  Despliegue automático — APAGADO POR DEFECTO
#
#  Servía cuando esto era una maqueta descartable: se commiteaba y en un
#  minuto el cliente lo veía. Para un sistema que va a atender pacientes
#  no sirve, por tres motivos:
#
#    · Despliega sin que nadie lo pruebe. Un commit a medio hacer entra
#      igual, y del otro lado hay gente cargando exámenes.
#    · Hace `git reset --hard`: cualquier cosa sin commitear en el
#      servidor se pierde sin aviso.
#    · Sale de un repositorio público. Quien lo comprometa, se queda con
#      el servidor de la clínica.
#
#  Para producción el despliegue es deliberado: se prueba, se decide, se
#  actualiza. El procedimiento está en 08_Procedimientos.
#
#  Si aun así se quiere el automático en una máquina de pruebas, hay que
#  crear el archivo AUTODEPLOY_HABILITADO al lado de este script. No
#  alcanza con tener el cron: la ausencia de ese archivo lo detiene.
# =====================================================================
set -e
cd "$(dirname "$0")"

LOG="deploy.log"

if [ ! -f AUTODEPLOY_HABILITADO ]; then
  # Silencioso a propósito: corre cada minuto, no tiene sentido llenar
  # el log con lo mismo. Se sabe que está apagado porque el archivo no está.
  exit 0
fi

echo "[$(date '+%F %T')] chequeando..." >> "$LOG"

git fetch origin main >> "$LOG" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date '+%F %T')] nuevo commit $REMOTE — redeploy" >> "$LOG"
  git reset --hard origin/main >> "$LOG" 2>&1
  # Levanta la pila entera. El servicio kaplan-front ya no existe: se
  # reemplazó por db, auth, rest, storage, kong y app.
  docker compose up -d --build >> "$LOG" 2>&1
  echo "[$(date '+%F %T')] listo" >> "$LOG"
fi
