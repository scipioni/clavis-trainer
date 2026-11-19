# Spec Delta

## Purpose

Offre una pagina di consultazione, stampabile, di tutti i layer della
tastiera clavis, generata dal firmware e con i caratteri del sistema
operativo scelto.

## ADDED Requirements

### Requirement: Pagina con indirizzo proprio
Il sistema SHALL offrire la pagina "Layout" all'indirizzo `/#layout`,
raggiungibile dalla navigazione e aprendo direttamente l'indirizzo, e SHALL
mostrarla anche quando il database del browser non è ancora pronto o è
bloccato da un'altra scheda.

#### Scenario: Link diretto da un nuovo visitatore
- **WHEN** un utente che non ha mai aperto clavis-trainer apre `/#layout`
- **THEN** vede la pagina Layout con gli 8 pannelli, senza passare dall'allenamento

#### Scenario: Dalla navigazione
- **WHEN** l'utente sceglie "Layout" nella navigazione
- **THEN** la pagina Layout si apre e l'indirizzo diventa `/#layout`

#### Scenario: Ritorno alle altre viste
- **WHEN** dalla pagina Layout l'utente sceglie "Allenamento"
- **THEN** si apre l'allenamento e l'indirizzo non contiene più `#layout`

#### Scenario: Database bloccato
- **WHEN** l'utente apre `/#layout` mentre l'apertura del database aspetta la chiusura di una scheda vecchia
- **THEN** la pagina Layout è visibile e funzionante

### Requirement: Guida non automatica sulla pagina Layout
Il sistema SHALL NOT aprire da solo la guida al posizionamento delle dita
mentre è aperta la pagina Layout; l'apertura automatica resta valida quando
l'utente passa a un'altra vista.

#### Scenario: Primo avvio sulla pagina Layout
- **WHEN** un utente nuovo apre `/#layout`
- **THEN** la guida non si apre

#### Scenario: Passaggio all'allenamento
- **WHEN** lo stesso utente passa poi all'allenamento
- **THEN** la guida si apre da sola come al primo avvio

### Requirement: Tutti i layer del firmware
La pagina SHALL mostrare un pannello per ognuno degli 8 layer di clavis
(BASE, NAV, MOUSE, MEDIA, SYM, NUM, FUN, BUTTON), ricavato dalla keymap del
firmware, con la stessa forma della tastiera dell'allenamento: 36 tasti, due
metà sfalsate e tre pollici per lato.

#### Scenario: Contenuto del layer MEDIA
- **WHEN** si guarda il pannello MEDIA
- **THEN** la metà sinistra mostra il tastierino `7 8 9`, `4 5 6`, `0 1 2 3` e la metà destra i controlli di volume, brano e Bluetooth come nel firmware

#### Scenario: Firmware modificato
- **WHEN** nel firmware cambia un tasto del layer NAV e si rigenera la keymap
- **THEN** il pannello NAV mostra il nuovo tasto

### Requirement: Tasto che attiva il layer
In ogni pannello diverso da BASE il sistema SHALL evidenziare il tasto da
tenere premuto sul layer BASE per attivarlo e SHALL indicarne il nome nel
titolo del pannello.

#### Scenario: Layer NAV
- **WHEN** si guarda il pannello NAV
- **THEN** il pollice sinistro centrale (spazio sul layer BASE) è evidenziato e il titolo dice di tenere Spazio

#### Scenario: Layer BUTTON
- **WHEN** si guarda il pannello BUTTON
- **THEN** sono evidenziati i due tasti che lo attivano, `z` e `/` sul layer BASE con Colemak-DH

### Requirement: Ordine dei pannelli
Il sistema SHALL disporre pannelli e legenda in tre gruppi, nell'ordine:
BASE, BUTTON e legenda; i layer attivati dal pollice sinistro (NAV, MOUSE,
MEDIA); i layer attivati dal pollice destro (SYM, NUM, FUN). Su schermo largo
e in stampa ogni gruppo è una riga di tre celle; su schermo stretto le celle
sono in una colonna nello stesso ordine.

#### Scenario: Disposizione su schermo largo
- **WHEN** la pagina si apre su uno schermo largo almeno 1200 px
- **THEN** la prima riga mostra BASE, BUTTON e la legenda, la seconda NAV, MOUSE, MEDIA e la terza SYM, NUM, FUN

#### Scenario: Schermo stretto
- **WHEN** la pagina si apre su uno schermo largo 400 px
- **THEN** pannelli e legenda sono in una sola colonna nello stesso ordine, senza scorrimento orizzontale della pagina

