# Proposta: guida al posizionamento delle dita

## Perché

clavis-trainer misura velocità, precisione e punti deboli, ma non spiega da
dove partono le dita. Chi è all'inizio, e soprattutto chi passa a clavis
(tastiera divisa, colonne dritte, pollici, home row mod, layer), si allena
con una posizione sbagliata e consolida le abitudini sbagliate. Il modello
della tastiera conosce già mano e dito di ogni tasto per tutti i profili,
quindi una guida visiva costa poco e vale per tutte le combinazioni di
tastiera e layout.

## Cosa cambia

- **Guida a passi** in un dialogo sopra l'app, in due versioni:
  - **clavis** (7 passi): benvenuto, le due metà, posizione base, colonne e
    dita, pollici, tenere premuto (home row mod e layer NUM/SYM), pronto;
  - **tastiera classica** ANSI/ISO (6 passi): benvenuto, tacche su F e J,
    posizione base, zone delle dita (con l'angle mod di Colemak-DH), pollici e
    Shift della mano opposta, pronto.
  Il layout del profilo cambia solo le lettere disegnate sui tasti.
- **Grafica a polpastrelli**: cerchi colorati con la sigla del dito che si
  posano sui tasti, con le zone dei tasti colorate per dito. Animazioni
  leggere tra un passo e l'altro, assenti se il sistema chiede di ridurre il
  movimento.
- **Solo spiegazione**: la guida non contiene esercizi e non registra sessioni.
- **Apertura automatica una volta per tipo di tastiera** (clavis o classica):
  al primo avvio, per gli utenti che usano già il sito, e la prima volta che
  si passa a un tipo di tastiera di cui non si è vista la guida.
- **Voce "Guida" nella navigazione** per riaprirla quando si vuole. Al primo
  passo si può passare dalla guida di clavis a quella della classica e
  viceversa.
- **"Guida già vista" nelle impostazioni**, salvata nel browser e
  sincronizzata con l'account come le altre impostazioni.

Fuori ambito: esercizi guidati dentro la guida; cambiare il profilo dalla
guida; mani disegnate (solo polpastrelli); guide per posture, sedia o
schermo; una guida diversa per ogni layout.

## Capacità

### Nuove capacità

- `finger-placement-guide`: la guida al posizionamento delle dita: contenuti
  delle due versioni, grafica per dito, navigazione, apertura automatica e
  riapertura dalla navigazione.

### Capacità modificate

- `history-sync`: le impostazioni sincronizzate con l'account comprendono le
  guide già viste.

## Impatto

- `src/core/data.ts`: nuovo campo nelle impostazioni, in `DEFAULT_SETTINGS` e
  in `normalizeSettings` (condiviso con il server, che oggi scarta i campi
  sconosciuti); vale anche per l'importazione dei file esportati.
- `src/ui/`: nuovo dialogo della guida e grafica a polpastrelli (sulla base di
  `Keyboard.svelte`), voce "Guida" in `App.svelte`, apertura automatica in
  `app.svelte.ts`.
- `src/i18n/it.ts` e `en.ts`: testi della guida nelle due lingue.
- Test e2e (`smoke.ts`, `profiles.ts`, `account.ts`): al primo avvio la guida
  si apre e va chiusa prima di allenarsi.
- Nessuna dipendenza nuova, nessuna modifica al database del server né a
  IndexedDB (le impostazioni sono un oggetto nel `kv`).
