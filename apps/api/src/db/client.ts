import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/** Transação no mesmo tipo do db (Drizzle) — usado pelos serviços. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type DbOrTx = DB | Tx;
