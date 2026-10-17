import { loadConfig } from './config';
import { createDb } from './db/client';
import { buildApp } from './app';

const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
const app = await buildApp({ config, db });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'encerrando');
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.port, host: process.env.API_HOST ?? '127.0.0.1' });
