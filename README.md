# clavis-trainer

Trainer di digitazione per la tastiera split [clavis](https://github.com/scipioni/clavis)
(36 tasti, Miryoku Colemak-DH con home row mods), con il sistema in US
International a tasti morti. Esercizi adattivi sui punti deboli, testo italiano
reale, statistiche nel tempo. Gira tutto nel browser, senza server: i dati
restano in IndexedDB.

## Comandi

```sh
bun install          # dipendenze
bun run dev          # sviluppo su http://localhost:5173
bun run build        # build statica in dist/
bun run preview      # serve dist/
bun run test         # unit test (Vitest)
bun run check        # controllo dei tipi (svelte-check)
```

## Keymap di clavis

Il modello della tastiera viene dalla keymap ZMK di
[scipioni/clavis](https://github.com/scipioni/clavis)
(`firmware/zmk-timeless/config/custom_config.h`, macro
`MIRYOKU_LAYER_BASE/NUM/SYM`). Dopo una modifica del firmware:

```sh
bun run gen:keymap                          # scarica da GitHub (branch main)
bun run gen:keymap ../clavis/firmware/zmk-timeless/config/custom_config.h   # da una copia locale
```

Lo script riscrive `src/core/keyboard/clavis.keymap.json`. Aggiorna anche la
fixture dei test (`tests/fixtures/custom_config.h`) con lo stesso file, poi
`bun run test`. Le dita sono assegnate per colonna (mignolo, anulare, medio,
indice per le due colonne interne, pollice) in `src/core/keyboard/geometry.ts`;
le composizioni dei tasti morti US International sono in
`src/core/keyboard/deadKeys.ts`.

## Corpus

Parole (FrequencyWords, CC BY-SA 4.0) e frasi (Tatoeba, CC BY 2.0 FR) sono già
in `public/corpus/`. Per rigenerarle (scarica le fonti in `.corpus-raw/`, serve
`bunzip2`): `bun run build:corpus`. Le parole da escludere stanno in
`scripts/corpus-exclude.txt`. Fonti e licenze: [ATTRIBUTION.md](ATTRIBUTION.md).

## Test dell'interfaccia

`tests/e2e/smoke.ts` guida l'app in Chromium (via `playwright-core`) simulando
anche i tasti morti con eventi di composizione: testo libero con accenti e
apostrofo, mod involontario, abbandono, sessione da 30 s confrontata con il
ricalcolo del nucleo, impostazioni dopo il ricaricamento, importazione di
`tests/fixtures/example-export.json`, classifiche e allenamento mirato.

```sh
bun run build && bun run preview --port 4173 &
bun tests/e2e/smoke.ts            # CHROMIUM=/percorso/chromium per un altro browser
```

Non sostituisce la prova con clavis vera: la composizione dei tasti morti e gli
home row mods dipendono da sistema e firmware.
