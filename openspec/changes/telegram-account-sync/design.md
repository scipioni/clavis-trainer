# Design

## Contesto

L'app è un sito statico (nginx) con tutti i dati in IndexedDB; gira su cubo
dietro Traefik (vedi README, sezione Produzione). Motivazioni in
`proposal.md`, comportamento in `specs/`. Vincoli:

- cubo sta in LAN dietro NAT: niente porte nuove, solo Traefik su 443.
- Il bot non esiste ancora: l'utente lo crea con BotFather (unico passo
  manuale) e mette il token in `~/clavis-trainer/.env`. Tutto il resto deve
  partire da solo, e l'app deve funzionare anche senza token.
- I dati sono di pochi utenti; non serve un database esterno.

## Obiettivi / Non obiettivi

**Obiettivi:**
- Un solo container (sito + API + bot), un solo volume, nessuna dipendenza
  npm nuova sul server.
- Il nucleo resta puro e condiviso: la validazione delle sessioni è la stessa
  sul client e sul server.
- La sincronizzazione è idempotente e tollera interruzioni a metà.

**Non obiettivi:**
- Telegram Login Widget (richiede `/setdomain` a mano su BotFather).
- Webhook del bot: con il long polling non serve esporre un endpoint.
- Risoluzione di conflitti fine: le sessioni sono immutabili; per le
  impostazioni vince l'ultima modifica.

## Decisioni

### 1. Accesso: deep link + codice + conferma nel bot

`POST /api/auth/start` crea una richiesta `{id: 128 bit casuali, code: 6
caratteri senza ambigui, scade tra 10 min}` e restituisce il link
`t.me/<bot>?start=<id>` e il codice. Il bot, ricevuto `/start <id>`, risponde
con il codice e i pulsanti "Conferma" e "Annulla" (callback). Alla conferma la
richiesta passa ad `approved` con l'utente Telegram. Il sito interroga
`POST /api/auth/poll` ogni 2 secondi; alla prima risposta `approved` il server
crea la sessione, imposta il cookie e consuma la richiesta.

Perché il codice e la conferma: senza, chi manda a una vittima il link di una
propria richiesta otterrebbe nel proprio browser l'account della vittima.
Mostrare lo stesso codice e chiedere una conferma esplicita, con
l'avvertimento, rende l'attacco evidente; è lo schema del device flow OAuth.

Alternativa: Login Widget. È più immediato, ma richiede la configurazione
manuale del dominio e uno script da `telegram.org`.

### 2. Sessione: cookie HttpOnly + impronta SHA-256 nel DB

Token di 256 bit casuali nel cookie `clavis_session` (HttpOnly, Secure,
SameSite=Lax, Path=/api, 180 giorni, rinnovato se usato dopo più di un giorno).
Nel DB c'è solo `sha256(token)`. Le richieste che modificano dati richiedono
l'intestazione `X-Clavis: 1` e, se presente, un `Origin` uguale al sito: una
pagina esterna non può aggiungere l'intestazione senza un preflight CORS, che
il server non autorizza.

### 3. Backend: Bun con `bun:sqlite`, nello stesso container

`server/` in TypeScript: `Bun.serve` per API e file statici, `bun:sqlite` per
il database (`/data/clavis.db`, WAL), un ciclo di long polling `getUpdates`
per il bot. Importa da `src/core` la validazione e i tipi. Viene compilato in
un unico file con `bun build --target bun`.

L'immagine passa da `nginx:alpine-slim` a `oven/bun:alpine` (circa 40 MB
compressi invece di 6), ma resta valido lo schema a layer riproducibili: base,
corpus, sito e server sono layer separati, e a ogni rilascio cambiano solo
quelli dell'app.

Alternative scartate:
- nginx più un container API separato: due immagini da pubblicare e due
  servizi da instradare in Traefik, per un'app così piccola.
- Postgres: un servizio in più per pochi utenti.

Gli header di cache restano quelli di nginx: `index.html` no-store, asset e
corpus immutabili, niente ETag basati su mtime.

### 4. Bot API dietro un'interfaccia

`TelegramApi` (getMe, getUpdates, sendMessage, editMessageText,
answerCallbackQuery, setMy*) con un'implementazione HTTP e una finta per i
test. Il ciclo di polling salva l'offset nel DB; se manca il token, o
`getMe` fallisce, il bot resta spento e `/api/config` risponde
`{ telegram: false }`.

