# Task

## 1. Impostazioni: guide già viste

- [x] 1.1 Aggiungere `guideSeen: GuideKind[]` a `Settings` e `DEFAULT_SETTINGS` (`[]`) in `src/core/data.ts`; in `normalizeSettings` tenere il campo se è un array di `'clavis' | 'classic'` senza duplicati, altrimenti riportarlo a `[]` senza rifiutare le impostazioni; verifica: unit test con impostazioni vecchie senza campo (→ `[]`), valore valido conservato, valore sbagliato (`['dvorak']`, stringa) riportato a `[]`, file di esportazione con e senza campo importati
- [x] 1.2 Server: test che `/api/sync` conservi `guideSeen` tra due dispositivi; verifica: `bun test server` copre lo scenario "Guida già vista su un altro dispositivo" (dispositivo A invia `['clavis']`, dispositivo B lo riceve)

## 2. Logica della guida

- [x] 2.1 Creare `src/core/guide.ts` con `guideKind`, `guideBoard` e `shouldAutoOpen` (design, decisione 2); verifica: unit test su tutti i 9 profili per `guideKind`/`guideBoard` (clavis → ISO con `it`, ANSI con gli altri) e una tabella di casi per `shouldAutoOpen` (non pronta, sessioni interrotte, sessione in corso, già vista, da aprire)
- [x] 2.2 Funzioni che ricavano dal board la posizione base, i pollici, i tasti con le tacche e le zone per dito; verifica: unit test con le lettere attese per `ansi:colemakdh` (A R S T / N E I O), `ansi:us` (A S D F / J K L ;), `iso:it` (A S D F / J K L ò) e `clavis:colemakdh`, 6 pollici su clavis, angle mod (primo tasto lettera in basso a sinistra all'anulare con Colemak-DH, al mignolo con US)
- [x] 2.3 Definire i passi delle due guide come dati (7 per clavis, 6 per la classica) con le chiavi dei testi; verifica: unit test sull'ordine dei passi come da specifica e sulle chiavi presenti nel catalogo `it`

## 3. Disegno della tastiera e polpastrelli

- [x] 3.1 Estrarre da `Keyboard.svelte` le misure dei tasti e il percorso dell'Invio ISO, e aggiungere le prop `fill` e lo snippet di sovrapposizione; verifica: `bun run check` pulito, e2e `smoke.ts` e `profiles.ts` invariati (stessa tastiera dell'allenamento e mappa di calore nelle statistiche)
- [x] 3.2 Colori delle dita come variabili CSS nei due temi e componente `GuideKeyboard.svelte` con polpastrelli (cerchio, colore, sigla), zone colorate e tasti in evidenza; verifica: screenshot e2e del passo "zone" per `ansi:colemakdh`, `iso:it` e `clavis:colemakdh`, in tema chiaro e scuro, controllati a vista
- [x] 3.3 Animazioni: entrata dei polpastrelli, pulsazione del dito attivo, transizioni tra passi, demo `shift` e `layers`; con `prefers-reduced-motion` nessuna transizione e demo statiche; verifica: e2e con `emulateMedia({ reducedMotion: 'reduce' })` che non trova animazioni in corso (`document.getAnimations()` vuoto) dopo il cambio di passo

## 4. Dialogo, apertura e navigazione

- [x] 4.1 `Guide.svelte`: dialogo modale con titolo, testo, indicatore del passo, Indietro/Avanti/Chiudi, selettore clavis/classica al primo passo, frecce, Invio ed Esc, trappola del focus, focus restituito alla chiusura, `focusOnShow` all'apertura automatica; verifica: e2e "Navigazione da tastiera", "Ultimo passo" e "Tasti non passati all'allenamento" (nessuna sessione parte con la guida aperta)
- [x] 4.2 Stato in `app.svelte.ts` (`guideOpen`, `sessionActive` impostato dal Trainer) e `$effect` di apertura automatica in `App.svelte`; alla chiusura aggiungere a `guideSeen` le versioni mostrate e salvare con `saveSettings`; verifica: e2e "Primo avvio", "Chiusura anticipata" (nessuna riapertura dopo il ricaricamento), "Passaggio a un'altra tastiera", "Entrambe viste", "Sessione interrotta in sospeso"
- [x] 4.3 Voce "Guida" nella navigazione, disabilitata durante una sessione in corso; verifica: e2e "Riapertura" e controllo che la voce sia disabilitata a sessione avviata

## 5. Testi

- [x] 5.1 Scrivere i testi delle due guide, dei pulsanti e delle sigle delle dita in `it.ts` e `en.ts`; verifica: `bun run check` (stesse chiavi, nessun testo fuori catalogo) ed e2e "Guida in inglese"
- [x] 5.2 Aggiornare README (sezione sull'uso, con la voce Guida) e la pagina Informazioni se cita i primi passi; verifica: rilettura del README

## 6. Test e2e e integrazione

- [x] 6.1 Aggiungere `closeGuide(page)` a `tests/e2e/` e usarlo in `smoke.ts`, `profiles.ts` e `account.ts`; creare `tests/e2e/guide.ts` con gli scenari dei gruppi 3 e 4; verifica: tutti gli e2e passano contro l'immagine locale (`task server:e2e`) e contro `bun run preview`
- [x] 6.2 Verifica complessiva: `bun run test`, `bun test server`, `bun run check`, `openspec validate finger-placement-guide --strict`; verifica: tutti verdi

## Workflow follow-up

- Provare la guida a mano su schermo stretto e con una tastiera vera, poi rilasciare (versione in `package.json`, tag, `task docker:publish`).
- Archiviare la change dopo il rilascio.
