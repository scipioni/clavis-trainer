// Costruisce public/corpus/<lingua>/{words,sentences}.json dalle fonti originali.
// Uso: bun run build:corpus [it|en]   (senza argomento: tutte; scarica in .corpus-raw/ se mancano i file)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { clavisResolver } from '../src/core/keyboard';
import { normalizeText } from '../src/core/exercise/normalize';
import { seededRng } from '../src/core/exercise/random';
import { LANGS, type Lang } from '../src/core/exercise/languages';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = `${ROOT}.corpus-raw`;

const MAX_WORDS = 10_000;
const MAX_SENTENCES = 5_000;

interface LangSource {
  freq: string; // FrequencyWords
  tatoeba: string; // codice ISO 639-3
  /** Forma accettata delle parole (minuscole, eventuali apostrofi). */
  word: RegExp;
  /** Parole di una lettera ammesse. */
  single: Set<string>;
  /** Iniziale ammessa per le frasi. */
  start: RegExp;
  /** Lettere per pulire le parole delle frasi prima del confronto con l'esclusione. */
  letters: RegExp;
  /** Correzioni delle parole (es. "i" inglese → "I"). */
  fix?: (w: string) => string;
  /**
   * La lista di frequenza spezza le parole con apostrofo (don't → don + t): le
   * si ricava dalle frasi, con frequenza stimata in proporzione a `the`.
   */
  apostropheWords?: boolean;
}

const SOURCES: Record<Lang, LangSource> = {
  it: {
    freq: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_50k.txt',
    tatoeba: 'ita',
    word: /^[a-zàèéìòù]+$/, // solo minuscole: niente nomi propri, numeri, apostrofi (le elisioni le aggiunge il generatore)
    single: new Set(['a', 'e', 'i', 'o', 'è']),
    start: /^[A-ZÀÈÉÌÒÙ"]/,
    letters: /[^a-zàèéìòù]/g,
  },
  en: {
    freq: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
    tatoeba: 'eng',
    word: /^[a-z]+('[a-z]+)?$/, // contrazioni comprese (don't, it's): esercitano l'apostrofo
    single: new Set(['a', 'i']),
    start: /^[A-Z"]/,
    letters: /[^a-z']/g,
    fix: (w) => (w === 'i' || w.startsWith("i'") ? 'I' + w.slice(1) : w),
    apostropheWords: true,
  },
};

async function download(url: string, file: string) {
  const path = `${RAW}/${file}`;
  if (existsSync(path)) return path;
  console.log(`scarico ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
  return path;
}

const resolver = clavisResolver();

async function build(lang: Lang) {
  const src = SOURCES[lang];
  const out = `${ROOT}public/corpus/${lang}`;
  mkdirSync(out, { recursive: true });
  const exclude = new Set(
    readFileSync(`${ROOT}scripts/corpus-exclude-${lang}.txt`, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );

  // --- parole ---------------------------------------------------------------
  const wordsFile = await download(src.freq, `${lang}_50k.txt`);
  const words: [string, number][] = [];
  for (const line of readFileSync(wordsFile, 'utf8').split('\n')) {
    const [rawWord, count] = line.trim().split(' ');
    if (!rawWord || !count) continue;
    const lower = rawWord.normalize('NFC');
    const len = Array.from(lower).length;
    if (!src.word.test(lower)) continue;
    if (len > 14 || (len === 1 && !src.single.has(lower))) continue;
    if (exclude.has(lower)) continue;
    const w = src.fix ? src.fix(lower) : lower;
    if (!resolver.canTypeAll(w)) continue;
    words.push([w, Number(count)]);
    if (words.length >= MAX_WORDS) break;
  }

  // --- frasi ----------------------------------------------------------------
  const sentFile = await download(`https://downloads.tatoeba.org/exports/per_language/${src.tatoeba}/${src.tatoeba}_sentences.tsv.bz2`, `${src.tatoeba}_sentences.tsv.bz2`);
  const tsv = execFileSync('bunzip2', ['-kc', sentFile], { maxBuffer: 1 << 30 }).toString('utf8');
  const seen = new Set<string>();
  const candidates: [number, string][] = [];
  for (const line of tsv.split('\n')) {
    const [id, code, raw] = line.split('\t');
    if (code !== src.tatoeba || !raw) continue;
    const { text, removed } = normalizeText(raw, resolver);
    if (removed > 0 || text.length < 20 || text.length > 120) continue;
    if (!src.start.test(text) || !/[.?!"]$/.test(text)) continue;
    // Tatoeba è pieno di varianti con Tom e Mary: le escludo per avere più varietà.
    if (/\b(Tom|Mary)\b/.test(text)) continue;
    if (text.toLowerCase().split(/\s+/).some((w) => exclude.has(w.replace(src.letters, '')))) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    candidates.push([Number(id), text]);
  }
  if (src.apostropheWords) {
    // conteggio delle parole con apostrofo in tutte le frasi candidate
    const counts = new Map<string, number>();
    let the = 0;
    for (const [, text] of candidates) {
      for (const tok of text.toLowerCase().split(/[^a-z']+/)) {
        if (tok === 'the') the++;
        if (/^[a-z]+'[a-z]+$/.test(tok)) counts.set(tok, (counts.get(tok) ?? 0) + 1);
      }
    }
    const theFreq = words.find(([w]) => w === 'the')?.[1] ?? 0;
    const scale = the > 0 ? theFreq / the : 0;
    const have = new Set(words.map(([w]) => w));
    for (const [tok, n] of counts) {
      const w = src.fix ? src.fix(tok) : tok;
      if (n < 50 || have.has(w) || exclude.has(tok) || !resolver.canTypeAll(w)) continue;
      words.push([w, Math.round(n * scale)]);
    }
    words.sort((a, b) => b[1] - a[1]);
    words.length = Math.min(words.length, MAX_WORDS);
  }

  // campione riproducibile (Fisher-Yates parziale con seme fisso)
  const rng = seededRng(20261116);
  for (let i = 0; i < Math.min(MAX_SENTENCES, candidates.length); i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const sentences = candidates.slice(0, MAX_SENTENCES).sort((a, b) => a[0] - b[0]);

  writeFileSync(`${out}/words.json`, JSON.stringify({ source: `FrequencyWords ${lang}_50k (2018)`, license: 'CC BY-SA 4.0', words }));
  writeFileSync(`${out}/sentences.json`, JSON.stringify({ source: `Tatoeba (${src.tatoeba})`, license: 'CC BY 2.0 FR', sentences }));
  console.log(`${lang}: parole ${words.length}, frasi ${sentences.length} (su ${candidates.length} candidate)`);
}

mkdirSync(RAW, { recursive: true });
const only = process.argv[2] as Lang | undefined;
for (const lang of only ? [only] : LANGS) await build(lang);
