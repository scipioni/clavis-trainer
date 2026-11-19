/**
 * Guida al posizionamento delle dita: quale versione mostrare, quando aprirla
 * da sola e cosa evidenziare in ogni passo. Modulo puro: i tasti, le dita e i
 * caratteri vengono dal modello della tastiera del profilo.
 */
import type { Board, BoardKey } from './keyboard/boards';
import type { Finger, GuideKind, Hand, KeyboardId, LayerName, Profile } from './keyboard/types';

export function guideKind(keyboard: KeyboardId): GuideKind {
  return keyboard === 'clavis' ? 'clavis' : 'classic';
}

/**
 * Profilo da disegnare per una versione della guida: il layout è sempre quello
 * del profilo; per la guida classica vista da un profilo clavis, ISO con il
 * layout italiano (le tastiere italiane sono ISO) e ANSI con gli altri.
 */
export function guideProfile(kind: GuideKind, profile: Profile): Profile {
  if (kind === 'clavis') return { keyboard: 'clavis', layout: profile.layout };
  if (profile.keyboard !== 'clavis') return profile;
  return { keyboard: profile.layout === 'it' ? 'iso' : 'ansi', layout: profile.layout };
}

export interface AutoOpenState {
  /** App caricata. */
  ready: boolean;
  /** Sessioni interrotte ancora da recuperare o scartare. */
  interrupted: number;
  /** Sessione di allenamento in corso. */
  sessionActive: boolean;
  /** Guida già aperta. */
  open: boolean;
  /** Si sta guardando la mappa dei layer: chi arriva da un link vuole solo quella. */
  onLayout: boolean;
  /** Versione per la tastiera del profilo attivo. */
  kind: GuideKind;
  seen: readonly GuideKind[];
}

/** La guida della tastiera attiva va aperta da sola adesso? */
export function shouldAutoOpen(s: AutoOpenState): boolean {
  return s.ready && s.interrupted === 0 && !s.sessionActive && !s.open && !s.onLayout && !s.seen.includes(s.kind);
}

/** Le versioni viste dopo aver chiuso una guida in cui si sono mostrate `shown`. */
export function markSeen(seen: readonly GuideKind[], shown: Iterable<GuideKind>): GuideKind[] {
  const all = new Set<GuideKind>([...seen, ...shown]);
  return (['clavis', 'classic'] as GuideKind[]).filter((k) => all.has(k));
}

// --- tasti notevoli --------------------------------------------------------------

/** Dita che battono i tasti (non i pollici), dall'esterno verso il centro. */
export const FINGERS: Exclude<Finger, 'thumb'>[] = ['pinky', 'ring', 'middle', 'index'];

/** Riga della posizione base: centrale delle lettere (1 su clavis, 2 sulla classica con la riga dei numeri). */
export function homeRow(board: Board): number {
  return board.keyboard === 'clavis' ? 1 : 2;
}

const centerX = (board: Board, k: BoardKey) => k.x + k.w / 2 - board.width / 2;

export interface Pad {
  hand: Hand;
  finger: Finger;
  /** Tasto su cui si posa. */
  pos: number;
  /** Spostamento orizzontale sul tasto (0..1 della larghezza; 0,5 = al centro). */
  at: number;
}

/**
 * Tasti della posizione base: per ogni mano e dito, tra i tasti della riga
 * centrale di quel dito fuori dalla colonna interna, il più vicino al centro
 * (sulla classica esclude Bloc Maiusc, ' e Invio).
 */
export function homePads(board: Board): Pad[] {
  const row = homeRow(board);
  const pads: Pad[] = [];
  for (const hand of ['L', 'R'] as Hand[]) {
    for (const finger of FINGERS) {
      const candidates = board.keys.filter((k) => k.present && k.row === row && k.hand === hand && k.finger === finger && !k.inner);
      if (!candidates.length) continue;
      const best = candidates.reduce((a, b) => (Math.abs(centerX(board, b)) < Math.abs(centerX(board, a)) ? b : a));
      pads.push({ hand, finger, pos: best.pos, at: 0.5 });
    }
  }
  return pads;
}

