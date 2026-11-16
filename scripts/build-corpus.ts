// Costruisce public/corpus/{words,sentences}.json dalle fonti originali.
// Uso: bun run build:corpus   (scarica in .corpus-raw/ se mancano i file)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { clavisResolver } from '../src/core/keyboard';
import { normalizeText } from '../src/core/exercise/normalize';
import { seededRng } from '../src/core/exercise/random';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = `${ROOT}.corpus-raw`;
const OUT = `${ROOT}public/corpus`;

const WORDS_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_50k.txt';
const SENTENCES_URL = 'https://downloads.tatoeba.org/exports/per_language/ita/ita_sentences.tsv.bz2';

const MAX_WORDS = 10_000;
const MAX_SENTENCES = 5_000;
const SINGLE_LETTER_WORDS = new Set(['a', 'e', 'i', 'o', 'è']);

async function download(url: string, file: string) {
  const path = `${RAW}/${file}`;
  if (existsSync(path)) return path;
  console.log(`scarico ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
  return path;
}

mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
const resolver = clavisResolver();
const exclude = new Set(
  readFileSync(`${ROOT}scripts/corpus-exclude.txt`, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
);

// --- parole -----------------------------------------------------------------
const wordsFile = await download(WORDS_URL, 'it_50k.txt');
const words: [string, number][] = [];
for (const line of readFileSync(wordsFile, 'utf8').split('\n')) {
  const [rawWord, count] = line.trim().split(' ');
  if (!rawWord || !count) continue;
  const w = rawWord.normalize('NFC');
  const len = Array.from(w).length;
  if (!/^[a-zàèéìòù]+$/.test(w)) continue; // solo minuscole italiane: niente nomi propri, numeri, apostrofi
  if (len > 14 || (len === 1 && !SINGLE_LETTER_WORDS.has(w))) continue;
  if (exclude.has(w) || !resolver.canTypeAll(w)) continue;
  words.push([w, Number(count)]);
  if (words.length >= MAX_WORDS) break;
}

// --- frasi ------------------------------------------------------------------
const sentFile = await download(SENTENCES_URL, 'ita_sentences.tsv.bz2');
const tsv = execFileSync('bunzip2', ['-kc', sentFile], { maxBuffer: 1 << 30 }).toString('utf8');
const seen = new Set<string>();
const candidates: [number, string][] = [];
for (const line of tsv.split('\n')) {
  const [id, lang, raw] = line.split('\t');
  if (lang !== 'ita' || !raw) continue;
  const { text, removed } = normalizeText(raw, resolver);
  if (removed > 0 || text.length < 20 || text.length > 120) continue;
  if (!/^[A-ZÀÈÉÌÒÙ"]/.test(text) || !/[.?!"]$/.test(text)) continue;
  // Tatoeba in italiano è pieno di varianti con Tom e Mary: le escludo per avere più varietà.
  if (/\b(Tom|Mary)\b/.test(text)) continue;
  const lower = text.toLowerCase().split(/\s+/);
  if (lower.some((w) => exclude.has(w.replace(/[^a-zàèéìòù]/g, '')))) continue;
  if (seen.has(text)) continue;
  seen.add(text);
  candidates.push([Number(id), text]);
}
// campione riproducibile (Fisher-Yates parziale con seme fisso)
const rng = seededRng(20261116);
for (let i = 0; i < Math.min(MAX_SENTENCES, candidates.length); i++) {
  const j = i + Math.floor(rng() * (candidates.length - i));
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}
const sentences = candidates.slice(0, MAX_SENTENCES).sort((a, b) => a[0] - b[0]);

writeFileSync(
  `${OUT}/words.json`,
  JSON.stringify({ source: 'FrequencyWords it_50k (2018)', license: 'CC BY-SA 4.0', words }),
);
writeFileSync(
  `${OUT}/sentences.json`,
  JSON.stringify({ source: 'Tatoeba (ita)', license: 'CC BY 2.0 FR', sentences }),
);
console.log(`parole: ${words.length}, frasi: ${sentences.length} (su ${candidates.length} candidate)`);
