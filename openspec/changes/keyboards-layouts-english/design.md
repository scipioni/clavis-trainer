# Design

## Contesto

Motivazioni in `proposal.md`, comportamento in `specs/`. Lo stato attuale del
codice che questa change tocca:

- `src/core/keyboard/parseKeymap.ts` traduce i keycode ZMK direttamente in
  caratteri US (tabella `KEYCODES`), e `clavis.keymap.json` contiene già i
  caratteri: il sistema operativo è implicito.
- `geometry.ts` conosce solo le 40 posizioni Miryoku; `Resolver` presume
  layer BASE/NUM/SYM e Shift come home row mod.
- `Keyboard.svelte` disegna solo clavis; `Stats.svelte` e `heatmap()` usano
  `clavisKeymap`.
- Una sola tabella di statistiche in IndexedDB (`kv:stats`); `StoredSession`
  ha solo `deadKeys` come informazione sul layout.
- Corpus solo italiano (`public/corpus/*.json`), testi dell'interfaccia
  scritti direttamente nei componenti (circa 90 frasi), bot solo in italiano.

## Obiettivi / Non obiettivi

**Obiettivi:**
- Un solo motore di risoluzione: tastiera fisica (posizioni, dita, keycode
  emessi, layer) e mappa del sistema operativo (keycode → caratteri) sono dati
  separati e componibili.
- I dati esistenti restano validi senza intervento dell'utente.
- Nessuna dipendenza nuova (né libreria i18n né librerie per le tastiere).

**Non obiettivi:**
- macOS, layout diversi dai tre scelti, keymap clavis personalizzate oltre a
  quella del firmware.
- Configurare un layout qualsiasi da interfaccia: i profili sono una lista
  chiusa di 3 × 3 combinazioni.

## Decisioni

### 1. Keycode come in `KeyboardEvent.code`

Ogni tasto fisico emette un keycode con i nomi di `KeyboardEvent.code`
(`KeyQ`, `Digit1`, `BracketLeft`, `Quote`, `IntlBackslash`, `Space`…), cioè
la posizione sulla tastiera US indipendente dal layout. Una mappa del sistema
operativo dà per ogni keycode i quattro livelli `[normale, Shift, AltGr,
AltGr+Shift]` e gli eventuali tasti morti.

Per clavis `parseKeymap` registra il keycode invece del carattere, e
distingue gli shift impliciti di ZMK: `LPAR` diventa `Digit9` con Shift,
`AMPS` diventa `Digit7` con Shift. Così con il sistema in italiano lo stesso
tasto del layer SYM produce `)` (Shift+9 italiano) e il modello resta fedele
a ciò che accade davvero. `clavis.keymap.json` va rigenerato.

Alternativa scartata: una tabella di caratteri per ogni combinazione di
tastiera e layout. È più semplice da leggere, ma andrebbe riscritta a mano a
ogni cambio del firmware e non spiega perché un simbolo cambia.

### 2. Profili: tastiera × layout → sorgente della keymap + mappa del sistema

| Tastiera | Layout | Tasti (keycode emessi) | Mappa del sistema |
|---|---|---|---|
| clavis | Colemak-DH | firmware (base Colemak-DH) | US / US Intl |
| clavis | US QWERTY | firmware con base QWERTY di Miryoku | US / US Intl |
| clavis | Italiano QWERTY | firmware con base QWERTY di Miryoku | italiana |
| classica ANSI/ISO | Colemak-DH | posizioni standard | Colemak-DH (angle mod) |
| classica ANSI/ISO | US QWERTY | posizioni standard | US / US Intl |
| classica ANSI/ISO | Italiano QWERTY | posizioni standard | italiana |

Su clavis Colemak-DH e QWERTY stanno nel firmware (base di Miryoku), quindi
il sistema resta US. Sulla tastiera classica Colemak-DH è un layout del
sistema: i keycode delle lettere vengono rimappati, mentre la punteggiatura
resta come nel layout US. La base QWERTY di Miryoku si costruisce sostituendo
le lettere della base Colemak-DH secondo la tabella delle alternative di
Miryoku (`MIRYOKU_ALTERNATIVES_BASE_QWERTY`), con gli home row mod nelle
stesse posizioni (GUI/Alt/Ctrl/Shift su `a s d f` e `j k l '`).

L'opzione tasti morti continua a valere per le mappe basate sul layout US
(US, Colemak-DH). Identificativo del profilo: `<tastiera>:<layout>`, con
tastiera `clavis`, `ansi` o `iso` e layout `colemakdh`, `us` o `it`
(per esempio `clavis:colemakdh` o `iso:it`).

### 3. Tastiera classica: geometria e diteggiatura

