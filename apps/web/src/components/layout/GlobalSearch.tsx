import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { useAuth } from '../../auth/AuthProvider';
import type { Lead, Opportunity, Paged } from '../../lib/types';

type Result = { id: string; label: string; sub: string; to: string; group: string };

export const GlobalSearch = forwardRef<{ focus: () => void }>(function GlobalSearch(_, ref) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { can } = useAuth();
  const dq = useDebounced(q.trim(), 250);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', dq],
    enabled: dq.length >= 2,
    queryFn: async ({ signal }) => {
      const [contacts, leads, opps] = await Promise.all([
        can('clientes') ? api<{ items: { id: string; name: string; phone: string | null }[] }>(`/contacts${qs({ q: dq })}`, { signal }) : null,
        can('leads') ? api<Paged<Lead>>(`/leads${qs({ q: dq, pageSize: 4 })}`, { signal }) : null,
        can('oportunidades') ? api<Paged<Opportunity>>(`/opportunities${qs({ q: dq, pageSize: 4, status: 'todas' })}`, { signal }) : null,
      ]);
      const r: Result[] = [];
      contacts?.items.slice(0, 4).forEach((c) => r.push({ id: c.id, label: c.name, sub: c.phone ?? '', to: `/customers/${c.id}`, group: 'Clientes' }));
      leads?.items.forEach((l) => r.push({ id: l.id, label: l.name, sub: l.sourceName ?? '', to: `/leads?q=${encodeURIComponent(l.name)}`, group: 'Leads' }));
      opps?.items.forEach((o) => r.push({ id: o.id, label: o.contactName, sub: `OP-${o.code} · ${o.planName ?? o.title}`, to: `/opportunities/${o.id}`, group: 'Oportunidades' }));
      return r;
    },
  });
  const results = dq.length >= 2 ? data ?? [] : [];
  useEffect(() => setActive(0), [dq]);
  const go = (r: Result) => { setOpen(false); setQ(''); nav(r.to); };

  return (
    <div className="relative w-full max-w-[600px]">
      <label htmlFor="global-search" className="sr-only">Buscar clientes, leads, oportunidades</label>
      <Search className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-ink" aria-hidden />
      <input
        ref={input}
        id="global-search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-list"
        aria-activedescendant={results[active] ? `gs-${results[active]!.id}` : undefined}
        autoComplete="off"
        placeholder="Buscar clientes, leads, oportunidades..."
        className="h-11 w-full rounded-md border border-transparent bg-[#EDF1F8] pl-12 pr-3 text-base text-text placeholder:text-muted focus:border-primary/40 focus:bg-surface"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active]!);
          if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
        }}
      />
      {open && dq.length >= 2 && (
        <ul id="global-search-list" role="listbox" className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-overlay">
          {isFetching && !results.length && <li className="px-3 py-2 text-sm text-muted">Buscando…</li>}
          {!isFetching && !results.length && <li className="px-3 py-2 text-sm text-muted">Nada encontrado para “{dq}”.</li>}
          {results.map((r, i) => (
            <li key={r.group + r.id}>
              {(i === 0 || results[i - 1]!.group !== r.group) && <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">{r.group}</p>}
              <div id={`gs-${r.id}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); go(r); }} onMouseEnter={() => setActive(i)} className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-primary-soft' : ''}`}>
                <p className="text-sm font-semibold text-ink">{r.label}</p>
                {r.sub && <p className="text-xs text-muted">{r.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
