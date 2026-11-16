# Task

## 1. Validazione condivisa

- [x] 1.1 Spostare `parseExport`, `validSession` e gli errori di importazione in `src/core/data.ts` insieme ai tipi dei dati (senza IndexedDB), con limite di dimensione per sessione, e aggiornare gli import del client; verifica: `bun run test` e `bun run check` passano e un test rifiuta una sessione oltre il limite

## 2. Backend

- [x] 2.1 Creare `server/` con database SQLite (utenti, richieste di accesso, sessioni del browser, sessioni di allenamento con `seq`, impostazioni, kv) e funzioni di accesso ai dati; verifica: `bun test server` con test su inserimento idempotente, cursore e pulizia delle scadenze
- [x] 2.2 Implementare l'interfaccia `TelegramApi` (HTTP e finta), il ciclo di long polling con offset persistito, la gestione di `/start`, di `/start <id>` e dei pulsanti Conferma/Annulla, e la presentazione del bot all'avvio; verifica: `bun test server` con il bot finto copre conferma, rifiuto, link usato o scaduto e start senza codice
- [x] 2.3 Implementare l'API: `/api/config`, `/api/auth/start`, `/api/auth/poll`, `/api/auth/logout`, `/api/me`, `/api/sync`, `DELETE /api/data`, con cookie di sessione, controllo `X-Clavis`/`Origin`, limite di frequenza e di dimensione; verifica: `bun test server` con richieste HTTP reali verso il server in memoria per ogni scenario di `account-auth` e `history-sync`
- [x] 2.4 Servire i file statici con gli stessi header di cache di nginx e il fallback a `index.html`; verifica: test HTTP su `/`, `/assets/x.js`, `/corpus/words.json` e un percorso inesistente

## 3. Client: account e sincronizzazione

- [x] 3.1 Modulo `src/sync/` con client API (`X-Clavis`, gestione 401 e assenza del server) e logica di sincronizzazione (account legato, cursore, pendenti, lotti, fusione, ricalcolo, impostazioni con ultima modifica); verifica: unit test con un server finto per secondo dispositivo, invio ripetuto, offline poi online, browser di un altro account
- [x] 3.2 Interfaccia: pulsante "Accedi con Telegram" solo se `/api/config` lo permette, dialogo con codice, link e attesa (scadenza, rifiuto), stato nell'intestazione (nome, ultima sincronizzazione, sessioni da inviare), uscita con conferme; trigger di sincronizzazione (avvio, accesso, fine sessione, ritorno in primo piano, ogni 5 minuti); verifica: `bun run check` e smoke test e2e del flusso con il bot finto
- [x] 3.3 Azzeramento e importazione con accesso estesi all'account, con testi di conferma aggiornati; verifica: test di sincronizzazione dopo azzeramento e dopo importazione (3 sessioni invece di 10)

## 4. Immagine e deploy

- [x] 4.1 Dockerfile con runtime Bun, layer riproducibili (corpus, sito, server separati), healthcheck; `vite` con proxy `/api` in sviluppo; script `bun run server`; verifica: due build da zero hanno layer identici e il container risponde su `/` e `/api/config`
- [x] 4.2 Smoke test e2e esteso: server avviato con il bot finto (variabile `TELEGRAM_FAKE=1`), accesso, due contesti browser che si sincronizzano, uscita; verifica: `bun tests/e2e/smoke.ts` passa contro il container locale
- [ ] 4.3 Deploy: compose con volume `data/` e token da `.env`, `update.sh` che ricrea il container anche quando cambia la configurazione, rollback che non sovrascrive `.env`, README aggiornato (bot, token, backup del DB); verifica: su cubo il sito funziona senza token, con `/api/config` a `telegram: false`, e lo smoke test passa contro la produzione
- [ ] 4.4 Pubblicare: commit, push, immagine su Docker Hub, aggiornamento su cubo; verifica: `https://clavis.mywire.org/api/config` risponde e `update.log` riporta la nuova versione
