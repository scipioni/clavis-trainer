# syntax=docker/dockerfile:1.7
#
# Immagine di produzione: sito statico servito da nginx.
# Layer pensati per rilasci piccoli: base nginx e corpus restano identici tra
# un rilascio e l'altro (mtime azzerati), cambia solo il layer dell'app.

# --- build (indipendente dall'architettura: produce solo file statici)
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Ogni layer è un albero completo da / con mtime azzerati (cartelle comprese):
# stesso contenuto → stesso digest → niente da caricare né da scaricare.
ARG HTML=usr/share/nginx/html
RUN bun run test && bun run build \
 && mkdir -p /out/conf/etc/nginx/conf.d /out/corpus/$HTML /out/app/$HTML \
 && cp docker/nginx.conf /out/conf/etc/nginx/conf.d/default.conf \
 && mv dist/corpus /out/corpus/$HTML/ \
 && cp -r dist/. /out/app/$HTML/ \
 && find /out -exec touch -h -d @0 {} +

# --- runtime
FROM nginx:1.29-alpine-slim
LABEL org.opencontainers.image.title="clavis-trainer" \
      org.opencontainers.image.description="Trainer di digitazione per la tastiera clavis" \
      org.opencontainers.image.source="https://github.com/scipioni/clavis-trainer"
COPY --link --from=build /out/conf/ /
# il corpus cambia di rado: layer separato, prima dell'app
COPY --link --from=build /out/corpus/ /
COPY --link --from=build /out/app/ /
ARG VERSION=dev
LABEL org.opencontainers.image.version=$VERSION
EXPOSE 80
HEALTHCHECK --interval=60s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
