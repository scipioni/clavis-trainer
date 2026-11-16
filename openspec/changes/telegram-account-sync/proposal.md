# Proposta: account Telegram e storico sincronizzato

## Perché

Oggi storico e statistiche vivono solo nell'IndexedDB del browser: chi si
allena su più computer ha tanti storici separati, e cancellare i dati del sito
(o la pulizia automatica di Safari) li fa sparire. L'utente vuole che lo
storico lo segua tra dispositivi, con l'identità che usa già ogni giorno:
Telegram.

## Cosa cambia

- Accesso facoltativo con Telegram: il sito mostra un codice e un link
  `t.me/<bot>?start=…`; nel bot l'utente vede lo stesso codice e conferma con
  un pulsante. Non serve configurare il dominio su BotFather.
- Un piccolo backend (stesso container del sito) con database SQLite: utenti
  Telegram, sessioni di accesso, sessioni di allenamento, impostazioni.
- Sincronizzazione dello storico: le sessioni completate salgono sul server e
  quelle degli altri dispositivi scendono; le statistiche si ricalcolano dallo
  storico unito. Le impostazioni seguono l'account (vince l'ultima modifica).
- Al primo accesso lo storico anonimo del browser confluisce nell'account.
- L'app resta usabile senza accesso e senza rete, esattamente come ora.
- Il bot si presenta da solo (nome, descrizione, comandi) all'avvio del
  backend; finché manca il token il login non compare.
- **BREAKING (comportamento)**: con l'accesso attivo i dati di allenamento
  vengono inviati al server di clavis-trainer; azzeramento e importazione
  agiscono anche sui dati dell'account.

Fuori ambito: altri metodi di accesso, condivisione tra utenti, classifiche
pubbliche, cancellazione dell'account dal bot, cifratura end-to-end.

## Capacità

### Nuove capacità

- `account-auth`: accesso con Telegram tramite bot (codice di conferma),
  sessione del browser, uscita, presentazione del bot.
- `history-sync`: sincronizzazione bidirezionale di sessioni e impostazioni
  tra browser e account, funzionamento offline, fusione dello storico anonimo.

### Capacità modificate

- `progress-history`: il salvataggio non è più solo locale quando l'utente ha
  fatto l'accesso; azzeramento e importazione valgono anche per l'account;
  all'uscita i dati locali vengono rimossi dal browser.

## Impatto

- Nuovo backend in `server/` (Bun, `bun:sqlite`, nessuna dipendenza esterna),
  che serve anche i file statici: l'immagine passa da nginx a Bun
  (base più grande, ma i rilasci restano piccoli: cambiano solo i layer
  dell'app).
- Nuovo volume persistente su cubo (`~/clavis-trainer/data`) con il database,
  da includere nei backup.
- Nuova dipendenza esterna: Bot API di Telegram (`api.telegram.org`), in long
  polling: nessuna porta in ingresso oltre a Traefik.
- Il token del bot sta in `~/clavis-trainer/.env` su cubo, fuori da git e
  dall'immagine.
