#!/bin/sh
# Aggiornamento automatico su cubo (crontab ogni 5 minuti).
# Scarica l'immagine; se è cambiata ricrea il container e scrive una riga di log.
# Grazie ai layer riproducibili, di solito si scarica solo il layer dell'app.
set -eu
cd "$(dirname "$0")"
# CLAVIS_TAG per il rollback (task deploy:rollback); docker-compose legge lo stesso file
if [ -f .env ]; then set -a; . ./.env; set +a; fi

IMAGE="scipioit/clavis-trainer:${CLAVIS_TAG:-latest}"
running=$(docker-compose ps -q clavis-trainer 2>/dev/null || true)
old=$(docker image inspect -f '{{.Id}}' "$IMAGE" 2>/dev/null || true)

docker-compose pull -q clavis-trainer
new=$(docker image inspect -f '{{.Id}}' "$IMAGE")

if [ "$old" != "$new" ] || [ -z "$running" ]; then
  docker-compose up -d --remove-orphans
  version=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$IMAGE")
  echo "$(date -Is) avviata $IMAGE versione $version"
  # immagini vecchie di clavis-trainer rimaste senza tag
  docker image prune -f --filter "label=org.opencontainers.image.title=clavis-trainer" >/dev/null
fi
