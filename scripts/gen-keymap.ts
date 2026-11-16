// Rigenera src/core/keyboard/clavis.keymap.json dalla keymap ZMK di clavis.
// Uso: bun scripts/gen-keymap.ts [percorso-o-url di custom_config.h]
import { writeFileSync, readFileSync } from 'node:fs';
import { parseKeymap } from '../src/core/keyboard/parseKeymap';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/scipioni/clavis/main/firmware/zmk-timeless/config/custom_config.h';
const OUT = new URL('../src/core/keyboard/clavis.keymap.json', import.meta.url);

const arg = process.argv[2] ?? DEFAULT_URL;
const src = /^https?:/.test(arg) ? await (await fetch(arg)).text() : readFileSync(arg, 'utf8');
const source = 'scipioni/clavis firmware/zmk-timeless/config/custom_config.h';
const keymap = parseKeymap(src, source);
writeFileSync(OUT, JSON.stringify(keymap, null, 1) + '\n');
console.log(`scritto ${OUT.pathname}`);
