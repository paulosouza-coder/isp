import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserPlus } from 'lucide-react';
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@isp/domain';
import { api, ApiError, qs } from '../lib/api';
import { fmtDate, fmtDateTime, fmtRelative, isoToLocalInput, localInputToIso } from '../lib/format';
import { useDebounced, useLookups, useUrlState } from '../lib/hooks';
import type { Lead, Paged } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Button, EmptyState, ErrorState, FormField, Input, LoadingRows, Notice, PageHeader, Select, Textarea } from '../components/ui/primitives';
import { ConfirmDialog, Drawer, useToast } from '../components/ui/overlay';
import { LeadStatusChip, SlaChip, TemperatureChip } from '../components/badges';

const INTEREST_OPTIONS = ['preço', 'velocidade', 'estabilidade', 'benefícios', 'instalação', 'atendimento', 'Wi-Fi'];

function LeadForm({ lead, onDone }: { lead?: Lead; onDone: () => void }) {
  const { can, me } = useAuth();
  const lookups = useLookups();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    phone: lead && !lead.piiMasked ? lead.phone ?? '' : '',
    email: lead && !lead.piiMasked ? lead.email ?? '' : '',
    sourceId: lead?.sourceId ?? '',
    campaignId: lead?.campaignId ?? '',
    ownerId: lead?.ownerId ?? me?.user.id ?? '',
    interests: lead?.interests ?? [],
    status: lead?.status ?? 'novo',
    nextAction: lead?.nextAction ?? '',
    nextActionAt: isoToLocalInput(lead?.nextActionAt),
    notes: lead?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async (extra: { registerContact?: boolean } = {}) => {
      const body: Record<string, unknown> = {
        name: form.name,
        sourceId: form.sourceId || null,
        campaignId: form.campaignId || null,
        interests: form.interests,
        nextAction: form.nextAction || null,
        nextActionAt: localInputToIso(form.nextActionAt),
        notes: form.notes || null,
      };
      if (!lead || !lead.piiMasked) Object.assign(body, { phone: form.phone || null, email: form.email || null });
      if (can('lead.assign') || !lead) body.ownerId = form.ownerId || null;
      if (lead) {
        body.status = form.status;
        body.rowVersion = lead.rowVersion;
        if (extra.registerContact) body.lastContactAt = new Date().toISOString();
        return api<Lead>(`/leads/${lead.id}`, { method: 'PATCH', body });
      }
      return api<Lead>('/leads', { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast({ tone: 'success', message: lead ? 'Lead salvo' : 'Lead criado' });
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors());
        toast({ tone: 'error', message: e.status === 409 ? 'Outra pessoa alterou este lead. Feche e abra de novo para ver a versão atual.' : e.message });
      }
    },
  });

  const convert = useMutation({
    mutationFn: () => api<{ opportunityId: string }>(`/leads/${lead!.id}/convert`, { method: 'POST', body: { rowVersion: lead!.rowVersion } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      nav(`/opportunities/${r.opportunityId}`);
    },
    onError: (e) => toast({ tone: 'error', message: (e as Error).message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return; // evita duplo envio
    setErrors({});
    save.mutate({});
  };

  return (
    <form id="lead-form" onSubmit={submit} className="space-y-4" noValidate>
      {lead?.piiMasked && <Notice>Contato mascarado: seu perfil não tem acesso a dados pessoais.</Notice>}
      <FormField label="Nome" htmlFor="lf-name" required error={errors.name}>
        <Input id="lf-name" value={form.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
      </FormField>
      {!lead?.piiMasked && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Telefone" htmlFor="lf-phone" error={errors.phone}>
            <Input id="lf-phone" inputMode="tel" value={form.phone} invalid={!!errors.phone} onChange={(e) => set('phone', e.target.value)} />
          </FormField>
          <FormField label="E-mail" htmlFor="lf-email" error={errors.email}>
            <Input id="lf-email" type="email" value={form.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
          </FormField>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Origem" htmlFor="lf-source">
          <Select id="lf-source" value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
            <option value="">Não informada</option>
            {lookups.data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Campanha" htmlFor="lf-campaign">
          <Select id="lf-campaign" value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}>
            <option value="">Nenhuma</option>
            {lookups.data?.campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        {(can('lead.assign') || !lead) && (
          <FormField label="Responsável" htmlFor="lf-owner" error={errors.ownerId}>
            <Select id="lf-owner" value={form.ownerId} disabled={!can('lead.assign')} onChange={(e) => set('ownerId', e.target.value)}>
              {lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </FormField>
        )}
        {lead && (
          <FormField label="Status" htmlFor="lf-status">
            <Select id="lf-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {LEAD_STATUSES.filter((s) => s !== 'convertido' || lead.status === 'convertido').map((s) => <option key={s} value={s} disabled={s === 'convertido'}>{LEAD_STATUS_LABELS[s]}</option>)}
            </Select>
          </FormField>
        )}
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Interesse declarado</legend>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((i) => {
            const on = form.interests.includes(i);
            return (
              <label key={i} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-line-strong'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => set('interests', on ? form.interests.filter((x) => x !== i) : [...form.interests, i])} />
                {i}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Próxima ação" htmlFor="lf-na">
          <Input id="lf-na" value={form.nextAction} onChange={(e) => set('nextAction', e.target.value)} placeholder="Ex.: ligar para entender o uso" />
        </FormField>
        <FormField label="Quando" htmlFor="lf-nat">
          <Input id="lf-nat" type="datetime-local" value={form.nextActionAt} onChange={(e) => set('nextActionAt', e.target.value)} />
        </FormField>
      </div>
      <FormField label="Observações" htmlFor="lf-notes">
        <Textarea id="lf-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </FormField>

      {lead && (
        <div className="space-y-2 rounded-md border border-line bg-sunken/50 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2"><TemperatureChip t={lead.temperature} /> <SlaChip state={lead.sla.state} /></p>
          <p className="text-muted">Criado em {fmtDateTime(lead.createdAt)} · último contato {lead.lastContactAt ? fmtRelative(lead.lastContactAt) : 'nunca'}</p>
          <ul className="list-disc pl-5 text-muted">{lead.temperature.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => save.mutate({ registerContact: true })} loading={save.isPending}>Registrar contato agora</Button>
            {lead.status !== 'convertido' && lead.status !== 'descartado' && can('opportunity.create') && (
              <Button size="sm" variant="primary" onClick={() => convert.mutate()} loading={convert.isPending}>Converter em oportunidade</Button>
            )}
            {lead.convertedOpportunityId && <Button size="sm" onClick={() => nav(`/opportunities/${lead.convertedOpportunityId}`)}>Abrir oportunidade</Button>}
          </div>
        </div>
      )}
    </form>
  );
}

export function LeadsPage() {
  const { can } = useAuth();
  const lookups = useLookups();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useUrlState({ q: '', status: '', sourceId: '', ownerId: '', sort: 'created_at', dir: 'desc', page: '1' });
  const [search, setSearch] = useState(f.q);
  const dq = useDebounced(search);
  useEffect(() => { if (dq !== f.q) setF({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [confirmAssign, setConfirmAssign] = useState(false);

  const q = useQuery({
    queryKey: ['leads', f],
    queryFn: () => api<Paged<Lead>>(`/leads${qs({ ...f, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
  });

  const bulk = useMutation({
    mutationFn: () => api<{ updated: number }>('/leads/bulk-assign', { method: 'POST', body: { ids: [...selected], ownerId: assignTo } }),
    onSuccess: (r) => {
      toast({ tone: 'success', message: `${r.updated} lead(s) atribuídos` });
      setSelected(new Set());
      setConfirmAssign(false);
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast({ tone: 'error', message: (e as Error).message }),
  });

  const columns: Column<Lead>[] = [
    { key: 'name', header: 'Nome', sortKey: 'name', locked: true, cell: (l) => <span className="font-medium">{l.name}</span> },
    { key: 'contact', header: 'Contato', cell: (l) => <span className="num text-muted">{l.phone || l.email || '—'}</span> },
    { key: 'source', header: 'Origem', cell: (l) => l.sourceName ?? <span className="text-muted">Não informada</span> },
    { key: 'interests', header: 'Interesse', cell: (l) => <span className="text-muted">{l.interests.join(', ') || '—'}</span> },
    { key: 'owner', header: 'Responsável', cell: (l) => l.ownerName ?? <span className="text-warning">Sem responsável</span> },
    { key: 'temp', header: 'Temperatura', cell: (l) => <TemperatureChip t={l.temperature} /> },
    { key: 'status', header: 'Etapa', sortKey: 'status', cell: (l) => <LeadStatusChip status={l.status} /> },
    { key: 'created', header: 'Criado', sortKey: 'created_at', cell: (l) => <span className="num">{fmtDate(l.createdAt)}</span> },
    { key: 'next', header: 'Próxima ação', sortKey: 'next_action_at', cell: (l) => l.nextAction ? <span><span className="block max-w-[200px] truncate">{l.nextAction}</span><span className="num text-xs text-muted">{fmtDateTime(l.nextActionAt)}</span></span> : <span className="text-muted">—</span> },
    { key: 'sla', header: 'SLA', cell: (l) => <SlaChip state={l.sla.state} /> },
    { key: 'last', header: 'Último contato', sortKey: 'last_contact_at', hidden: true, cell: (l) => <span className="num">{l.lastContactAt ? fmtRelative(l.lastContactAt) : 'Nunca'}</span> },
  ];

  const filtersActive = f.q || f.status || f.sourceId || f.ownerId;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Leads"
        description="Interesses ainda não trabalhados como oportunidade."
        actions={can('lead.create') && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Novo lead</Button>}
      />
      <div className="panel">
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3" role="search">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="leads-q" className="sr-only">Buscar leads</label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
            <Input id="leads-q" className="pl-8" placeholder="Nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="leads-status">Etapa</label>
          <Select id="leads-status" className="w-auto" value={f.status} onChange={(e) => setF({ status: e.target.value })}>
            <option value="">Todas as etapas</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s as LeadStatus]}</option>)}
          </Select>
          <label className="sr-only" htmlFor="leads-source">Origem</label>
          <Select id="leads-source" className="w-auto" value={f.sourceId} onChange={(e) => setF({ sourceId: e.target.value })}>
            <option value="">Todas as origens</option>
            {lookups.data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          {can('lead.read_all') && (
            <>
              <label className="sr-only" htmlFor="leads-owner">Responsável</label>
              <Select id="leads-owner" className="w-auto" value={f.ownerId} onChange={(e) => setF({ ownerId: e.target.value })}>
                <option value="">Todos os responsáveis</option>
                <option value="me">Meus leads</option>
                <option value="none">Sem responsável</option>
                {lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </>
          )}
          {filtersActive && <Button variant="ghost" onClick={() => { setSearch(''); setF({ q: '', status: '', sourceId: '', ownerId: '' }); }}>Limpar filtros</Button>}
        </div>

        {selected.size > 0 && can('lead.assign') && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-primary-soft/50 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selecionado(s)</span>
            <label htmlFor="bulk-owner" className="sr-only">Atribuir a</label>
            <Select id="bulk-owner" className="h-8 w-auto" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Atribuir a…</option>
              {lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <Button size="sm" icon={<UserPlus className="h-4 w-4" />} disabled={!assignTo} onClick={() => setConfirmAssign(true)}>Atribuir</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          </div>
        )}

        {q.isLoading ? (
          <LoadingRows />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            title={filtersActive ? 'Nenhum lead com estes filtros' : 'Nenhum lead ainda'}
            description={filtersActive ? 'Ajuste ou limpe os filtros.' : 'Cadastre o primeiro lead ou abra uma oportunidade direto pelo botão “Nova oportunidade”.'}
            action={can('lead.create') && !filtersActive ? <Button variant="primary" onClick={() => setEditing('new')}>Novo lead</Button> : undefined}
          />
        ) : (
          <DataTable
            caption="Lista de leads"
            storageKey="leads"
            rows={q.data.items}
            columns={columns}
            getId={(l) => l.id}
            sort={{ key: f.sort, dir: f.dir as 'asc' | 'desc' }}
            onSort={(k) => setF({ sort: k, dir: f.sort === k && f.dir === 'desc' ? 'asc' : 'desc' })}
            selectable={can('lead.assign')}
            selected={selected}
            onSelectedChange={setSelected}
            onRowClick={(l) => setEditing(l)}
            page={{ page: q.data.page, pageSize: q.data.pageSize, total: q.data.total, onPage: (p) => setF({ page: String(p) }) }}
            mobileCard={(l) => (
              <div className="space-y-1">
                <p className="flex items-center justify-between gap-2"><span className="font-medium">{l.name}</span><TemperatureChip t={l.temperature} /></p>
                <p className="text-sm text-muted">{l.sourceName ?? 'Origem não informada'} · {l.ownerName ?? 'Sem responsável'}</p>
                <p className="flex gap-2"><LeadStatusChip status={l.status} /><SlaChip state={l.sla.state} /></p>
              </div>
            )}
          />
        )}
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Novo lead' : editing ? editing.name : ''}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="primary" type="submit" form="lead-form">{editing === 'new' ? 'Criar lead' : 'Salvar lead'}</Button>
          </>
        }
      >
        {editing && <LeadForm key={editing === 'new' ? 'new' : editing.id + editing.rowVersion} lead={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Drawer>

      <ConfirmDialog
        open={confirmAssign}
        title="Atribuir leads"
        confirmLabel="Atribuir"
        loading={bulk.isPending}
        onCancel={() => setConfirmAssign(false)}
        onConfirm={() => bulk.mutate()}
      >
        <p>{selected.size} lead(s) passarão para <strong>{lookups.data?.users.find((u) => u.id === assignTo)?.name}</strong>. A mudança fica registrada na auditoria.</p>
      </ConfirmDialog>
    </div>
  );
}
