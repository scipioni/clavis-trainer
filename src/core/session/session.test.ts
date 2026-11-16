import { describe, expect, test } from 'vitest';
import { TypingSession, isDeadKeyError } from './session';
import { computeResult, wpm } from './result';

/** Digita `text` a passo costante partendo da t0. */
function typeAll(s: TypingSession, text: string, t0: number, step: number): number {
  let t = t0;
  for (const c of text) {
    s.handle({ type: 'char', data: c, t });
    t += step;
  }
  return t - step;
}

describe('avanzamento e tempi', () => {
  test('il cronometro parte al primo carattere', () => {
    const s = new TypingSession('ciao');
    expect(s.status).toBe('ready');
    s.handle({ type: 'tick', t: 10_000 });
    expect(s.status).toBe('ready');
    s.handle({ type: 'char', data: 'c', t: 12_000 });
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(12_000);
  });

  test('ci con 180 ms tra c e i', () => {
    const s = new TypingSession('ci');
    s.handle({ type: 'char', data: 'c', t: 1000 });
    s.handle({ type: 'char', data: 'i', t: 1180 });
    expect(s.samples[0]).toMatchObject({ char: 'c', ms: null, prev: null });
    expect(s.samples[1]).toMatchObject({ char: 'i', ms: 180, errors: 0, prev: 'c' });
    expect(s.status).toBe('finished');
  });

  test('carattere sbagliato: il cursore resta, errore registrato; poi correzione', () => {
    const s = new TypingSession('le');
    s.handle({ type: 'char', data: 'l', t: 0 });
    s.handle({ type: 'char', data: 'r', t: 100 });
    expect(s.index).toBe(1);
    expect(s.currentWrong).toBe('r');
    s.handle({ type: 'char', data: 'e', t: 250 });
    expect(s.samples[1]).toMatchObject({ char: 'e', errors: 1, wrong: ['r'], ms: 250 });
    expect(s.currentWrong).toBeNull();
  });
});

describe('tasti morti e mod', () => {
  test('è composta: nessun errore per il tasto morto', () => {
    const s = new TypingSession('fè');
    s.handle({ type: 'char', data: 'f', t: 0 });
    s.handle({ type: 'dead', t: 100 });
    expect(s.pendingDead).toBe(true);
    s.handle({ type: 'char', data: 'è', t: 220 });
    expect(s.samples[1]).toMatchObject({ char: 'è', errors: 0, deadErrors: 0, ms: 220 });
  });

  test("apostrofo composto per sbaglio in l'acqua", () => {
    const s = new TypingSession("l'acqua");
    s.handle({ type: 'char', data: 'l', t: 0 });
    s.handle({ type: 'dead', t: 100 });
    s.handle({ type: 'char', data: 'á', t: 200 });
    expect(s.index).toBe(1);
    s.handle({ type: 'dead', t: 300 });
    s.handle({ type: 'char', data: "'", t: 400 });
    expect(s.samples[1]).toMatchObject({ char: "'", errors: 1, wrong: ['á'], deadErrors: 1 });
  });

  test('classificazione degli errori da tasto morto', () => {
    expect(isDeadKeyError("'", 'á')).toBe(true);
    expect(isDeadKeyError('è', 'é')).toBe(true);
    expect(isDeadKeyError('è', 'e')).toBe(true);
    expect(isDeadKeyError('e', 'r')).toBe(false);
  });

  test('Ctrl involontario su t: registrato, il cursore non avanza', () => {
    const s = new TypingSession('st');
    s.handle({ type: 'char', data: 's', t: 0 });
    s.handle({ type: 'mod', mod: 'ctrl', key: 't', t: 80 });
    expect(s.index).toBe(1);
    s.handle({ type: 'char', data: 't', t: 300 });
    expect(s.samples[1]).toMatchObject({ char: 't', modMisfires: 1, errors: 0 });
  });
});

