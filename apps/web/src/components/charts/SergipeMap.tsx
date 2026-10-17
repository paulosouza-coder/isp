import { useMemo, useState } from 'react';
import map from '../../assets/sergipe.json';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mapa de calor dos municípios de Sergipe (malha IBGE). Cor proporcional aos leads do período. */
export function SergipeMap({ data }: { data: { city: string; n: number }[] }) {
  const [hover, setHover] = useState<{ name: string; n: number } | null>(null);
  const byCity = useMemo(() => new Map(data.map((d) => [norm(d.city), d.n])), [data]);
  const max = Math.max(1, ...data.map((d) => d.n));
  const color = (n: number) => {
    if (!n) return '#DCE7FB';
    const t = Math.sqrt(n / max);
    const from = [176, 202, 247], to = [12, 46, 168];
    const c = from.map((f, i) => Math.round(f + (to[i]! - f) * t));
    return `rgb(${c.join(',')})`;
  };
  return (
    <div className="relative">
      <svg viewBox={`-4 -4 ${map.width + 8} ${map.height + 8}`} className="h-[150px] w-auto" role="img" aria-label="Mapa de calor de leads por município de Sergipe">
        {map.municipalities.map((m) => {
          const n = byCity.get(norm(m.name)) ?? 0;
          return (
            <path
              key={m.id}
              d={m.d}
              fill={color(n)}
              stroke="#fff"
              strokeWidth="0.8"
              onMouseEnter={() => setHover({ name: m.name, n })}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${m.name}: ${n} lead(s)`}</title>
            </path>
          );
        })}
      </svg>
      {hover && <p className="absolute bottom-0 left-0 rounded-sm bg-surface/95 px-2 py-0.5 text-xs text-text shadow-card">{hover.name}: {hover.n}</p>}
    </div>
  );
}
