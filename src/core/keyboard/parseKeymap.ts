import { CLAVIS_LAYERS, type ClavisLayer, type KeyAction, type Keymap, type Modifier } from './types';
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

/** Keycode ZMK che non emettono testo → funzione (per la mappa di consultazione). */
const KEY_FNS: Record<string, string> = {
  LEFT: 'nav.left', RIGHT: 'nav.right', UP: 'nav.up', DOWN: 'nav.down',
  HOME: 'nav.home', END: 'nav.end', PG_UP: 'nav.pgUp', PG_DN: 'nav.pgDn', INS: 'nav.ins',
  C_PREV: 'media.prev', C_NEXT: 'media.next', C_VOL_UP: 'media.volUp', C_VOL_DN: 'media.volDn',
  C_STOP: 'media.stop', C_PP: 'media.playPause', C_MUTE: 'media.mute',
  PSCRN: 'fkey.pscrn', SLCK: 'fkey.slck', PAUSE_BREAK: 'fkey.pause', K_APP: 'fkey.menu',
  'LC(X)': 'clip.cut', 'LC(C)': 'clip.copy', 'LC(V)': 'clip.paste', 'LC(Z)': 'clip.undo',
};

/** Macro e behavior di Miryoku/ZMK che non emettono testo → funzione. */
const TOKEN_FNS: Record<string, string> = {
  U_NA: 'none', U_NU: 'none', U_BOOT: 'sys.boot',
  U_UND: 'clip.undo', U_CUT: 'clip.cut', U_CPY: 'clip.copy', U_PST: 'clip.paste', U_RDO: 'clip.redo',
  U_BTN1: 'btn.1', U_BTN2: 'btn.2', U_BTN3: 'btn.3',
  U_MS_L: 'mouse.left', U_MS_R: 'mouse.right', U_MS_U: 'mouse.up', U_MS_D: 'mouse.down',
  U_WH_L: 'wheel.left', U_WH_R: 'wheel.right', U_WH_U: 'wheel.up', U_WH_D: 'wheel.down',
  U_RGB_TOG: 'rgb.toggle', U_RGB_EFF: 'rgb.effect', U_RGB_HUI: 'rgb.hue', U_RGB_SAI: 'rgb.sat', U_RGB_BRI: 'rgb.bright',
  U_EP_TOG: 'ep.toggle', '&u_out_tog': 'out.toggle', '&u_caps_word': 'caps.word',
};

function keycodeAction(code: string): Pick<KeyAction, 'code' | 'shift' | 'label' | 'holdMod' | 'fn'> {
  if (/^[A-Z]$/.test(code)) return { code: `Key${code}`, label: code.toLowerCase() };
  const mod = MODS[code];
  if (mod) return { holdMod: mod, label: MOD_LABELS[mod] };
  const k = KEYCODES[code];
  if (k) return { code: k[0], ...(k[1] ? { shift: true } : {}), label: LABELS[code] ?? '' };
  const f = /^F(\d{1,2})$/.exec(code);
  if (f) return { label: '', fn: `fkey.${f[1]}` };
  const fn = KEY_FNS[code];
  if (fn) return { label: '', fn };
  return { label: LABELS[code] ?? code.toLowerCase(), fn: 'unknown' };
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
  // AltGr + keycode (&kp RA(SQT)): fuori da `code`, la risoluzione non lo usa
  m = /^&kp\s+RA\(\s*([A-Z0-9_]+)\s*\)$/.exec(t);
  if (m && KEYCODES[m[1]]) {
    const [code, shift] = KEYCODES[m[1]];
    return { label: '', altgr: { code, ...(shift ? { shift: true } : {}) } };
  }
  m = /^&kp\s+(L[CSAG]\([A-Z0-9_]+\))$/.exec(t);
  if (m && KEY_FNS[m[1]]) return { label: '', fn: KEY_FNS[m[1]] };
  m = /^&u_bt_sel_(\d)$/.exec(t);
  if (m) return { label: '', fn: `bt.${m[1]}` };
  m = /^&u_to_U_([A-Z]+)$/.exec(t);
  if (m) return { label: '', fn: `to.${m[1]}` };
  const fn = TOKEN_FNS[t];
  if (fn) return { label: '', fn };
  return { label: '', fn: 'unknown' };
}

/** Token che la conversione non riconosce (per avvisare chi rigenera la keymap). */
export function unknownTokens(src: string): string[] {
  const out: string[] = [];
  for (const name of CLAVIS_LAYERS) {
    for (const tok of splitTopLevel(macroBody(src, `MIRYOKU_LAYER_${name}`))) {
      if (parseToken(tok).fn === 'unknown') out.push(`${name}: ${tok}`);
    }
  }
  return out;
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
  const layers = {} as Record<ClavisLayer, KeyAction[]>;
  for (const name of CLAVIS_LAYERS) {
    const tokens = splitTopLevel(macroBody(src, `MIRYOKU_LAYER_${name}`));
    if (tokens.length !== 40) throw new Error(`layer ${name}: attese 40 posizioni, trovate ${tokens.length}`);
    layers[name] = tokens.map(parseToken);
  }
  return { source, layers };
}
