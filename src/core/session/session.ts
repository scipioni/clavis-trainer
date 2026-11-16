import { DECOMPOSE, isDeadKey } from '../keyboard/deadKeys';

/** Eventi astratti: la UI li ricava da `keydown`/`input`, i test li simulano. */
export type SessionEvent =
  | { type: 'char'; data: string; t: number }
  | { type: 'dead'; t: number }
  | { type: 'mod'; mod: 'ctrl' | 'alt' | 'gui'; key: string; t: number }
  | { type: 'blur'; t: number }
  | { type: 'tick'; t: number }
  | { type: 'abort'; t: number };

export type SessionStatus = 'ready' | 'running' | 'paused' | 'finished' | 'aborted';

export interface Sample {
  /** Posizione nel testo. */
  i: number;
  /** Carattere atteso. */
  char: string;
  /** Carattere precedente nel testo, null per il primo. */
  prev: string | null;
  /** ms dal completamento corretto del precedente; null per il primo e dopo una pausa. */
  ms: number | null;
  /** Errori fatti prima di battere il carattere giusto. */
  errors: number;
  /** Caratteri ottenuti per sbaglio. */
  wrong: string[];
  /** Quanti errori sono dovuti ai tasti morti. */
  deadErrors: number;
  /** Attivazioni involontarie di Ctrl/Alt/Meta su questo carattere. */
  modMisfires: number;
}

export interface SessionOptions {
  /** Durata in ms di tempo attivo; null = fino alla fine del testo. */
  durationMs: number | null;
  /** Oltre questo intervallo senza digitare la sessione va in pausa. */
  idleMs: number;
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = { durationMs: null, idleMs: 5000 };

/** Errore legato ai tasti morti: composizione indesiderata, accento sbagliato o dimenticato. */
export function isDeadKeyError(expected: string, obtained: string): boolean {
  const expDec = DECOMPOSE[expected];
  const obtDec = DECOMPOSE[obtained];
  if (isDeadKey(expected)) return obtDec?.[0] === expected || obtained === expected;
  if (expDec) return obtDec !== undefined || isDeadKey(obtained) || obtained === expDec[1];
  return false;
}

export class TypingSession {
  readonly chars: string[];
  readonly options: SessionOptions;
  status: SessionStatus = 'ready';
  index = 0;
  readonly samples: Sample[] = [];
  /** Tempo attivo accumulato (pause escluse). */
  activeMs = 0;
  startedAt: number | null = null;
  /** Ultimo carattere sbagliato sul cursore (per la UI), null se nessuno. */
  currentWrong: string | null = null;
  /** È stato premuto un tasto morto e si attende la composizione. */
  pendingDead = false;

  private lastActivity = 0;
  private lastCorrect = 0;
  private resumed = false;
  private cur: Omit<Sample, 'ms' | 'i' | 'char' | 'prev'> = this.fresh();

  constructor(text: string, options: Partial<SessionOptions> = {}) {
    this.chars = Array.from(text);
    this.options = { ...DEFAULT_SESSION_OPTIONS, ...options };
    if (this.chars.length === 0) throw new Error('testo vuoto');
  }

  private fresh() {
    return { errors: 0, wrong: [] as string[], deadErrors: 0, modMisfires: 0 };
  }

  get expected(): string | null {
    return this.chars[this.index] ?? null;
  }

  get done(): boolean {
    return this.status === 'finished' || this.status === 'aborted';
  }

  /** Tempo attivo trascorso fino a `t`, compreso l'intervallo in corso se non è una pausa. */
  elapsedAt(t: number): number {
    if (this.status !== 'running') return this.activeMs;
    const gap = t - this.lastActivity;
    return this.activeMs + (gap <= this.options.idleMs ? gap : 0);
  }

  remainingAt(t: number): number | null {
    const d = this.options.durationMs;
    return d === null ? null : Math.max(0, d - this.elapsedAt(t));
  }

  handle(ev: SessionEvent): void {
    if (this.done) return;
    switch (ev.type) {
      case 'abort':
        this.status = 'aborted';
        return;
      case 'blur':
        if (this.status === 'running') {
          this.account(ev.t);
          this.status = 'paused';
        }
        return;
      case 'tick':
        if (this.status === 'running') {
          if (this.checkExpired(ev.t)) return;
          if (ev.t - this.lastActivity > this.options.idleMs) this.status = 'paused';
        }
        return;
      case 'dead':
        if (this.status === 'ready') return; // il cronometro parte col primo carattere
        this.activity(ev.t);
        this.pendingDead = true;
        return;
      case 'mod':
        if (this.status === 'ready') return;
        this.activity(ev.t);
        this.cur.modMisfires++;
        return;
      case 'char':
        this.onChar(ev.data, ev.t);
        return;
    }
  }

  private checkExpired(t: number): boolean {
    const d = this.options.durationMs;
    if (d !== null && this.elapsedAt(t) >= d) {
      this.activeMs = d;
      this.status = 'finished';
      return true;
    }
    return false;
  }

  /** Aggiunge al tempo attivo l'intervallo dall'ultima attività, se non è una pausa. */
  private account(t: number) {
    const gap = t - this.lastActivity;
    if (gap <= this.options.idleMs) this.activeMs += gap;
    else this.resumed = true;
    this.lastActivity = t;
  }

  private activity(t: number) {
    if (this.status === 'paused') {
      this.status = 'running';
      this.resumed = true;
      this.lastActivity = t;
      return;
    }
    this.account(t);
  }

  private onChar(data: string, t: number) {
    this.pendingDead = false;
    if (this.status === 'ready') {
      this.status = 'running';
      this.startedAt = t;
      this.lastActivity = t;
      this.lastCorrect = t;
    } else {
      this.activity(t);
      if (this.checkExpired(t)) return; // carattere arrivato dopo lo scadere
    }
    const expected = this.chars[this.index];
    if (data !== expected) {
      this.cur.errors++;
      this.cur.wrong.push(data);
      if (isDeadKeyError(expected, data)) this.cur.deadErrors++;
      this.currentWrong = data;
      return;
    }
    const first = this.index === 0;
    this.samples.push({
      i: this.index,
      char: expected,
      prev: first ? null : this.chars[this.index - 1],
      ms: first || this.resumed ? null : t - this.lastCorrect,
      ...this.cur,
    });
    this.cur = this.fresh();
    this.resumed = false;
    this.currentWrong = null;
    this.lastCorrect = t;
    this.index++;
    if (this.index >= this.chars.length) this.status = 'finished';
  }
}