### Requirement: Scelta della base e del sistema operativo
La pagina SHALL permettere di scegliere la base (Colemak-DH o QWERTY di
Miryoku) e il sistema operativo (US o italiano) in modo indipendente, e
SHALL preselezionarli dal profilo salvato (Colemak-DH → Colemak-DH e US,
US QWERTY → QWERTY e US, Italiano QWERTY → QWERTY e italiano), oppure
Colemak-DH e US quando non c'è un profilo.

#### Scenario: Senza profilo
- **WHEN** un nuovo visitatore apre la pagina
- **THEN** sono scelti Colemak-DH e US e la riga superiore di BASE è `q w f p b j l u y ;`

#### Scenario: Profilo italiano
- **WHEN** l'utente ha il profilo classica ISO + Italiano QWERTY e apre la pagina
- **THEN** sono scelti QWERTY e italiano

#### Scenario: Cambio della base
- **WHEN** l'utente sceglie QWERTY
- **THEN** la riga superiore di BASE diventa `q w e r t y u i o p` e gli altri pannelli non cambiano

#### Scenario: La scelta non cambia il profilo
- **WHEN** l'utente cambia base o sistema nella pagina e poi torna all'allenamento
- **THEN** il profilo di digitazione è quello di prima

### Requirement: Caratteri del sistema operativo
Su ogni tasto che emette un carattere la pagina SHALL mostrare il carattere
prodotto dal sistema operativo scelto, non il nome del keycode.

#### Scenario: Parentesi quadra in US
- **WHEN** è scelto il sistema US
- **THEN** il pannello NUM mostra `[` in alto a sinistra

#### Scenario: Stesso tasto in italiano
- **WHEN** è scelto il sistema italiano
- **THEN** lo stesso tasto del pannello NUM mostra `è`

### Requirement: Etichette dei tasti senza testo
Il sistema SHALL etichettare per significato, nella lingua dell'interfaccia,
i tasti che non emettono caratteri: navigazione, appunti, media, Bluetooth,
mouse, tasti funzione, modificatori, tasti di layer e di sistema; le
combinazioni di tasti SHALL apparire con il nome dell'azione.

#### Scenario: Combinazione nel layer NAV
- **WHEN** si guarda il pannello NAV con l'interfaccia in italiano
- **THEN** i tasti `Ctrl+X`, `Ctrl+C`, `Ctrl+V` sono etichettati "Taglia", "Copia", "Incolla"

#### Scenario: Interfaccia in inglese
- **WHEN** l'interfaccia è in inglese
- **THEN** le stesse etichette sono "Cut", "Copy", "Paste"

#### Scenario: Home row mod
- **WHEN** si guarda il pannello BASE
- **THEN** sotto le lettere della riga base compare il modificatore che si ottiene tenendole (gui, alt, ctrl, ⇧), e sotto i pollici il layer che attivano

### Requirement: Colori per categoria e legenda
Il sistema SHALL colorare ogni tasto secondo la categoria della sua azione
(carattere, modificatore, tasto di layer, navigazione e appunti, media e
Bluetooth, mouse, tasti funzione, sistema, non disponibile) e SHALL mostrare una legenda
delle categorie, leggibile nel tema chiaro e in quello scuro.

#### Scenario: Legenda
- **WHEN** si apre la pagina
- **THEN** accanto a BASE e BUTTON c'è la legenda con un campione di colore e il nome di ogni categoria

#### Scenario: Tasto non disponibile
- **WHEN** un tasto del layer non ha azione (`U_NA` o `U_NU` nel firmware)
- **THEN** è disegnato come spento, senza etichetta

### Requirement: Stampa in A4 o A3
La pagina SHALL offrire la scelta tra A4 e A3 e un comando che apre la stampa
del browser con quel formato in orizzontale, impaginando legenda e 8 pannelli
su un solo foglio, con i colori del tema chiaro e senza navigazione né
controlli; accanto al comando SHALL spiegare come salvare in PDF.

#### Scenario: Stampa in A3
- **WHEN** l'utente sceglie A3 e il comando di stampa, e salva in PDF
- **THEN** il PDF ha una sola pagina A3 orizzontale con titolo, base e sistema scelti, 8 pannelli e legenda

#### Scenario: Stampa in A4 con tema scuro
- **WHEN** il sistema è in tema scuro e l'utente stampa in A4
- **THEN** il PDF ha una sola pagina A4 orizzontale con sfondo bianco e tutte le etichette leggibili
