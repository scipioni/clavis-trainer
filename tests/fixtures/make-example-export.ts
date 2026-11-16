// Genera tests/fixtures/example-export.json: 10 giorni di sessioni simulate
// in cui il bigramma "gl" è lento. Uso: bun tests/fixtures/make-example-export.ts
import { writeFileSync } from 'node:fs';
import { TypingSession } from '../../src/core/session/session';
import { computeResult } from '../../src/core/session/result';
import { DEFAULT_SETTINGS, EXPORT_FORMAT, EXPORT_VERSION, type ExportData, type StoredSession } from '../../src/storage/db';
import { seededRng } from '../../src/core/exercise/random';

const TEXT = 'gli figli meglio voglio sveglia famiglia che con per non una sono questo della';
const rng = seededRng(42);
const start = new Date(2026, 10, 1, 18, 0).getTime();
const sessions: StoredSession[] = [];

for (let day = 0; day < 10; day++) {
  for (let k = 0; k < 2; k++) {
    const s = new TypingSession(TEXT);
    let t = 0;
    const chars = s.chars;
    chars.forEach((c, i) => {
      const prev = chars[i - 1];
      // si migliora un po' ogni giorno; "gl" resta lento
      let ms = 190 - day * 4 + rng() * 40;
      if (prev === 'g' && c === 'l') ms = 480 + rng() * 60;
      if (c === 'q') s.handle({ type: 'char', data: 'w', t: t + ms / 2 });
      s.handle({ type: 'char', data: c, t: (t += ms) });
    });
    sessions.push({
      id: `example-${day}-${k}`,
      startedAt: start + day * 86_400_000 + k * 3_600_000,
      mode: 'adaptive',
      durationMs: null,
      status: 'completed',
      deadKeys: true,
      samples: s.samples,
      result: computeResult(s.samples, s.activeMs),
    });
  }
}

const data: ExportData = {
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  exportedAt: new Date(start + 10 * 86_400_000).toISOString(),
  sessions,
  settings: DEFAULT_SETTINGS,
};
writeFileSync(new URL('./example-export.json', import.meta.url), JSON.stringify(data));
console.log(`${sessions.length} sessioni`);