/** Tasti dei pollici: i sei di clavis, lo spazio sulla classica. */
export function thumbKeys(board: Board): BoardKey[] {
  if (board.keyboard === 'clavis') return board.keys.filter((k) => k.present && k.finger === 'thumb');
  return board.keys.filter((k) => board.actions.BASE?.[k.pos]?.code === 'Space');
}

/** Polpastrelli dei pollici a riposo: tasto centrale dei tre su clavis, le due metà dello spazio sulla classica. */
export function thumbPads(board: Board): Pad[] {
  if (board.keyboard === 'clavis') {
    return (['L', 'R'] as Hand[]).flatMap((hand) => {
      const keys = thumbKeys(board).filter((k) => k.hand === hand).sort((a, b) => a.x - b.x);
      return keys.length ? [{ hand, finger: 'thumb' as Finger, pos: keys[Math.floor(keys.length / 2)].pos, at: 0.5 }] : [];
    });
  }
  const space = thumbKeys(board)[0];
  if (!space) return [];
  return [
    { hand: 'L', finger: 'thumb', pos: space.pos, at: 0.3 },
    { hand: 'R', finger: 'thumb', pos: space.pos, at: 0.7 },
  ];
}

/** Tasti con il rilievo (F e J come keycode fisici; solo tastiera classica). */
export function bumpKeys(board: Board): number[] {
  if (board.keyboard === 'clavis') return [];
  return board.keys.filter((k) => ['KeyF', 'KeyJ'].includes(board.actions.BASE?.[k.pos]?.code ?? '')).map((k) => k.pos);
}

/** Tasto che dà Shift alla mano `hand`: home row mod (clavis) o tasto Shift (classica). */
export function shiftKey(board: Board, hand: Hand): number | null {
  const k = board.keys.find((k) => k.present && k.hand === hand && board.actions.BASE?.[k.pos]?.holdMod === 'shift');
  return k?.pos ?? null;
}

/** Pollice che attiva un layer tenendolo premuto (clavis). */
export function layerKey(board: Board, layer: LayerName): number | null {
  const k = board.keys.find((k) => k.present && board.actions.BASE?.[k.pos]?.holdLayer === layer);
  return k?.pos ?? null;
}

/** Tasti con un modificatore sulla riga centrale (home row mod di clavis). */
export function homeRowMods(board: Board): number[] {
  const row = homeRow(board);
  return board.keys.filter((k) => k.present && k.row === row && board.actions.BASE?.[k.pos]?.holdMod).map((k) => k.pos);
}

/** Identificativo di un dito: `L-index`, `R-thumb`… */
export const fingerKey = (hand: Hand, finger: Finger) => `${hand}-${finger}`;

/** Ordine in cui il passo delle zone mostra le dita: dal mignolo sinistro al mignolo destro. */
export const FINGER_CYCLE: { hand: Hand; finger: Finger }[] = [
  ...FINGERS.map((finger) => ({ hand: 'L' as Hand, finger })),
  ...[...FINGERS].reverse().map((finger) => ({ hand: 'R' as Hand, finger })),
];

// --- passi ---------------------------------------------------------------------------

export type StepId = 'welcome' | 'halves' | 'home' | 'columns' | 'thumbs' | 'hold' | 'ready' | 'bumps' | 'zones';

export interface GuideStep {
  id: StepId;
  /** Polpastrelli disegnati: nessuno, le otto dita sulla posizione base, anche i pollici. */
  pads: 'none' | 'home' | 'all';
  /** Colori dei tasti: nessuno, per mano, un dito alla volta, tutte le dita. */
  zones: 'none' | 'hands' | 'cycle' | 'all';
  /** Tasti in evidenza. */
  highlight: 'none' | 'home' | 'bumps' | 'thumbs' | 'hold';
  /** Sequenza animata del passo. */
  demo?: 'hold' | 'shift';
}

