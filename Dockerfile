# syntax=docker/dockerfile:1.7
#
# Immagine di produzione: un solo processo Bun che serve sito, API e bot.
# Layer pensati per rilasci piccoli: base, corpus, sito e server sono alberi
# completi da / con mtime azzerati, quindi a contenuto uguale corrisponde lo
# stesso digest e a ogni rilascio cambiano solo i layer modificati.

# --- build: test, sito statico, bundle del server
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG WEB=app/public
RUN bun run test && bun test server && bun run build \
 && bun build server/main.ts --target bun --outfile /tmp/server.js \
 && mkdir -p /out/corpus/$WEB /out/web/$WEB /out/server/app \
 && mv dist/corpus /out/corpus/$WEB/ \
 && cp -r dist/. /out/web/$WEB/ \
 # Bun non comprime al volo: versioni .gz accanto ai file (gzip -n: senza nome né data)
 && find /out/corpus /out/web -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.html' -o -name '*.svg' \) \
      -exec gzip -9 -n -k {} \; \
 && cp /tmp/server.js /out/server/app/server.js \
 && find /out -exec touch -h -d @0 {} +

# --- runtime
FROM oven/bun:1.4.4-alpine
LABEL org.opencontainers.image.title="clavis-trainer" \
      org.opencontainers.image.description="Trainer di digitazione per la tastiera clavis" \
      org.opencontainers.image.source="https://github.com/scipioni/clavis-trainer"
# il corpus cambia di rado: layer a parte, prima del sito e del server
COPY --link --from=build /out/corpus/ /
COPY --link --from=build /out/web/ /
COPY --link --from=build /out/server/ /
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    PUBLIC_URL=https://clavis.mywire.org
ARG VERSION=dev
LABEL org.opencontainers.image.version=$VERSION
# utente bun = uid 1000: la cartella dei dati montata dall'host deve appartenergli
USER bun
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/api/config || exit 1
CMD ["bun", "/app/server.js"]
