import type { KeyAction, Keymap, LayerName, Modifier } from './types';

/** Keycode ZMK → [carattere, carattere con Shift] secondo il layout US. */
const KEYCODES: Record<string, [string, string?]> = {
  N1: ['1', '!'], N2: ['2', '@'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'],
  N6: ['6', '^'], N7: ['7', '&'], N8: ['8', '*'], N9: ['9', '('], N0: ['0', ')'],
  KP_N0: ['0'], KP_N1: ['1'], KP_N2: ['2'], KP_N3: ['3'], KP_N4: ['4'],
  KP_N5: ['5'], KP_N6: ['6'], KP_N7: ['7'], KP_N8: ['8'], KP_N9: ['9'],
  KP_DOT: ['.'], KP_MINUS: ['-'], KP_PLUS: ['+'],
  SEMI: [';', ':'], SQT: ["'", '"'], DQT: ['"'], GRAVE: ['`', '~'],
  BSLH: ['\\', '|'], COMMA: [',', '<'], DOT: ['.', '>'], SLASH: ['/', '?'],
  MINUS: ['-', '_'], EQUAL: ['=', '+'], LBKT: ['[', '{'], RBKT: [']', '}'],
  LBRC: ['{'], RBRC: ['}'], LPAR: ['('], RPAR: [')'], AMPS: ['&'], ASTRK: ['*'],
  COLON: [':'], DLLR: ['$'], PRCNT: ['%'], CARET: ['^'], PLUS: ['+'],
  TILDE: ['~'], EXCL: ['!'], AT: ['@'], HASH: ['#'], PIPE: ['|'], UNDER: ['_'],
  SPACE: [' '], RET: ['\n'], TAB: ['\t'],
};

const LABELS: Record<string, string> = {
  SPACE: '␣', RET: '⏎', TAB: '⇥', BSPC: '⌫', DEL: '⌦', ESC: 'Esc',
};

const MODS: Record<string, Modifier> = {
  LSHFT: 'shift', RSHFT: 'shift', LCTRL: 'ctrl', RCTRL: 'ctrl',
  LALT: 'alt', RALT: 'alt', LGUI: 'gui', RGUI: 'gui',
};

function keycodeAction(code: string): Pick<KeyAction, 'tap' | 'shiftTap' | 'label' | 'holdMod'> {
  if (/^[A-Z]$/.test(code)) return { tap: code.toLowerCase(), shiftTap: code, label: code.toLowerCase() };
  const mod = MODS[code];
  if (mod) return { holdMod: mod, label: mod === 'shift' ? '⇧' : mod };
  const k = KEYCODES[code];
  if (k) return { tap: k[0], shiftTap: k[1], label: LABELS[code] ?? k[0] };
  return { label: LABELS[code] ?? code.toLowerCase() };
}

/** Converte un token Miryoku/ZMK (es. `U_MTL(LSHFT, T)`) in un'azione. */
export function parseToken(raw: string): KeyAction {
  const t = raw.trim();
  if (t === 'U_NP') return { label: '', absent: true };
  let m = /^&kp\s+([A-Z0-9_]+)$/.exec(t);
  if (m) return keycodeAction(m[1]);
  m = /^U_MT[LR]?\(\s*([A-Z]+)\s*,\s*([A-Z0-9_]+)\s*\)$/.exec(t);
  if (m) return { ...keycodeAction(m[2]), holdMod: MODS[m[1]] };
  m = /^U_LT[LR]?\(\s*U_([A-Z]+)\s*,\s*([A-Z0-9_]+)\s*\)$/.exec(t);
  if (m) return { ...keycodeAction(m[2]), holdLayer: m[1] };
  // Tutto il resto (U_NA, U_BOOT, &u_..., &kp LC(X), RA(...), ...) non produce testo.
  return { label: '' };
}

/** Estrae il corpo della macro `#define NAME ...` attiva (non commentata). */
function macroBody(src: string, name: string): string {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^\\s*#define\\s+${name}\\b`).test(l));
  if (start < 0) throw new Error(`macro ${name} non trovata`);
  const body: string[] = [lines[start].replace(new RegExp(`^\\s*#define\\s+${name}`), '')];
  for (let i = start; lines[i].trimEnd().endsWith('\\'); i++) body.push(lines[i + 1]);
  return body.join('\n').replace(/\\\s*$/gm, '');
}

/** Divide sulle virgole di primo livello (ignorando quelle tra parentesi). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x.length > 0);
}

export function parseKeymap(src: string, source = 'custom_config.h'): Keymap {
  const layers = {} as Record<LayerName, KeyAction[]>;
  for (const name of ['BASE', 'NUM', 'SYM'] as LayerName[]) {
    const tokens = splitTopLevel(macroBody(src, `MIRYOKU_LAYER_${name}`));
    if (tokens.length !== 40) throw new Error(`layer ${name}: attese 40 posizioni, trovate ${tokens.length}`);
    layers[name] = tokens.map(parseToken);
  }
  return { source, layers };
}
