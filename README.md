# clavis-trainer

A typing trainer for the [clavis](https://github.com/scipioni/clavis) split
keyboard (36 keys, Miryoku Colemak-DH with home row mods), used with the
system layout set to US International with dead keys. Adaptive drills that
target your weak spots, real Italian text, and statistics over time. Everything
runs in the browser with no server: your data stays in IndexedDB.

![Training session: the on-screen keyboard switches to the NUM layer to show how to type the apostrophe](docs/screenshot.png)

## Features

- **Three modes**: adaptive (words and drills built from your weakest
  characters, bigrams, layer transitions and dead keys), sentences, and free
  text.
- **Keyboard guide**: shows which key to tap, which key to hold (Shift on the
  opposite home row mod, layer keys) and the dead key sequence for accented
  letters.
- **Clean timings**: the cursor stops on an error (no Backspace), so per-character
  times are not polluted by corrections. Accidental modifiers from home row
  mod rolls are counted separately.
- **Statistics**: WPM and accuracy trends, a per-layer heat map, and rankings of
  weak units with a "train this" button.
- **Local data**: export, import and reset from the settings page.

The interface is in Italian.

## Commands

```sh
bun install          # dependencies
bun run dev          # development server on http://localhost:5173
bun run build        # static build in dist/
bun run preview      # serve dist/
bun run test         # unit tests (Vitest)
bun run check        # type checking (svelte-check)
```

## clavis keymap

The keyboard model is generated from the ZMK keymap in
[scipioni/clavis](https://github.com/scipioni/clavis)
(`firmware/zmk-timeless/config/custom_config.h`, macros
`MIRYOKU_LAYER_BASE/NUM/SYM`). The local checkout of that repository is
`/lab/clavis`, next to this one, so a firmware change can be tried here before
it is pushed. After a firmware change:

```sh
bun run gen:keymap                          # download from GitHub (main branch)
bun run gen:keymap /lab/clavis/firmware/zmk-timeless/config/custom_config.h   # from the local checkout
```

The script rewrites `src/core/keyboard/clavis.keymap.json`. Also update the test
fixture (`tests/fixtures/custom_config.h`) with the same file, then run
`bun run test`. Fingers are assigned by column (pinky, ring, middle, index for
the two inner columns, thumb) in `src/core/keyboard/geometry.ts`; the US
International dead key compositions are in `src/core/keyboard/deadKeys.ts`.

## Corpus

Words (FrequencyWords, CC BY-SA 4.0) and sentences (Tatoeba, CC BY 2.0 FR) are
already in `public/corpus/`. To regenerate them, run `bun run build:corpus`. It
downloads the sources into `.corpus-raw/` and needs `bunzip2`. Words to exclude
are listed in `scripts/corpus-exclude.txt`. Sources and licenses:
[ATTRIBUTION.md](ATTRIBUTION.md).

## UI tests

`tests/e2e/smoke.ts` drives the app in Chromium (through `playwright-core`) and
simulates dead keys with composition events. It covers free text with accents
and apostrophes, accidental modifiers, abandoning a session, a 30 s session
checked against the core's own computation, settings after a reload, importing
`tests/fixtures/example-export.json`, rankings and targeted training.

```sh
bun run build && bun run preview --port 4173 &
bun tests/e2e/smoke.ts            # CHROMIUM=/path/to/chromium for another browser
```

It does not replace testing with a real clavis: dead key composition and home
row mods depend on the operating system and the firmware.

## Produzione

L'app gira su `cubo` all'indirizzo <https://clavis.mywire.org>, dietro il
Traefik dello stack passbolt (rete `passbolt_default`, certificato Let's
Encrypt). L'immagine è pubblica su Docker Hub: `scipioit/clavis-trainer`.

**Come arriva un rilascio**

1. Push su `main` che tocca l'applicativo (`src/`, `public/`, dipendenze,
   `Dockerfile`, `docker/`): il workflow `.github/workflows/release.yml`
   costruisce l'immagine (i test unitari girano dentro la build) e la pubblica
   come `sha-<commit>` e `latest`. Modifiche solo a documentazione, specifiche
   o test non producono rilasci.
2. Su cubo, `~/clavis-trainer/update.sh` gira in crontab ogni 5 minuti: se
   `latest` è cambiata ricrea il container e scrive una riga in
   `~/clavis-trainer/update.log`.

I rilasci sono piccoli. Base nginx (circa 13 MB) e corpus sono layer
riproducibili, perché il Dockerfile azzera gli mtime: tra due versioni cambia
solo il layer dell'app, circa 100 kB. Per lo stesso motivo nginx non usa ETag
né Last-Modified: `index.html` non va in cache, gli asset con hash e il corpus
(`?v=<hash del contenuto>`) sono immutabili.

Il workflow ha bisogno dei secret `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`
(access token di Docker Hub con permesso Read & Write):

```sh
gh secret set DOCKERHUB_USERNAME --body scipioit
gh secret set DOCKERHUB_TOKEN    # incolla il token quando richiesto
```

Senza i secret il workflow salta il rilascio con un avviso.

**Comandi** ([Task](https://taskfile.dev))

```sh
task docker:run        # immagine locale su http://localhost:8088
task e2e               # smoke test contro l'immagine locale
task docker:publish    # rilascio manuale da qui (albero pulito)
task deploy:install    # prima installazione su cubo: compose, script, cron
task deploy:now        # aggiorna subito senza aspettare il cron
task deploy:rollback -- sha-abc1234   # fissa una versione (scrive CLAVIS_TAG in .env)
```
