import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

export async function runMigrations(url: string) {
  const { db, pool } = createDb(url);
  const here = path.dirname(fileURLToPath(import.meta.url));
  // funciona tanto em src/db (tsx) quanto em dist (build)
  const candidates = [path.resolve(here, '../../migrations'), path.resolve(here, '../migrations')];
  const { existsSync } = await import('node:fs');
  const folder = candidates.find((c) => existsSync(path.join(c, 'meta')));
  if (!folder) throw new Error('Pasta de migrations não encontrada');
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido');
  runMigrations(url)
    .then(() => console.log('Migrations aplicadas.'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
