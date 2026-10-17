/** Apaga e recria o schema público, aplica migrations e seed. SOMENTE desenvolvimento. */
import pg from 'pg';
import { runMigrations } from './migrate';
import { seed } from './seed';

export async function resetDatabase(url: string, opts: { seed?: boolean } = { seed: true }) {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset bloqueado em produção');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await client.end();
  await runMigrations(url);
  if (opts.seed) await seed(url);
}

const isMain = process.argv[1]?.endsWith('reset.ts') || process.argv[1]?.endsWith('reset.js');
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido');
  resetDatabase(url)
    .then(() => console.log('Banco recriado com seed fictícia.'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