describe('pause, durata, abbandono', () => {
  test('pausa per inattività: il gap non conta e il carattere dopo non ha tempo', () => {
    const s = new TypingSession('abcd');
    s.handle({ type: 'char', data: 'a', t: 0 });
    s.handle({ type: 'char', data: 'b', t: 200 });
    s.handle({ type: 'tick', t: 6000 });
    expect(s.status).toBe('paused');
    s.handle({ type: 'char', data: 'c', t: 8200 });
    s.handle({ type: 'char', data: 'd', t: 8400 });
    expect(s.samples[2].ms).toBeNull();
    expect(s.samples[3].ms).toBe(200);
    expect(s.activeMs).toBe(400);
  });

  test('pausa anche senza tick, se il gap supera la soglia', () => {
    const s = new TypingSession('abc');
    s.handle({ type: 'char', data: 'a', t: 0 });
    s.handle({ type: 'char', data: 'b', t: 9000 });
    expect(s.samples[1].ms).toBeNull();
    expect(s.activeMs).toBe(0);
  });

  test('perdita del focus mette in pausa', () => {
    const s = new TypingSession('abc');
    s.handle({ type: 'char', data: 'a', t: 0 });
    s.handle({ type: 'blur', t: 100 });
    expect(s.status).toBe('paused');
    s.handle({ type: 'char', data: 'b', t: 3000 });
    expect(s.samples[1].ms).toBeNull();
    expect(s.activeMs).toBe(100);
  });

  test('scadenza del tempo a 60 secondi', () => {
    const s = new TypingSession('a'.repeat(1000), { durationMs: 60_000 });
    typeAll(s, 'a'.repeat(250), 0, 200); // 49,8 s
    expect(s.status).toBe('running');
    s.handle({ type: 'tick', t: 50_000 });
    expect(s.status).toBe('running');
    // un carattere ogni 200 ms fino a oltre 60 s
    typeAll(s, 'a'.repeat(100), 50_000, 200);
    expect(s.status).toBe('finished');
    expect(s.activeMs).toBe(60_000);
    expect(s.samples.length).toBe(300); // il carattere a 60 s esatti è fuori tempo
  });

  test('scadenza segnalata dal tick', () => {
    const s = new TypingSession('abc', { durationMs: 1000 });
    s.handle({ type: 'char', data: 'a', t: 0 });
    for (let t = 500; t <= 1500; t += 500) s.handle({ type: 'tick', t });
    // il tick a 1000 ms è oltre la soglia di inattività? no: 1000 < 5000, quindi scade
    expect(s.status).toBe('finished');
  });

  test('abbandono', () => {
    const s = new TypingSession('abc');
    s.handle({ type: 'char', data: 'a', t: 0 });
    s.handle({ type: 'abort', t: 10 });
    expect(s.status).toBe('aborted');
    s.handle({ type: 'char', data: 'b', t: 20 });
    expect(s.index).toBe(1);
  });
});

describe('risultato', () => {
  test('300 caratteri in 60 secondi netti = 60 WPM', () => {
    expect(wpm(300, 60_000)).toBe(60);
    const s = new TypingSession('a'.repeat(400), { durationMs: 60_000 });
    typeAll(s, 'a'.repeat(301), 0, 200); // il 301° arriva a 60 s esatti e chiude
    const r = computeResult(s.samples, s.activeMs);
    expect(s.status).toBe('finished');
    expect(r.chars).toBe(300);
    expect(r.wpm).toBe(60);
  });

  test('190 corretti al primo tentativo su 200 = 95%', () => {
    const text = 'x'.repeat(200);
    const s = new TypingSession(text);
    let t = 0;
    for (let i = 0; i < 200; i++) {
      if (i < 10) s.handle({ type: 'char', data: 'y', t: (t += 50) });
      s.handle({ type: 'char', data: 'x', t: (t += 100) });
    }
    const r = computeResult(s.samples, s.activeMs);
    expect(r.accuracy).toBeCloseTo(0.95);
    expect(r.errors).toBe(10);
  });

  test('caratteri e bigrammi più lenti', () => {
    const s = new TypingSession('abab gb gb');
    let t = 0;
    for (const c of s.chars) s.handle({ type: 'char', data: c, t: (t += c === 'b' && t > 0 ? 400 : 100) });
    const r = computeResult(s.samples, s.activeMs);
    expect(r.slowestChars[0].key).toBe('b');
    expect(['ab', 'gb']).toContain(r.slowestBigrams[0].key);
  });
});
