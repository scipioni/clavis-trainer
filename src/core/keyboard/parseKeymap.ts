import type { KeyAction, Keymap, LayerName, Modifier } from './types';
import type { Code } from './osmaps';

/**
 * Keycode ZMK → keycode fisico (nomi di `KeyboardEvent.code`) e Shift implicito.
 * I caratteri si ricavano poi con la mappa del sistema operativo: lo stesso
 * `&kp LPAR` dà `(` con il sistema in US e `)` con quello italiano.
 */
const KEYCODES: Record<string, [Code, boolean?]> = {
  N1: ['Digit1'], N2: ['Digit2'], N3: ['Digit3'], N4: ['Digit4'], N5: ['Digit5'],
  N6: ['Digit6'], N7: ['Digit7'], N8: ['Digit8'], N9: ['Digit9'], N0: ['Digit0'],
  KP_N0: ['Numpad0'], KP_N1: ['Numpad1'], KP_N2: ['Numpad2'], KP_N3: ['Numpad3'], KP_N4: ['Numpad4'],
  KP_N5: ['Numpad5'], KP_N6: ['Numpad6'], KP_N7: ['Numpad7'], KP_N8: ['Numpad8'], KP_N9: ['Numpad9'],
  KP_DOT: ['NumpadDecimal'], KP_MINUS: ['NumpadSubtract'], KP_PLUS: ['NumpadAdd'],
  SEMI: ['Semicolon'], SQT: ['Quote'], DQT: ['Quote', true], GRAVE: ['Backquote'], TILDE: ['Backquote', true],
  BSLH: ['Backslash'], PIPE: ['Backslash', true], COMMA: ['Comma'], DOT: ['Period'], SLASH: ['Slash'],
  MINUS: ['Minus'], UNDER: ['Minus', true], EQUAL: ['Equal'], PLUS: ['Equal', true],
  LBKT: ['BracketLeft'], RBKT: ['BracketRight'], LBRC: ['BracketLeft', true], RBRC: ['BracketRight', true],
  LPAR: ['Digit9', true], RPAR: ['Digit0', true], AMPS: ['Digit7', true], ASTRK: ['Digit8', true],
  COLON: ['Semicolon', true], DLLR: ['Digit4', true], PRCNT: ['Digit5', true], CARET: ['Digit6', true],
  EXCL: ['Digit1', true], AT: ['Digit2', true], HASH: ['Digit3', true],
  SPACE: ['Space'], RET: ['Enter'], TAB: ['Tab'], BSPC: ['Backspace'], DEL: ['Delete'], ESC: ['Escape'],
};

const LABELS: Record<string, string> = {
  SPACE: '␣', RET: '⏎', TAB: '⇥', BSPC: '⌫', DEL: '⌦', ESC: 'Esc',
};

const MODS: Record<string, Modifier> = {
  LSHFT: 'shift', RSHFT: 'shift', LCTRL: 'ctrl', RCTRL: 'ctrl',
  LALT: 'alt', RALT: 'altgr', LGUI: 'gui', RGUI: 'gui',
};

const MOD_LABELS: Record<Modifier, string> = { shift: '⇧', ctrl: 'ctrl', alt: 'alt', gui: 'gui', altgr: 'AltGr' };

function keycodeAction(code: string): Pick<KeyAction, 'code' | 'shift' | 'label' | 'holdMod'> {
  if (/^[A-Z]$/.test(code)) return { code: `Key${code}`, label: code.toLowerCase() };
  const mod = MODS[code];
  if (mod) return { holdMod: mod, label: MOD_LABELS[mod] };
  const k = KEYCODES[code];
  if (k) return { code: k[0], ...(k[1] ? { shift: true } : {}), label: LABELS[code] ?? '' };
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
