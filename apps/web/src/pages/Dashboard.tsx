import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, CircleHelp, Minus } from 'lucide-react';
import { LOSS_REASON_LABELS, STAGE_LABELS, type LossReason, type OpportunityStage } from '@isp/domain';
import { api, qs } from '../lib/api';
import { fmtBRL, fmtDateTime, fmtInt, fmtPct, fmtRelative } from '../lib/format';
import { useUrlState } from '../lib/hooks';
import type { Kpi } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { ErrorState, PageHeader, Select, Skeleton, EmptyState } from '../components/ui/primitives';
import { stageStripe, PriorityChip } from '../components/badges';

type Dashboard = {
  period: { key: string; from: string; to: string; previousFrom: string };
  scope: 'meu' | 'equipe';
  generatedAt: string;
  freshness: { source: string; ixc: string };
  kpis: Kpi[];
  charts: {
    funnel: { stage: OpportunityStage; n: number; value: number }[];
    bySource: { source: string; created: number; won: number }[];
    byOwner: { owner: string; created: number; won: number; lost: number }[];
    losses: { reason: string; n: number }[];
    trend: { bucket: string; created: number; won: number }[];
  };
  queue: { id: string; title: string; dueAt: string | null; priority: 'baixa' | 'media' | 'alta'; opportunityId: string | null; opportunityTitle: string | null; contactName: string | null; ownerName: string; overdue: boolean }[];
};

