// Cerca nei componenti testi visibili scritti in chiaro invece che con t().
// Uso: bun scripts/check-i18n.ts   (esce con 1 se trova qualcosa)
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('../src/ui/', import.meta.url).pathname;
/** Parole che non si traducono (nomi propri, sigle). */
const ALLOWED = new Set(['clavis', 'trainer', 'clavis-trainer', 'FrequencyWords', 'Tatoeba', 'CC', 'BY', 'BY-SA', 'FR', 'WPM', 'github.com/scipioni/clavis']);

let problems = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.svelte'))) {
  const src = readFileSync(DIR + f, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, (m) => '\n'.repeat(m.split('\n').length - 1))
    .replace(/<style[\s\S]*?<\/style>/g, (m) => '\n'.repeat(m.split('\n').length - 1))
    .replace(/<!--[\s\S]*?-->/g, '');
  src.split('\n').forEach((rawLine, i) => {
    // via le espressioni {…} (anche annidate): contengono > e < che non sono tag
    let line = rawLine;
    for (let prev = ''; prev !== line; ) {
      prev = line;
      line = line.replace(/\{[^{}]*\}/g, ' ');
    }
    const texts: string[] = [];
    // testo tra i tag, senza le espressioni {…}
    for (const m of line.matchAll(/>([^<>]*)</g)) texts.push(m[1]);
    const trailing = /^\s*([^<>{}]+)$/.exec(line);
    if (trailing && !/[=]/.test(trailing[1])) texts.push(trailing[1]);
    // attributi visibili scritti in chiaro
    for (const m of line.matchAll(/(?:aria-label|placeholder|title|alt)="([^"{]*)"/g)) texts.push(m[1]);
    for (const raw of texts) {
      if (/^\s*[\w.-]+\.[a-z]{2,}\/\S*\s*$/.test(raw)) continue; // URL mostrati come testo
      const words = raw.replace(/\{[^}]*\}/g, ' ').match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{2,}/g) ?? [];
      const bad = words.filter((w) => !ALLOWED.has(w));
      if (bad.length) {
        problems++;
        console.log(`${f}:${i + 1}: ${raw.trim()}`);
      }
    }
  });
}
if (problems) {
  console.log(`\n${problems} testi fuori catalogo`);
  process.exit(1);
}
console.log('nessun testo fuori catalogo');
