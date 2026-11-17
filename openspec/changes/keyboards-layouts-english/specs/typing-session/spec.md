# Spec Delta

## MODIFIED Requirements

### Requirement: Tastiera clavis a schermo
Durante la sessione il sistema SHALL mostrare la tastiera del profilo attivo
(clavis o classica ANSI/ISO, con le etichette del layout) e, per clavis, il
layer necessario al prossimo carattere, evidenziando il tasto da battere e i
tasti da tenere. L'utente può nascondere la tastiera.

#### Scenario: Prossimo carattere su layer
- **WHEN** con il profilo clavis + Colemak-DH il prossimo carattere è `(`
- **THEN** la tastiera mostra il layer SYM, evidenzia `(` sul lato sinistro e il tasto di layer SYM sul pollice destro come tasto da tenere

#### Scenario: Tastiera nascosta
- **WHEN** l'utente nasconde la tastiera
- **THEN** la tastiera non compare nelle sessioni successive finché non la riattiva

#### Scenario: Tastiera classica
- **WHEN** con il profilo classica ISO + Italiano QWERTY il prossimo carattere è `@`
- **THEN** la tastiera mostra una tastiera ISO con le etichette italiane, evidenzia il tasto `ò` da battere e AltGr da tenere