function fmtKpi(k: Kpi, v: number | null) {
  if (v === null) return 'N/D';
  if (k.unit === 'brl_cents') return fmtBRL(v);
  if (k.unit === 'ratio') return fmtPct(v);
  if (k.unit === 'days') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`;
  return fmtInt(v);
}

function KpiCard({ k, to }: { k: Kpi; to?: string }) {
  const [open, setOpen] = useState(false);
  const delta = k.kind === 'periodo' && k.value !== null && k.previous !== null ? k.value - k.previous : null;
  // para "tempo até decisão", subir é ruim
  const goodWhenUp = k.unit !== 'days';
  const good = delta === null || delta === 0 ? null : (delta > 0) === goodWhenUp;
  const body = (
    <>
      <p className="text-sm text-muted">{k.label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight">{fmtKpi(k, k.value)}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
        {k.kind === 'posicao_atual' ? (
          'Posição atual'
        ) : delta === null ? (
          'Sem base de comparação'
        ) : (
          <>
            <span className={clsx('inline-flex items-center', good === null ? 'text-muted' : good ? 'text-success' : 'text-danger')}>
              {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
              {delta > 0 ? 'subiu' : delta < 0 ? 'caiu' : 'igual'}
            </span>
            · {fmtKpi(k, k.previous)} no período anterior
          </>
        )}
      </p>
    </>
  );
  return (
    <div className="panel relative p-4">
      {to ? <Link to={to} className="block rounded-sm hover:opacity-90">{body}</Link> : body}
      <button className="absolute right-2 top-2 rounded-sm p-1 text-muted hover:bg-sunken hover:text-ink" aria-expanded={open} aria-label={`Como é calculado: ${k.label}`} onClick={() => setOpen((v) => !v)}>
        <CircleHelp className="h-4 w-4" />
      </button>
      {open && (
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
          <p><span className="font-medium text-ink">Fórmula:</span> {k.formula}</p>
          <p><span className="font-medium text-ink">Fonte:</span> {k.source}</p>
          {k.note && <p className="text-warning">{k.note}</p>}
        </div>
      )}
    </div>
  );
}

/** Barras horizontais com valores escritos (não dependem só de cor). */
function BarList({ items, label }: { items: { key: string; label: string; value: number; secondary?: number; stripe?: string; to?: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">Sem dados no período.</p>;
  return (
    <ul aria-label={label} className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 text-sm">
          {i.to ? <Link to={i.to} className="truncate hover:underline">{i.label}</Link> : <span className="truncate">{i.label}</span>}
          <div className="relative h-5 overflow-hidden rounded-sm bg-sunken">
            <div className={clsx('h-full rounded-sm', i.stripe ?? 'bg-primary/70')} style={{ width: `${(i.value / max) * 100}%` }} />
            {i.secondary !== undefined && <div className="absolute inset-y-0 left-0 rounded-sm bg-success" style={{ width: `${(i.secondary / max) * 100}%` }} />}
          </div>
          <span className="num w-16 text-right text-muted">{i.secondary !== undefined ? `${i.secondary}/${i.value}` : i.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Trend({ data }: { data: Dashboard['charts']['trend'] }) {
  const max = Math.max(1, ...data.map((d) => d.created));
  if (!data.length) return null;
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={`Oportunidades criadas e ganhas por semana: ${data.map((d) => `${d.bucket}: ${d.created} criadas, ${d.won} ganhas`).join('; ')}`}>
        {data.map((d) => (
          <div key={d.bucket} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-[11px] text-muted">{d.created}</span>
            <div className="relative w-full max-w-[40px] rounded-t-sm bg-primary/30" style={{ height: `${(d.created / max) * 100}px` }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-success" style={{ height: `${(d.won / max) * 100}px` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <span key={d.bucket} className="num flex-1 text-center text-[11px] text-muted">{d.bucket.slice(8, 10)}/{d.bucket.slice(5, 7)}</span>
        ))}
      </div>
      <p className="mt-2 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" aria-hidden />Criadas (semana)</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden />Ganhas</span>
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { can, me } = useAuth();
  const nav = useNavigate();
  const canTeam = can('opportunity.read_all');
  const [f, setF] = useUrlState({ period: '30d', scope: canTeam ? 'equipe' : 'meu' });
  const q = useQuery({ queryKey: ['dashboard', f], queryFn: () => api<Dashboard>(`/dashboard${qs(f)}`) });
  const d = q.data;
  const kpiLink: Record<string, string> = {
    leads_novos: '/leads',
    oportunidades_abertas: '/opportunities',
    valor_pipeline: '/pipeline',
    retornos_vencidos: '/activities?status=atrasadas',
    propostas_aceitas_pendentes: '/opportunities?status=abertas',
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={`Olá, ${me?.user.name.split(' ')[0] ?? ''}`}
        description={d ? `Atualizado ${fmtRelative(d.generatedAt)} · ${d.freshness.source}` : 'Carregando indicadores…'}
        actions={
          <>
            {canTeam && (
              <div role="radiogroup" aria-label="Escopo" className="flex rounded-sm border border-line bg-surface p-0.5">
                {(['meu', 'equipe'] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={f.scope === s} onClick={() => setF({ scope: s })} className={clsx('rounded-sm px-3 py-1 text-sm', f.scope === s ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:text-ink')}>
                    {s === 'meu' ? 'Minha carteira' : 'Equipe'}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="period" className="sr-only">Período</label>
            <Select id="period" value={f.period} onChange={(e) => setF({ period: e.target.value })} className="w-auto">
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </Select>
          </>
        }
      />

      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {q.isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="panel space-y-2 p-4"><Skeleton className="w-1/2" /><Skeleton className="h-7 w-1/3" /><Skeleton className="w-2/3" /></div>
            ))
          : d?.kpis.map((k) => <KpiCard key={k.key} k={k} to={kpiLink[k.key]} />)}
      </section>

      {d && (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="panel p-4 xl:col-span-2" aria-labelledby="h-queue">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="h-queue" className="font-semibold">Próximas ações</h2>
              <Link to="/activities" className="link text-sm">Ver todas</Link>
            </div>
            {d.queue.length === 0 ? (
              <EmptyState title="Nenhuma atividade em aberto" description="Agende retornos a partir das oportunidades para eles aparecerem aqui." />
            ) : (
              <ul className="divide-y divide-line">
                {d.queue.map((a) => (
                  <li key={a.id}>
                    <button className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-left hover:bg-sunken/60" onClick={() => nav(a.opportunityId ? `/opportunities/${a.opportunityId}` : '/activities')}>
                      <span className={clsx('num w-36 shrink-0 text-sm', a.overdue ? 'font-medium text-danger' : 'text-muted')}>{a.overdue ? `Venceu ${fmtRelative(a.dueAt)}` : fmtDateTime(a.dueAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.title}</span>
                        <span className="block truncate text-sm text-muted">{a.contactName ?? a.opportunityTitle ?? 'Sem vínculo'}{d.scope === 'equipe' ? ` · ${a.ownerName}` : ''}</span>
                      </span>
                      <PriorityChip p={a.priority} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-4" aria-labelledby="h-funnel">
            <h2 id="h-funnel" className="mb-1 font-semibold">Funil</h2>
            <p className="mb-3 text-xs text-muted">Abertas agora; ganhas e perdidas no período</p>
            <BarList
              label="Oportunidades por etapa"
              items={(['novo', 'descoberta', 'qualificacao', 'oferta', 'negociacao', 'retorno', 'ganha', 'perdida'] as OpportunityStage[]).map((s) => ({
                key: s,
                label: STAGE_LABELS[s],
                value: d.charts.funnel.find((x) => x.stage === s)?.n ?? 0,
                stripe: stageStripe[s],
                to: `/opportunities?stage=${s}&status=todas`,
              }))}
            />
          </section>

          <section className="panel p-4 xl:col-span-2" aria-labelledby="h-trend">
            <h2 id="h-trend" className="mb-3 font-semibold">Tendência semanal</h2>
            <Trend data={d.charts.trend} />
          </section>

          <section className="panel p-4" aria-labelledby="h-source">
            <h2 id="h-source" className="mb-1 font-semibold">Origem</h2>
            <p className="mb-3 text-xs text-muted">Ganhas / criadas no período</p>
            <BarList label="Oportunidades por origem" items={d.charts.bySource.map((x) => ({ key: x.source, label: x.source, value: x.created, secondary: x.won }))} />
          </section>

          {d.scope === 'equipe' && (
            <section className="panel overflow-hidden xl:col-span-2" aria-labelledby="h-owner">
              <h2 id="h-owner" className="px-4 pt-4 font-semibold">Por vendedor</h2>
              <p className="px-4 pb-3 text-xs text-muted">Oportunidades criadas no período e seu estado atual</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sunken/60 text-left text-muted"><tr><th className="px-4 py-2 font-medium">Vendedor</th><th className="px-4 py-2 text-right font-medium">Criadas</th><th className="px-4 py-2 text-right font-medium">Ganhas</th><th className="px-4 py-2 text-right font-medium">Perdidas</th><th className="px-4 py-2 text-right font-medium">Taxa de ganho</th></tr></thead>
                  <tbody>
                    {d.charts.byOwner.map((o) => (
                      <tr key={o.owner} className="border-t border-line">
                        <td className="px-4 py-2">{o.owner}</td>
                        <td className="num px-4 py-2 text-right">{o.created}</td>
                        <td className="num px-4 py-2 text-right">{o.won}</td>
                        <td className="num px-4 py-2 text-right">{o.lost}</td>
                        <td className="num px-4 py-2 text-right" title={`n = ${o.created}`}>{o.created ? fmtPct(o.won / o.created) : 'N/D'}{o.created < 10 && <span className="ml-1 text-xs text-warning">(amostra pequena)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="panel p-4" aria-labelledby="h-loss">
            <h2 id="h-loss" className="mb-1 font-semibold">Motivos de perda</h2>
            <p className="mb-3 text-xs text-muted">Perdidas no período</p>
            <BarList label="Perdas por motivo" items={d.charts.losses.map((x) => ({ key: x.reason, label: LOSS_REASON_LABELS[x.reason as LossReason] ?? 'Não informado', value: x.n, stripe: 'bg-danger/70' }))} />
          </section>
        </div>
      )}
    </div>
  );
}
