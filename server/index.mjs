import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { openDatabase } from './db/database.mjs';
import { applyMigrations } from './db/migrate.mjs';
import { createHandler } from './http/handler.mjs';

function startDashboard() {
  const dataDir = resolve(process.env.DATA_DIR ?? 'data');
  const db = openDatabase(resolve(dataDir, 'dashboard.sqlite3'));
  applyMigrations(db, resolve('server/db/migrations'));

  const port = Number.parseInt(process.env.PORT ?? '3015', 10);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createServer(createHandler({ db, publicDir: resolve('dist') }));
  server.listen(port, host, () => console.log(`Dashboard: http://${host}:${port}`));

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
  }
}

startDashboard();