Le righe sono i numeri, `Tab QWERTY…`, `Caps ASDF…` e `Shift ZXCV…`, più
spazio e AltGr. ISO aggiunge `IntlBackslash` tra Shift sinistro e `KeyZ` e
la `Backslash` accanto all'Invio a L. Le larghezze sono quelle standard in
unità (Tab 1,5; Caps 1,75; Shift sinistro 2,25 in ANSI e 1,25 in ISO). Dita
per colonna secondo il metodo standard: `1 Q A Z` al mignolo sinistro,
`4 5 R T F G V B` all'indice sinistro, `6 7 Y U H J N M` all'indice destro,
lo spazio al pollice destro, così come AltGr.

Shift: si tiene quello della mano opposta al tasto battuto. AltGr si tiene
col pollice destro; se il tasto battuto è anche lui della mano destra si
accetta comunque, perché sulle tastiere classiche AltGr esiste solo a destra.

Colemak-DH con angle mod: le lettere della riga inferiore sinistra si
spostano di un tasto e cambia la diteggiatura (in ANSI l'indice copre i tasti
fisici `C` e `V`, in ISO il mignolo usa `IntlBackslash`). La tabella delle
dita per l'angle mod fa parte della mappa del layout, non della geometria.

### 4. Resolver parametrico

