/** Utilitários de indicadores. Nunca fabricam número: sem base, retornam null (exibido como N/D). */

/** Variação percentual com denominador explícito; base zero → null. */
export function pctDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Limites de período em datas locais (AAAA-MM-DD) → intervalo [from, to+1) no fuso da empresa (SQL). */
export function previousPeriod(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  const pf = new Date(f.getTime() - days * 86_400_000);
  const pt = new Date(f.getTime() - 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(pf), to: iso(pt), days };
}
