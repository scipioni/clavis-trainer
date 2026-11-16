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
