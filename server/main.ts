// Server di clavis-trainer: sito statico, API e bot di accesso Telegram.
//
// Variabili d'ambiente:
//   PORT                 porta HTTP (8080)
//   DATA_DIR             cartella del database (./data)
//   STATIC_DIR           file del sito (./dist); vuota = solo API
//   PUBLIC_URL           URL pubblico (http://localhost:5173)
//   EXTRA_ORIGINS        altre origini ammesse, separate da virgola
//   TELEGRAM_BOT_TOKEN   token del bot; senza, il login non compare
//   TELEGRAM_FAKE=1      bot finto + /api/test/telegram (solo test e2e)
//   COOKIE_SECURE=0      cookie senza Secure (solo sviluppo su http)
import { mkdirSync } from 'node:fs';
import { ServerDB } from './db';
import { LoginBot } from './bot';
import { createApp } from './app';
import { FakeTelegramApi, HttpTelegramApi } from './telegram';

const env = process.env;
const port = Number(env.PORT ?? 8080);
const dataDir = env.DATA_DIR ?? './data';
const publicUrl = env.PUBLIC_URL ?? 'http://localhost:5173';
const staticDir = env.STATIC_DIR === '' ? null : (env.STATIC_DIR ?? './dist');
const fake = env.TELEGRAM_FAKE === '1';
const token = env.TELEGRAM_BOT_TOKEN?.trim();

mkdirSync(dataDir, { recursive: true });
const db = new ServerDB(`${dataDir}/clavis.db`);

let bot: LoginBot | null = null;
if (fake || token) {
  const api = fake ? new FakeTelegramApi() : new HttpTelegramApi(token!);
  const candidate = new LoginBot(api, db, { publicUrl });
  if (await candidate.init()) {
    bot = candidate;
    if (!fake) {
      void bot.present();
      void bot.run();
    }
  }
} else {
  console.log('[bot] TELEGRAM_BOT_TOKEN assente: accesso con Telegram disattivato');
}

const app = createApp({
  db,
  bot,
  publicUrl,
  extraOrigins: (env.EXTRA_ORIGINS ?? '').split(',').filter(Boolean),
  staticDir,
  secureCookie: env.COOKIE_SECURE !== '0',
  testHooks: fake,
});

const server = Bun.serve({
  port,
  maxRequestBodySize: 9 * 1024 * 1024,
  fetch: (req, srv) => app.fetch(req, srv.requestIP(req)?.address),
});

const cleanup = setInterval(() => {
  const r = db.cleanup(Date.now());
  if (r.logins || r.auth) console.log(`[db] pulizia: ${r.logins} richieste, ${r.auth} sessioni`);
}, 3600_000);

console.log(`clavis-trainer in ascolto su :${server.port} (${publicUrl}), dati in ${dataDir}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    clearInterval(cleanup);
    bot?.stop();
    server.stop();
    db.close();
    process.exit(0);
  });
}
