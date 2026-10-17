import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { KanbanSquare, Plus, Search, Table2 } from 'lucide-react';
import { OPPORTUNITY_STAGES, REASON_LABELS, STAGE_LABELS } from '@isp/domain';
import { api, qs } from '../lib/api';
import { fmtBRL, fmtDate, fmtDateTime } from '../lib/format';
import { useDebounced, useLookups, useUrlState } from '../lib/hooks';
import type { Opportunity, Paged } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Button, EmptyState, ErrorState, Input, LoadingRows, PageHeader, Select } from '../components/ui/primitives';
import { CoverageChip, ProposalChip, StageChip } from '../components/badges';

export function OpportunitiesPage() {
  const { can } = useAuth();
  const lookups = useLookups();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ q: '', stage: '', status: 'abertas', ownerId: '', sourceId: '', sort: 'updated_at', dir: 'desc', page: '1' });
  const [search, setSearch] = useState(f.q);
  const dq = useDebounced(search);
  useEffect(() => { if (dq !== f.q) setF({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({ queryKey: ['opportunities', f], queryFn: () => api<Paged<Opportunity>>(`/opportunities${qs({ ...f, pageSize: 25 })}`), placeholderData: keepPreviousData });

  const columns: Column<Opportunity>[] = [
    { key: 'code', header: 'Nº', cell: (o) => <span className="num text-muted">OP-{o.code}</span> },
    { key: 'contact', header: 'Contato', locked: true, sortKey: 'title', cell: (o) => <span><span className="block font-medium">{o.contactName}</span><span className="block max-w-[240px] truncate text-xs text-muted">{o.title}</span></span> },
    { key: 'stage', header: 'Etapa', sortKey: 'stage', cell: (o) => <StageChip stage={o.stage} /> },
    { key: 'value', header: 'Valor mensal', sortKey: 'value_cents', align: 'right', cell: (o) => (o.valueCents !== null ? fmtBRL(o.valueCents) : <span className="text-muted">—</span>) },
    { key: 'reasons', header: 'Motivo', cell: (o) => <span className="text-muted">{o.reasons.map((r) => REASON_LABELS[r]).join(', ') || '—'}</span> },
    { key: 'source', header: 'Origem', cell: (o) => o.sourceName ?? <span className="text-muted">Não informada</span> },
    { key: 'owner', header: 'Responsável', cell: (o) => o.ownerName },
    { key: 'next', header: 'Próxima ação', sortKey: 'next_action_at', cell: (o) => (o.nextActionAt ? <span className={o.overdue ? 'num font-medium text-danger' : 'num'}>{fmtDateTime(o.nextActionAt)}</span> : <span className="text-muted">—</span>) },
    { key: 'coverage', header: 'Cobertura', cell: (o) => <CoverageChip s={o.coverageStatus} /> },
    { key: 'proposal', header: 'Proposta', hidden: true, cell: (o) => <ProposalChip s={o.proposalStatus} /> },
    { key: 'updated', header: 'Atualizada', sortKey: 'updated_at', cell: (o) => <span className="num">{fmtDate(o.updatedAt)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Oportunidades"
        actions={
          <>
            <div className="flex rounded-sm border border-line bg-surface p-0.5" role="group" aria-label="Visualização">
              <Link to={`/pipeline${qs({ q: f.q, ownerId: f.ownerId, sourceId: f.sourceId })}`} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm text-muted hover:text-ink"><KanbanSquare className="h-4 w-4" />Kanban</Link>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-soft px-3 py-1 text-sm font-medium text-primary" aria-current="page"><Table2 className="h-4 w-4" />Tabela</span>
            </div>
            {can('opportunity.create') && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => nav('/opportunities/new')}>Nova oportunidade</Button>}
          </>
        }
      />
      <div className="panel">
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3" role="search">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="op-q" className="sr-only">Buscar oportunidades</label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
            <Input id="op-q" className="pl-8" placeholder="Contato, título ou OP-número" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Situação" className="w-auto" value={f.status} onChange={(e) => setF({ status: e.target.value })}>
            <option value="abertas">Abertas</option>
            <option value="encerradas">Encerradas</option>
            <option value="todas">Todas</option>
          </Select>
          <Select aria-label="Etapa" className="w-auto" value={f.stage} onChange={(e) => setF({ stage: e.target.value })}>
            <option value="">Todas as etapas</option>
            {OPPORTUNITY_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </Select>
          {can('opportunity.read_all') && (
            <Select aria-label="Responsável" className="w-auto" value={f.ownerId} onChange={(e) => setF({ ownerId: e.target.value })}>
              <option value="">Toda a equipe</option>
              <option value="me">Minhas</option>
              {lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          )}
          <Select aria-label="Origem" className="w-auto" value={f.sourceId} onChange={(e) => setF({ sourceId: e.target.value })}>
            <option value="">Todas as origens</option>
            {lookups.data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        {q.isLoading ? (
          <LoadingRows />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState title="Nenhuma oportunidade encontrada" description="Ajuste os filtros ou abra um novo Sprint." action={can('opportunity.create') ? <Button variant="primary" onClick={() => nav('/opportunities/new')}>Nova oportunidade</Button> : undefined} />
        ) : (
          <DataTable
            caption="Lista de oportunidades"
            storageKey="opportunities"
            rows={q.data.items}
            columns={columns}
            getId={(o) => o.id}
            sort={{ key: f.sort, dir: f.dir as 'asc' | 'desc' }}
            onSort={(k) => setF({ sort: k, dir: f.sort === k && f.dir === 'desc' ? 'asc' : 'desc' })}
            onRowClick={(o) => nav(`/opportunities/${o.id}`)}
            page={{ page: q.data.page, pageSize: q.data.pageSize, total: q.data.total, onPage: (p) => setF({ page: String(p) }) }}
            mobileCard={(o) => (
              <div className="space-y-1">
                <p className="flex items-center justify-between gap-2"><span className="font-medium">{o.contactName}</span><StageChip stage={o.stage} /></p>
                <p className="text-sm text-muted">OP-{o.code} · {o.valueCents !== null ? fmtBRL(o.valueCents) : 'sem valor'} · {o.ownerName}</p>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