export const GUIDE_STEPS: Record<GuideKind, GuideStep[]> = {
  clavis: [
    { id: 'welcome', pads: 'all', zones: 'none', highlight: 'none' },
    { id: 'halves', pads: 'none', zones: 'hands', highlight: 'none' },
    { id: 'home', pads: 'home', zones: 'none', highlight: 'home' },
    { id: 'columns', pads: 'home', zones: 'cycle', highlight: 'none' },
    { id: 'thumbs', pads: 'all', zones: 'none', highlight: 'thumbs' },
    { id: 'hold', pads: 'all', zones: 'none', highlight: 'hold', demo: 'hold' },
    { id: 'ready', pads: 'all', zones: 'all', highlight: 'none' },
  ],
  classic: [
    { id: 'welcome', pads: 'all', zones: 'none', highlight: 'none' },
    { id: 'bumps', pads: 'none', zones: 'none', highlight: 'bumps' },
    { id: 'home', pads: 'home', zones: 'none', highlight: 'home' },
    { id: 'zones', pads: 'home', zones: 'cycle', highlight: 'none' },
    { id: 'thumbs', pads: 'all', zones: 'none', highlight: 'thumbs', demo: 'shift' },
    { id: 'ready', pads: 'all', zones: 'all', highlight: 'none' },
  ],
};

/** Tasti da evidenziare in un passo (oltre a quelli della demo). */
export function highlightedKeys(board: Board, step: GuideStep): number[] {
  switch (step.highlight) {
    case 'home':
      return homePads(board).map((p) => p.pos);
    case 'bumps':
      return bumpKeys(board);
    case 'thumbs':
      return thumbKeys(board).map((k) => k.pos);
    case 'hold':
      return [...homeRowMods(board), ...(['NUM', 'SYM'] as LayerName[]).map((l) => layerKey(board, l)).filter((p): p is number => p !== null)];
    default:
      return [];
  }
}

/** Un fotogramma di una demo: layer disegnato, tasti tenuti e battuto, polpastrelli spostati. */
export interface DemoFrame {
  layer: LayerName;
  holds: number[];
  tap: number | null;
  /** Polpastrelli spostati su un altro tasto (gli altri restano a riposo). */
  moves: Pad[];
  /** Chiave del testo che accompagna il fotogramma. */
  caption: 'shift' | 'num' | 'sym' | 'rest';
}

/**
 * Fotogrammi della demo di un passo: il primo è il riposo, il secondo il più
 * significativo (l'unico mostrato quando il sistema chiede di ridurre il movimento).
 */
export function demoFrames(board: Board, step: GuideStep): DemoFrame[] {
  const pads = homePads(board);
  const leftIndex = pads.find((p) => p.hand === 'L' && p.finger === 'index') ?? null;
  const rest: DemoFrame = { layer: 'BASE', holds: [], tap: null, moves: [], caption: 'rest' };
  const shiftR = shiftKey(board, 'R');
  const capital: DemoFrame | null =
    shiftR !== null && leftIndex
      ? {
          layer: 'BASE',
          holds: [shiftR],
          tap: leftIndex.pos,
          // sulla classica il mignolo destro va sullo Shift; su clavis il dito resta dov'è
          moves: board.keyboard === 'clavis' ? [] : [{ hand: 'R', finger: 'pinky', pos: shiftR, at: 0.35 }],
          caption: 'shift',
        }
      : null;
  if (step.demo === 'shift') return capital ? [rest, capital] : [];
  if (step.demo === 'hold') {
    const frames: DemoFrame[] = [rest];
    if (capital) frames.push(capital);
    for (const layer of ['NUM', 'SYM'] as LayerName[]) {
      const key = layerKey(board, layer);
      if (key === null) continue;
      const k = board.keys[key];
      frames.push({ layer, holds: [key], tap: null, moves: [{ hand: k.hand, finger: 'thumb', pos: key, at: 0.5 }], caption: layer === 'NUM' ? 'num' : 'sym' });
    }
    return frames;
  }
  return [];
}