`Resolver` riceve una `Board` (posizioni con keycode emessi, dito, layer, modi
di tenere Shift e AltGr) e una `OsMap`. L'indice carattere → accordo si
costruisce applicando la `OsMap` ai keycode di ogni posizione e di ogni
livello (normale, Shift, AltGr, AltGr+Shift), con le stesse regole di oggi
(meno pressioni; a parità senza layer, poi l'ordine delle posizioni). I tasti
morti e le composizioni restano in `deadKeys.ts`, attivi solo per le mappe
basate sul layout US.

`layerOf()` vale solo per clavis; sulla tastiera classica non esistono layer,
quindi l'analisi non genera unità `layer`.

### 5. Dati: campi nuovi con valori predefiniti

- `StoredSession`: `keyboard?`, `layout?`, `lang?`. Assenti vuol dire
  `clavis`, `colemakdh`, `it`. `validSession` accetta l'assenza e rifiuta
  valori sconosciuti; il server la riusa, quindi nessuna migrazione sul
  server (le sessioni sono già JSON).
- `Settings`: `keyboard`, `layout`, `uiLang`, `exerciseLang`. Valori
  predefiniti: profilo `clavis:colemakdh`; lingue dalla lingua del browser.
  `normalizeSettings` completa i campi mancanti, quindi le impostazioni
  sincronizzate da un vecchio client restano valide.
- `EXPORT_VERSION` resta 1: i file vecchi si importano così come sono, e
  quelli nuovi hanno solo campi in più.

### 6. Statistiche per profilo: IndexedDB versione 2

Lo store `kv` passa da `stats` a `stats:<profilo>`. La migrazione
(`upgrade` da 1 a 2) sposta `stats` in `stats:clavis:colemakdh`; per
sicurezza, al primo avvio dopo l'aggiornamento le statistiche di ogni profilo
presente nello storico si ricalcolano dalle sessioni. `completeSession`,
`recomputeStats` e l'importazione lavorano per profilo; il ricalcolo dopo una
sincronizzazione ricostruisce i profili toccati dalle sessioni scaricate.
Andamento, mappa di calore e classifiche filtrano le sessioni per profilo
attivo.

### 7. Corpus per lingua

`scripts/build-corpus.ts` riceve la lingua:
- `it` come oggi;
- `en` da FrequencyWords `en_50k` (CC BY-SA 4.0) e Tatoeba `eng`
  (CC BY 2.0 FR). Si accettano parole `^[a-z]+('[a-z]+)?$`, così le
  contrazioni (`don't`, `it's`) esercitano l'apostrofo; `i` e le sue forme
  (`i'm`, `i've`) si scrivono maiuscole. Dalle frasi si escludono `Tom` e
  `Mary`, come per l'italiano.

I file vanno in `public/corpus/<lingua>/`, ciascuno con il proprio hash di
versione. Si carica solo il corpus della lingua degli esercizi, e l'altro
solo al cambio. Il generatore è uno per coppia (lingua, profilo); le elisioni
(`l'`, `dell'`…) diventano una regola della lingua italiana, mentre in
inglese l'apostrofo arriva dalle contrazioni.

### 8. i18n senza librerie

Cataloghi `src/i18n/it.ts` (riferimento) ed `en.ts`, con le stesse chiavi
imposte dal tipo (`satisfies Messages`). `t(chiave, parametri)` legge una
lingua `$state`, quindi il cambio aggiorna l'interfaccia senza ricaricare.
Plurali con funzioni nel catalogo; date, numeri e percentuali con `Intl` e la
lingua attiva. Lingua iniziale: `it` se `navigator.languages[0]` comincia per
`it`, altrimenti `en`. Un test confronta le chiavi dei due cataloghi; uno
script elenca i testi rimasti fuori dal catalogo nei `.svelte`.

Alternativa scartata: `svelte-i18n`. Aggiunge una dipendenza e un caricamento
asincrono dei messaggi per due lingue e circa 100 frasi.

### 9. Bot bilingue

`from.language_code` di Telegram sceglie la lingua dei messaggi (`it*` →
italiano, altrimenti inglese). La presentazione usa il parametro
`language_code` della Bot API: descrizioni e comandi in inglese come
predefinito e in italiano per `it`. Il confronto "imposta solo se diverso"
vale per ciascuna lingua.

### 10. Interfaccia

- Selettore di profilo (tastiera e layout) nelle impostazioni e in forma
  compatta nella barra dell'allenamento; mostra l'elenco dei caratteri non
  raggiungibili per la lingua degli esercizi.
- `Keyboard.svelte` disegna una `Board`: per clavis la disposizione di oggi,
  per le tastiere classiche rettangoli con le larghezze standard (l'Invio ISO
  come poligono a L). Etichette dalla `OsMap` (livello normale; sui tasti
  tenuti il nome del modificatore).
- La mappa di calore nasconde il selettore di layer sulle tastiere classiche;
  le classifiche nascondono il tipo "transizioni di layer".

## Rischi / Compromessi

- [La mappa italiana differisce tra Linux e Windows: su Windows mancano
  `` ` `` e `~`] → si segue XKB `it` di Linux (la piattaforma dell'utente);
  su Windows quei due caratteri risultano digitabili anche se non lo sono. Si
  annota nella pagina informazioni; un'eventuale variante Windows è un lavoro
  separato.
- [Su clavis + Italiano QWERTY alcune accentate (`ò`, `ù`, `ì`) potrebbero
  non essere raggiungibili con i layer di Miryoku] → il requisito "Caratteri
  non raggiungibili" li mostra all'utente e il generatore li esclude; il
  modello non inventa tasti.
- [La migrazione di IndexedDB fallisce a metà] → l'upgrade è transazionale; in
  ogni caso le statistiche si ricalcolano dallo storico al primo avvio.
- [Le statistiche di un profilo restano vuote dopo il cambio] → è voluto (un
  bigramma su QWERTY non è lo stesso movimento che su Colemak-DH); la UI lo
  spiega e la modalità adattiva parte dal campionamento per frequenza.
- [Il corpus inglese da sottotitoli contiene nomi e gergo] → stessi filtri
  dell'italiano, con una lista di esclusione `scripts/corpus-exclude-en.txt`.
- [Circa 100 frasi da tradurre: rischio di testi rimasti in italiano] → test
  sulle chiavi e script di controllo sui `.svelte`; e2e con l'interfaccia in
  inglese.

## Piano di migrazione

1. Rilascio del client con IndexedDB v2: chi apre la nuova versione mantiene
   sessioni e statistiche nel profilo `clavis:colemakdh`.
2. Server: nessuna migrazione. Accetta subito i campi nuovi perché la
   validazione è condivisa, e un client vecchio continua a funzionare
   (sessioni senza profilo = `clavis:colemakdh`).
3. Rollback: `task deploy:rollback -- sha-<precedente>`. Un client vecchio su
   IndexedDB v2 non si apre (versione più bassa), quindi il rollback del
   client richiede di cancellare i dati del sito, che poi si recuperano
   dall'account o da un'esportazione. Va scritto nel README.

## Domande chiuse durante l'implementazione

- Colemak-DH sulla tastiera classica, dalle varianti XKB `us(colemak_dh)` e
  `us(colemak_dh_iso)`: in ANSI la riga inferiore sinistra è `x c d v z` sui
  tasti fisici `Z X C V B`; in ISO `z` va su `IntlBackslash` e `B` dà `\ |`.
  Dita con l'angle mod: `IntlBackslash` mignolo, `Z` anulare, `X` medio, `C`
  `V` `B` indice.
- Mappa italiana: dal file XKB `it` (basic, più `latin(type4)`), si tengono
  ASCII, accentate, `€` (AltGr+e), `£ ° § ç « »` e i simboli AltGr dei tasti
  italiani. Gli AltGr "latin" sulle lettere (per esempio AltGr+q = `@`) sono
  esclusi, così `@` è AltGr+`ò` come su Windows.
