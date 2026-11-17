# Spec Delta

## MODIFIED Requirements

### Requirement: Corpus italiano incluso
Il sistema SHALL includere, utilizzabili senza connessione, per l'italiano e
per l'inglese una lista delle parole più frequenti (almeno 5.000) e una
raccolta di frasi reali (almeno 2.000), con attribuzione e licenza delle fonti
visibili nell'applicazione.

#### Scenario: Uso offline
- **WHEN** l'applicazione è aperta senza connessione di rete
- **THEN** tutte le modalità di esercizio funzionano in entrambe le lingue

#### Scenario: Attribuzione
- **WHEN** l'utente apre la sezione informazioni
- **THEN** vede le fonti dei corpus italiano e inglese e le rispettive licenze

### Requirement: Testo libero
Il sistema SHALL permettere di incollare un testo qualsiasi da digitare,
normalizzando spazi e a capo, sostituendo le varianti tipografiche comuni
(virgolette curve, apostrofo tipografico, trattini lunghi, puntini di
sospensione) con i caratteri digitabili equivalenti e togliendo i caratteri
che il profilo attivo non sa produrre.

#### Scenario: Apostrofo tipografico
- **WHEN** il testo incollato contiene `l’acqua` con apostrofo curvo
- **THEN** il testo da digitare diventa `l'acqua`

#### Scenario: Caratteri non digitabili
- **WHEN** il testo incollato contiene `€` o emoji
- **THEN** il sistema li rimuove e avvisa l'utente di quanti caratteri sono stati tolti

#### Scenario: Dipende dal profilo
- **WHEN** con il profilo classica ANSI + Italiano QWERTY il testo incollato contiene `a < b`
- **THEN** il `<` viene tolto perché il formato ANSI non ha il tasto ISO in più

## ADDED Requirements

### Requirement: Lingua degli esercizi
Il sistema SHALL permettere di scegliere la lingua degli esercizi (italiano o
inglese) indipendentemente dalla lingua dell'interfaccia; al primo avvio è
uguale alla lingua dell'interfaccia. Modalità adattiva e frasi usano il corpus
di quella lingua.

#### Scenario: Esercizi in inglese
- **WHEN** l'utente sceglie gli esercizi in inglese e avvia una sessione adattiva
- **THEN** il testo è composto da parole inglesi del corpus

#### Scenario: Interfaccia e esercizi diversi
- **WHEN** l'interfaccia è in italiano e la lingua degli esercizi è inglese
- **THEN** i testi dell'interfaccia restano in italiano e le frasi da digitare sono inglesi
