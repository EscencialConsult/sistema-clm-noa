#!/bin/bash
# Auto-deploy de KAPLAN en la X270 — corre cada minuto por cron.
# Mismo patrón que ~/comrural/deploy.sh: git fetch, si la rama avanzó,
# rebuild solo del contenedor de front. El repo es público (HTTPS, sin deploy key).
set -e
cd "$(dirname "$0")"

LOG="deploy.log"
echo "[$(date '+%F %T')] chequeando..." >> "$LOG"

git fetch origin main >> "$LOG" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date '+%F %T')] nuevo commit $REMOTE — redeploy" >> "$LOG"
  git reset --hard origin/main >> "$LOG" 2>&1
  docker compose up -d --build kaplan-front >> "$LOG" 2>&1
  echo "[$(date '+%F %T')] listo" >> "$LOG"
fi
