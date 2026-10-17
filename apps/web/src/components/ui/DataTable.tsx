import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { Button } from './primitives';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortKey?: string;
  className?: string;
  /** Coluna fixa (não pode ser ocultada). */
  locked?: boolean;
  /** Oculta por padrão. */
  hidden?: boolean;
  align?: 'left' | 'right';
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  getId: (r: T) => string;
  caption: string;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  onRowClick?: (r: T) => void;
  page?: { page: number; pageSize: number; total: number; onPage: (p: number) => void };
  storageKey?: string;
  /** Renderização alternativa em cartões para telas estreitas. */
  mobileCard?: (r: T) => ReactNode;
};

function readHidden(key: string | undefined, cols: Column<unknown>[]) {
  if (key) {
    try {
      const raw = localStorage.getItem(`cols:${key}`);
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch { /* storage indisponível */ }
  }
  return new Set(cols.filter((c) => c.hidden).map((c) => c.key));
}

export function DataTable<T>({ rows, columns, getId, caption, sort, onSort, selectable, selected, onSelectedChange, onRowClick, page, storageKey, mobileCard }: Props<T>) {
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(storageKey, columns as Column<unknown>[]));
  const [colMenu, setColMenu] = useState(false);
  const visible = columns.filter((c) => !hidden.has(c.key));
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected?.has(getId(r)));

  const toggleCol = (k: string) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setHidden(next);
    if (storageKey) {
      try { localStorage.setItem(`cols:${storageKey}`, JSON.stringify([...next])); } catch { /* ignora */ }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end border-b border-line px-3 py-1.5">
        <div className="relative">
          <Button size="sm" variant="ghost" icon={<Columns3 className="h-4 w-4" />} aria-expanded={colMenu} onClick={() => setColMenu((v) => !v)}>Colunas</Button>
          {colMenu && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-line bg-raised p-2 shadow-overlay" onMouseLeave={() => setColMenu(false)}>
              {columns.filter((c) => !c.locked).map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-sunken">
                  <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {mobileCard && (
        <ul className="divide-y divide-line md:hidden">
          {rows.map((r) => (
            <li key={getId(r)}>
              <button className="w-full px-4 py-3 text-left hover:bg-sunken" onClick={() => onRowClick?.(r)}>{mobileCard(r)}</button>
            </li>
          ))}
        </ul>
      )}

      <div className={clsx('overflow-x-auto', mobileCard && 'hidden md:block')}>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-sunken/60">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos desta página"
                    checked={!!allSelected}
                    onChange={() => {
                      const next = new Set(selected);
                      rows.forEach((r) => (allSelected ? next.delete(getId(r)) : next.add(getId(r))));
                      onSelectedChange?.(next);
                    }}
                  />
                </th>
              )}
              {visible.map((c) => {
                const active = sort && c.sortKey && sort.key === c.sortKey;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx('whitespace-nowrap px-3 py-2 text-sm font-medium text-muted', c.align === 'right' && 'text-right', c.className)}
                  >
                    {c.sortKey && onSort ? (
                      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => onSort(c.sortKey!)}>
                        {c.header}
                        {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = getId(r);
              return (
                <tr key={id} className={clsx('border-t border-line', onRowClick && 'cursor-pointer hover:bg-sunken/70', selected?.has(id) && 'bg-primary-soft/50')} onClick={() => onRowClick?.(r)}>
                  {selectable && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar linha"
                        checked={!!selected?.has(id)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          onSelectedChange?.(next);
                        }}
                      />
                    </td>
                  )}
                  {visible.map((c) => (
                    <td key={c.key} className={clsx('whitespace-nowrap px-3 py-2 align-middle', c.align === 'right' && 'num text-right', c.className)}>{c.cell(r)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {page && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm text-muted">
          <span className="num">
            {page.total === 0 ? '0 registros' : `${(page.page - 1) * page.pageSize + 1}–${Math.min(page.page * page.pageSize, page.total)} de ${page.total}`}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" aria-label="Página anterior" disabled={page.page <= 1} onClick={() => page.onPage(page.page - 1)} icon={<ChevronLeft className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" aria-label="Próxima página" disabled={page.page * page.pageSize >= page.total} onClick={() => page.onPage(page.page + 1)} icon={<ChevronRight className="h-4 w-4" />} />
          </div>
        </div>
      )}
    </div>
  );
}
