# Fonti dei dati

I file in `public/corpus/` derivano da queste opere e restano sotto le loro
licenze. Il resto del codice non è coperto da queste licenze.

## Parole: `public/corpus/words.json`

- **FrequencyWords**, lista `it_50k` (edizione 2018), di Hermit Dave,
  ricavata dai sottotitoli di OpenSubtitles.
  <https://github.com/hermitdave/FrequencyWords>
- Licenza: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Modifiche: tenute le prime 10.000 parole composte solo da lettere minuscole
  italiane, escluse quelle in `scripts/corpus-exclude.txt`. Il file derivato è
  distribuito con la stessa licenza.

## Frasi: `public/corpus/sentences.json`

- **Tatoeba**, frasi in italiano (`ita_sentences.tsv`), con l'identificativo
  di ogni frase: `https://tatoeba.org/it/sentences/show/<id>`.
  <https://tatoeba.org>
- Licenza: [Creative Commons Attribution 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/)
- Modifiche: normalizzazione tipografica, filtro per lunghezza (20–120
  caratteri) e per caratteri digitabili, esclusione delle frasi con "Tom" e
  "Mary", campione casuale riproducibile di 5.000 frasi.

Per rigenerare: `bun run build:corpus`.
