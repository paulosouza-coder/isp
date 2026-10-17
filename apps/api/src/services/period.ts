import { sql, type SQL } from 'drizzle-orm';
import type { AuthContext } from '../http/context';
import { previousPeriod } from './metrics';

/** Converte um período de datas locais (fuso da empresa) em limites timestamptz [início, fim). */
export function periodBounds(auth: AuthContext, from: string, to: string) {
  const tz = auth.timezone;
  const prev = previousPeriod(from, to);
  const start = (d: string) => sql`((${d}::date)::timestamp at time zone ${tz})`;
  const end = (d: string) => sql`(((${d}::date) + 1)::timestamp at time zone ${tz})`;
  return {
    from: start(from),
    to: end(to),
    prevFrom: start(prev.from),
    prevTo: end(prev.to),
    days: prev.days,
    label: { from, to, previous: { from: prev.from, to: prev.to } },
    inCur: (col: SQL | unknown) => sql`${col} >= ${start(from)} and ${col} < ${end(to)}`,
    inPrev: (col: SQL | unknown) => sql`${col} >= ${start(prev.from)} and ${col} < ${end(prev.to)}`,
  };
}

/** Meses (AAAA-MM) terminando no mês de `to`, para séries de evolução. */
export function monthsEnding(to: string, count: number) {
  const [y, m] = to.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
