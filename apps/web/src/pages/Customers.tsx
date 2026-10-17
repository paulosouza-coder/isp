import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { CUSTOMER_LIFECYCLES, LIFECYCLE_LABELS, type CustomerLifecycle } from '@isp/domain';
import { api, qs } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useDebounced, useUrlState } from '../lib/hooks';
import type { Paged } from '../lib/types';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState, ErrorState, Input, LoadingRows, PageHeader, Select } from '../components/ui/primitives';
import { LifecycleChip } from '../components/badges';

type Row = { id: string; name: string; phone: string | null; email: string | null; isProvisional: boolean; createdAt: string; customerId: string | null; lifecycle: CustomerLifecycle; externalId: string | null; sourceSystem: string | null; opportunities: number };

export function CustomersPage() {
  const nav = useNavigate();
  const [f, setF] = useUrlState({ q: '', lifecycle: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const dq = useDebounced(search);
  useEffect(() => { if (dq !== f.q) setF({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({ queryKey: ['customers', f], queryFn: () => api<Paged<Row>>(`/customers${qs({ ...f, pageSize: 25 })}`), placeholderData: keepPreviousData });

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Nome', locked: true, cell: (r) => <span><span className="font-medium">{r.name}</span>{r.isProvisional && <span className="ml-2 text-xs text-muted">provisório</span>}</span> },
    { key: 'lifecycle', header: 'Situação', cell: (r) => <LifecycleChip s={r.lifecycle} /> },
    { key: 'ext', header: 'Código externo', cell: (r) => (r.externalId ? <span className="num">{r.externalId}</span> : <span className="text-muted">—</span>) },
    { key: 'contact', header: 'Contato', cell: (r) => <span className="num text-muted">{r.phone || r.email || '—'}</span> },
    { key: 'opps', header: 'Oportunidades', align: 'right', cell: (r) => r.opportunities },
    { key: 'created', header: 'Cadastro', cell: (r) => <span className="num">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Clientes" description="Pessoas com quem a empresa conversa. Cliente = quem tem ou teve contrato; prospect = ainda não." />
      <div className="panel">
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3" role="search">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="cu-q" className="sr-only">Buscar</label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
            <Input id="cu-q" className="pl-8" placeholder="Nome, telefone ou código externo" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Situação" className="w-auto" value={f.lifecycle} onChange={(e) => setF({ lifecycle: e.target.value })}>
            <option value="">Todas as situações</option>
            {CUSTOMER_LIFECYCLES.map((l) => <option key={l} value={l}>{LIFECYCLE_LABELS[l]}</option>)}
          </Select>
        </div>
        {q.isLoading ? <LoadingRows /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? (
          <EmptyState title="Ninguém encontrado" description="Ajuste a busca. A importação da base do IXC chega na Fase 3." />
        ) : (
          <DataTable
            caption="Lista de clientes e contatos"
            storageKey="customers"
            rows={q.data.items}
            columns={columns}
            getId={(r) => r.id}
            onRowClick={(r) => nav(`/customers/${r.id}`)}
            page={{ page: q.data.page, pageSize: q.data.pageSize, total: q.data.total, onPage: (p) => setF({ page: String(p) }) }}
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-2">
                <span><span className="block font-medium">{r.name}</span><span className="block text-sm text-muted">{r.externalId ?? r.phone ?? '—'}</span></span>
                <LifecycleChip s={r.lifecycle} />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
