import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { CustomerLifecycle } from '@isp/domain';
import { api, qs } from '../lib/api';
import { fmtBRL, fmtDate, fmtDateTime, fmtRelative } from '../lib/format';
import type { Activity, Opportunity, Paged } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, ErrorState, LoadingRows, Notice, PageHeader, Tabs } from '../components/ui/primitives';
import { LifecycleChip, StageChip } from '../components/badges';
import { ActivityList } from '../features/ActivityList';

type Detail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  piiMasked: boolean;
  isProvisional: boolean;
  createdAt: string;
  customerId: string | null;
  lifecycle: CustomerLifecycle;
  sourceSystem: string | null;
  externalId: string | null;
  externalIds: { system: string; externalId: string }[];
  addresses: { id: string; street: string | null; number: string | null; district: string | null; city: string | null; state: string | null; validFrom: string; validTo: string | null }[];
  freshness: { ingestedAt: string; stale: boolean } | null;
  opportunities: Opportunity[];
};

const FUTURE_TABS: Record<string, string> = {
  contratos: 'Contratos e planos chegam com a importação do IXC (Fases 3 e 4), preservando o histórico de cada mudança.',
  financeiro: 'Faturas, pagamentos e estornos chegam na Fase 4, com acesso restrito ao perfil financeiro.',
  atendimentos: 'Atendimentos e ordens de serviço chegam na Fase 4, conforme o que a instalação do IXC disponibilizar.',
};

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('resumo');
  const q = useQuery({ queryKey: ['contact', id], queryFn: () => api<Detail>(`/contacts/${id}`) });
  const acts = useQuery({ queryKey: ['activities', 'contact', id], queryFn: () => api<Paged<Activity>>(`/activities${qs({ contactId: id, status: 'todas', scope: can('activity.read_all') ? 'equipe' : 'minhas' })}`) });
  if (q.isLoading) return <LoadingRows rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data!;
  const open = c.opportunities.filter((o) => o.stage !== 'ganha' && o.stage !== 'perdida');

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        breadcrumb={[{ label: 'Clientes', to: '/customers' }, { label: c.name }]}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <LifecycleChip s={c.lifecycle} />
            {c.externalIds.map((e) => <span key={e.system + e.externalId} className="num text-sm">{e.system === 'seed_ficticio' ? 'Código (fictício)' : e.system}: {e.externalId}</span>)}
            {c.isProvisional && <span className="text-sm">Contato provisório</span>}
          </span>
        }
        actions={can('opportunity.create') && <Button variant="primary" onClick={() => nav('/opportunities/new')}>Nova oportunidade</Button>}
      />
      {c.freshness?.stale && (
        <div className="mb-4">
          <Notice tone="warning"><span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Dados desatualizados: última sincronização {fmtRelative(c.freshness.ingestedAt)}. Confirme no sistema de origem antes de decidir.</span></Notice>
        </div>
      )}
      {c.lifecycle !== 'prospect' && open.length === 0 && (
        <div className="mb-4"><Notice>Cliente existente. Antes de nova contratação, confira os contratos ativos no IXC — a aba Contratos será preenchida na Fase 3.</Notice></div>
      )}
      <div className="panel">
        <div className="px-4 pt-2">
          <Tabs label="Ficha do cliente" value={tab} onChange={setTab} tabs={[
            { key: 'resumo', label: 'Resumo' },
            { key: 'oportunidades', label: 'Oportunidades', count: c.opportunities.length },
            { key: 'atividades', label: 'Interações', count: acts.data?.total },
            { key: 'contratos', label: 'Contratos' },
            { key: 'financeiro', label: 'Financeiro' },
            { key: 'atendimentos', label: 'Atendimentos/OS' },
          ]} />
        </div>
        <div className="p-4" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'resumo' && (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <div><dt className="text-sm text-muted">Telefone</dt><dd className="num">{c.phone ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted">E-mail</dt><dd>{c.email ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted">Cadastro no CRM</dt><dd className="num">{fmtDate(c.createdAt)}</dd></div>
              <div><dt className="text-sm text-muted">Fonte do cadastro</dt><dd>{c.sourceSystem === 'seed_ficticio' ? 'Dados fictícios de demonstração' : c.sourceSystem ?? 'CRM'}{c.freshness && <span className="text-sm text-muted"> · sincronizado {fmtDateTime(c.freshness.ingestedAt)}</span>}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Endereços</dt>
                <dd>
                  {c.addresses.length === 0 ? '—' : (
                    <ul className="space-y-1">
                      {c.addresses.map((a) => (
                        <li key={a.id}>{[a.street, a.number, a.district, a.city, a.state].filter(Boolean).join(', ')} <span className="text-sm text-muted">· desde {fmtDate(a.validFrom)}{a.validTo ? ` até ${fmtDate(a.validTo)}` : ' (atual)'}</span></li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
              {c.piiMasked && <p className="text-sm text-muted sm:col-span-2">Dados pessoais mascarados para o seu perfil.</p>}
            </dl>
          )}
          {tab === 'oportunidades' && (c.opportunities.length === 0 ? <EmptyState title="Nenhuma oportunidade visível" /> : (
            <ul className="divide-y divide-line">
              {c.opportunities.map((o) => (
                <li key={o.id}>
                  <Link to={`/opportunities/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-sunken/50">
                    <span><span className="block font-medium">{o.title}</span><span className="num block text-sm text-muted">OP-{o.code} · {o.ownerName} · {fmtDate(o.createdAt)}</span></span>
                    <span className="flex items-center gap-3"><span className="num text-sm">{fmtBRL(o.valueCents)}</span><StageChip stage={o.stage} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
          {tab === 'atividades' && (acts.isLoading ? <LoadingRows rows={3} /> : acts.data?.items.length ? <ActivityList items={acts.data.items} /> : <EmptyState title="Nenhuma interação registrada" />)}
          {FUTURE_TABS[tab] && <EmptyState title="Ainda sem dados" description={FUTURE_TABS[tab]} />}
        </div>
      </div>
    </div>
  );
}
