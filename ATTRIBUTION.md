# Fonti dei dati

I file in `public/corpus/it/` e `public/corpus/en/` derivano da queste opere e restano sotto le loro
licenze. Il resto del codice non è coperto da queste licenze.

## Italiano

### Parole: `public/corpus/it/words.json`

- **FrequencyWords**, lista `it_50k` (edizione 2018), di Hermit Dave,
  ricavata dai sottotitoli di OpenSubtitles.
  <https://github.com/hermitdave/FrequencyWords>
- Licenza: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Modifiche: tenute le prime 10.000 parole composte solo da lettere minuscole
  italiane, escluse quelle in `scripts/corpus-exclude-it.txt`. Il file derivato è
  distribuito con la stessa licenza.

### Frasi: `public/corpus/it/sentences.json`

- **Tatoeba**, frasi in italiano (`ita_sentences.tsv`), con l'identificativo
  di ogni frase: `https://tatoeba.org/it/sentences/show/<id>`.
  <https://tatoeba.org>
- Licenza: [Creative Commons Attribution 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/)
- Modifiche: normalizzazione tipografica, filtro per lunghezza (20–120
  caratteri) e per caratteri digitabili, esclusione delle frasi con "Tom" e
  "Mary", campione casuale riproducibile di 5.000 frasi.

## Inglese

### Parole: `public/corpus/en/words.json`

- **FrequencyWords**, lista `en_50k` (edizione 2018), di Hermit Dave,
  ricavata dai sottotitoli di OpenSubtitles.
  <https://github.com/hermitdave/FrequencyWords>
- Licenza: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Modifiche: parole in minuscolo (con `I` maiuscola), escluse quelle in
  `scripts/corpus-exclude-en.txt` e i frammenti di contrazioni spezzate; le
  contrazioni (`don't`, `I'm`…) sono ricostruite contando le frasi di Tatoeba e
  stimandone la frequenza in proporzione a `the`. Prime 10.000. Il file derivato
  è distribuito con la stessa licenza.

### Frasi: `public/corpus/en/sentences.json`

- **Tatoeba**, frasi in inglese (`eng_sentences.tsv`), con l'identificativo di
  ogni frase: `https://tatoeba.org/en/sentences/show/<id>`.
- Licenza: [Creative Commons Attribution 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/)
- Modifiche: come per l'italiano (normalizzazione, 20–120 caratteri, senza
  "Tom" e "Mary", campione riproducibile di 5.000 frasi).

Per rigenerare: `bun run build:corpus` (oppure `bun run build:corpus it|en`).
