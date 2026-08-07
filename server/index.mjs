import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { qodercliAuth, query } from '@qoder-ai/qoder-agent-sdk';
import { createDistiller } from './chat/distiller.mjs';
import { createChatSessionManager } from './chat/session-manager.mjs';
import { openDatabase } from './db/database.mjs';
import { applyMigrations } from './db/migrate.mjs';
import { createHandler } from './http/handler.mjs';

function startDashboard() {
  const dataDir = resolve(process.env.DATA_DIR ?? 'data');
  const db = openDatabase(resolve(dataDir, 'dashboard.sqlite3'));
  applyMigrations(db, resolve('server/db/migrations'));

  const queryFn = ({ prompt, options }) => query({
    prompt,
    options: { ...options, auth: qodercliAuth() },
  });
  const chatManager = createChatSessionManager({
    db,
    projectRoot: resolve('.'),
    queryFn,
  });
  const distiller = createDistiller({
    db,
    projectRoot: resolve('.'),
    queryFn,
  });

  const port = Number.parseInt(process.env.PORT ?? '3015', 10);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createServer(createHandler({
    db,
    publicDir: resolve('dist'),
    chatManager,
    distiller,
  }));
  server.listen(port, host, () => console.log(`Dashboard: http://${host}:${port}`));

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(async () => {
        await chatManager.closeAll();
        db.close();
        process.exit(0);
      });
    });
  }
}

startDashboard();
