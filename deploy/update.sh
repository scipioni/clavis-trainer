#!/bin/sh
# Aggiornamento automatico su cubo (crontab ogni 5 minuti).
# Scarica l'immagine e ricrea il container se è cambiata l'immagine o la
# configurazione (per esempio il token del bot aggiunto in .env).
# Grazie ai layer riproducibili, di solito si scarica solo il layer dell'app.
set -eu
cd "$(dirname "$0")"
# CLAVIS_TAG per il rollback; docker-compose legge lo stesso file
if [ -f .env ]; then set -a; . ./.env; set +a; fi

IMAGE="scipioit/clavis-trainer:${CLAVIS_TAG:-latest}"
# la cartella del database deve appartenere a uid 1000 (utente bun nel container)
mkdir -p data

running=$(docker-compose ps -q clavis-trainer 2>/dev/null || true)
old=$(docker image inspect -f '{{.Id}}' "$IMAGE" 2>/dev/null || true)
docker-compose pull -q clavis-trainer
new=$(docker image inspect -f '{{.Id}}' "$IMAGE")

# impronta della configurazione risolta (compreso .env): non si salva il contenuto
cfg=$(docker-compose config 2>/dev/null | sha256sum | cut -c1-16)
oldcfg=$(cat .config-hash 2>/dev/null || true)

if [ "$old" != "$new" ] || [ "$cfg" != "$oldcfg" ] || [ -z "$running" ]; then
  docker-compose up -d --remove-orphans
  echo "$cfg" > .config-hash
  version=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$IMAGE")
  bot=$([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo "bot configurato" || echo "senza bot")
  why=$([ "$old" != "$new" ] && echo "nuova immagine" || { [ "$cfg" != "$oldcfg" ] && echo "configurazione cambiata" || echo "container fermo"; })
  echo "$(date -Is) avviata $IMAGE versione $version ($why, $bot)"
  # immagini vecchie di clavis-trainer rimaste senza tag
  docker image prune -f --filter "label=org.opencontainers.image.title=clavis-trainer" >/dev/null
fi