All'avvio il server imposta `setMyName` ("clavis-trainer"),
`setMyDescription`, `setMyShortDescription` e `setMyCommands` (`/start`). Se
Telegram risponde 429 su `setMyName` lo ignora: il nome si cambia poche volte
al giorno.

### 5. Sincronizzazione: un solo endpoint, cursore crescente

`POST /api/sync` con `{ upload: StoredSession[], cursor, settings? }`:
1. il server valida e inserisce le sessioni con
   `INSERT OR IGNORE (user_id, id)` (idempotente) e assegna a ciascuna un
   `seq` crescente;
2. applica le impostazioni se più recenti (`updatedAt`);
3. risponde con le sessioni con `seq > cursor` (a pagine di 200), il nuovo
   cursore, `hasMore` e le impostazioni correnti.

Il client tiene in IndexedDB (store `kv`): `account` (id Telegram a cui sono
legati i dati locali), `syncCursor`, l'elenco `pendingUpload` (id delle sessioni
completate e non ancora confermate dal server) e `settingsUpdatedAt`. Se arrivano
sessioni nuove, le statistiche si ricalcolano con `recompute` sull'intero
storico ordinato per data: è l'unico modo di avere sullo stesso storico le
stesse EMA su ogni dispositivo.

L'invio avviene a lotti di 50 sessioni (limite di 8 MB per richiesta e 500
kB per sessione). Momenti di sincronizzazione: accesso, avvio, `visibilitychange`
verso visibile, fine sessione, e ogni 5 minuti se la pagina è visibile.

Fusione al primo accesso: se `account` è vuoto, tutte le sessioni locali
finiscono in `pendingUpload` e l'account diventa quello attuale; se `account`
è un altro id, i dati locali vengono cancellati prima di scaricare.

Azzeramento e importazione con accesso: `DELETE /api/data` (sessioni e
impostazioni dell'utente, cursore azzerato), poi l'operazione locale, poi una
sincronizzazione che carica il nuovo contenuto.

### 6. Validazione condivisa

`parseExport`/`validSession` passano da `src/storage/db.ts` a
`src/core/data.ts` (puro, niente IndexedDB), insieme ai tipi `StoredSession`, `Settings` ed `ExportData`. Il server la usa per ogni
sessione ricevuta, più un controllo sulla dimensione serializzata.

### 7. Limiti e abusi

- Richieste di accesso: 10 al minuto per IP (da `X-Forwarded-For`, impostato
  da Traefik), in memoria.
- Le richieste di accesso scadute e le sessioni non usate da 180 giorni si
  ripuliscono ogni ora.
- Corpo massimo 8 MB.

### 8. Deploy

- compose: volume `./data:/data`, `TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}`
  interpolato da `.env`, `PUBLIC_URL=https://clavis.mywire.org`.
- `update.sh` confronta anche l'impronta di `docker-compose config`: se cambia
  `.env` (per esempio aggiungendo il token) ricrea il container al giro
  successivo del cron. Così basta scrivere il token, senza altri comandi.
- `task deploy:rollback` modifica solo la riga `CLAVIS_TAG` di `.env`, invece
  di riscrivere il file e perdere il token.

## Rischi / Compromessi

- [Phishing con il link di accesso] → codice uguale su sito e bot, conferma
  esplicita con avvertimento, scadenza 10 minuti, uso singolo.
- [Il DB su cubo è un singolo file] → WAL; la cartella `data/` va aggiunta ai
  backup di cubo (indicato nel README, non automatizzato qui).
- [Immagine più grande dopo il passaggio a Bun] → il base layer si scarica una
  volta sola; i rilasci successivi restano di poche centinaia di kB.
- [Due long polling sullo stesso bot (per esempio un vecchio container ancora
  vivo)] → Telegram restituisce 409; il server lo registra e riprova con
  attesa crescente, senza andare in crash.
- [Ricalcolo completo delle statistiche dopo ogni download] → con mille
  sessioni da 300 caratteri sono circa 300.000 campioni: meno di un secondo.

## Piano di migrazione

Nessun dato da migrare: gli utenti esistenti restano anonimi finché non
fanno l'accesso, e al primo accesso il loro storico confluisce nell'account.
Lo store IndexedDB `kv` si usa per le nuove chiavi; lo schema resta alla
versione 1. Rollback: `task deploy:rollback -- sha-<precedente>` (il DB del
server resta, inutilizzato).
