import { sql, type SQL } from 'drizzle-orm';
import { DashboardQuery } from '@isp/shared';
import { defineRoute } from '../http/route';
import { forbidden } from '../http/errors';

const DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

type Kpi = {
  key: string;
  label: string;
  value: number | null;
  previous: number | null;
  unit: 'count' | 'brl_cents' | 'ratio' | 'days';
  kind: 'periodo' | 'posicao_atual';
  formula: string;
  source: string;
  note?: string;
};

/**
 * Indicadores comerciais da Fase 1. Cada KPI declara fórmula, unidade, fonte e se é
 * "posição atual" (sem comparação, pois não há denominador equivalente no passado)
 * ou "período" (compara com o período imediatamente anterior de mesmo tamanho).
 */
export const dashboardRoutes = [
  defineRoute({
    method: 'GET',
    url: '/dashboard',
    summary: 'KPIs, gráficos e fila de próximas ações com fórmula e fonte',
    tag: 'Dashboard',
    permission: 'dashboard.read',
    query: DashboardQuery,
    handler: async ({ app, auth, query }) => {
      const team = query.scope === 'equipe';
      if (team && !auth.permissions.has('opportunity.read_all')) throw forbidden('Sem permissão para a visão da equipe.');
      // vendedor sem read_all sempre vê só a própria carteira
      const oppOwner: SQL = team ? sql`true` : sql`o.owner_id = ${auth.userId}`;
      const leadOwner: SQL = team && auth.permissions.has('lead.read_all') ? sql`true` : sql`l.owner_id = ${auth.userId}`;
      const actOwner: SQL = team ? sql`true` : sql`a.owner_id = ${auth.userId}`;
      const t = auth.tenantId;
      const days = DAYS[query.period];
      const now = new Date();
      const from = new Date(now.getTime() - days * 86_400_000);
      const prevFrom = new Date(from.getTime() - days * 86_400_000);
      const one = async <T,>(q: SQL) => ((await app.db.execute(q)).rows[0] ?? {}) as T;
      const many = async <T,>(q: SQL) => (await app.db.execute(q)).rows as T[];
      const open = sql`o.stage not in ('ganha','perdida')`;
      const base = sql`o.tenant_id = ${t} and o.deleted_at is null and ${oppOwner}`;

      const [leadsK, snap, cohort, decision, overdue, contracts] = await Promise.all([
        one<{ cur: number; prev: number }>(sql`
          select count(*) filter (where l.created_at >= ${from})::int cur,
                 count(*) filter (where l.created_at >= ${prevFrom} and l.created_at < ${from})::int prev
          from leads l where l.tenant_id = ${t} and l.deleted_at is null and ${leadOwner} and l.created_at >= ${prevFrom}`),
        one<{ open: number; value: string | null; accepted: number }>(sql`
          select count(*) filter (where ${open})::int open,
                 coalesce(sum(o.value_cents) filter (where ${open}), 0)::bigint value,
                 count(*) filter (where o.proposal_status = 'aceita' and o.contract_request_status <> 'confirmada')::int accepted
          from opportunities o where ${base}`),
        one<{ cur_created: number; cur_won: number; prev_created: number; prev_won: number }>(sql`
          select count(*) filter (where o.created_at >= ${from})::int cur_created,
                 count(*) filter (where o.created_at >= ${from} and o.stage = 'ganha')::int cur_won,
                 count(*) filter (where o.created_at >= ${prevFrom} and o.created_at < ${from})::int prev_created,
                 count(*) filter (where o.created_at >= ${prevFrom} and o.created_at < ${from} and o.stage = 'ganha')::int prev_won
          from opportunities o where ${base} and o.created_at >= ${prevFrom}`),
        one<{ cur: number | null; prev: number | null }>(sql`
          select avg(extract(epoch from (coalesce(o.won_at,o.lost_at) - o.created_at))/86400) filter (where coalesce(o.won_at,o.lost_at) >= ${from}) cur,
                 avg(extract(epoch from (coalesce(o.won_at,o.lost_at) - o.created_at))/86400) filter (where coalesce(o.won_at,o.lost_at) >= ${prevFrom} and coalesce(o.won_at,o.lost_at) < ${from}) prev
          from opportunities o where ${base} and o.stage in ('ganha','perdida')`),
        one<{ n: number }>(sql`select count(*)::int n from activities a where a.tenant_id = ${t} and a.deleted_at is null and a.completed_at is null and a.due_at < now() and ${actOwner}`),
        one<{ n: number }>(sql`select count(*)::int n from opportunities o where ${base} and o.contract_request_status = 'confirmada'`),
      ]);

      const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
      const kpis: Kpi[] = [
        { key: 'leads_novos', label: 'Leads novos', value: leadsK.cur ?? 0, previous: leadsK.prev ?? 0, unit: 'count', kind: 'periodo', formula: 'Leads com data de criação no período', source: 'CRM · leads' },
        { key: 'oportunidades_abertas', label: 'Oportunidades abertas', value: snap.open ?? 0, previous: null, unit: 'count', kind: 'posicao_atual', formula: 'Oportunidades fora das etapas Ganha e Perdida, agora', source: 'CRM · oportunidades' },
        { key: 'valor_pipeline', label: 'Valor do pipeline (mensal)', value: Number(snap.value ?? 0), previous: null, unit: 'brl_cents', kind: 'posicao_atual', formula: 'Soma do valor mensal estimado das oportunidades abertas. Oportunidades sem valor não entram.', source: 'CRM · oportunidades (valor informado pelo vendedor)' },
        { key: 'propostas_aceitas_pendentes', label: 'Propostas aceitas pendentes', value: snap.accepted ?? 0, previous: null, unit: 'count', kind: 'posicao_atual', formula: 'Proposta = Aceita e pedido de contrato ≠ Confirmada', source: 'CRM · oportunidades' },
        { key: 'contratos_confirmados', label: 'Contratos confirmados', value: contracts.n ?? 0, previous: null, unit: 'count', kind: 'posicao_atual', formula: 'Pedido de contrato = Confirmada (somente por confirmação externa validada)', source: 'IXC (Fase 6) — nenhuma rota atual consegue confirmar contrato', note: 'Aceite ou etapa Ganha não contam aqui.' },
        { key: 'taxa_ganho_coorte', label: 'Taxa de ganho comercial (coorte)', value: ratio(cohort.cur_won ?? 0, cohort.cur_created ?? 0), previous: ratio(cohort.prev_won ?? 0, cohort.prev_created ?? 0), unit: 'ratio', kind: 'periodo', formula: `Oportunidades criadas no período que estão em Ganha ÷ oportunidades criadas no período (n=${cohort.cur_created ?? 0}; anterior n=${cohort.prev_created ?? 0})`, source: 'CRM · oportunidades', note: 'Ganho comercial, não aquisição confirmada. Coortes recentes ainda estão amadurecendo.' },
        { key: 'retornos_vencidos', label: 'Atividades vencidas', value: overdue.n ?? 0, previous: null, unit: 'count', kind: 'posicao_atual', formula: 'Atividades abertas com prazo anterior a agora', source: 'CRM · atividades' },
        { key: 'tempo_decisao', label: 'Tempo médio até decisão', value: decision.cur === null || decision.cur === undefined ? null : Number(decision.cur), previous: decision.prev === null || decision.prev === undefined ? null : Number(decision.prev), unit: 'days', kind: 'periodo', formula: 'Média de (data de ganho ou perda − criação) das oportunidades encerradas no período', source: 'CRM · oportunidades' },
      ];

      const [funnel, bySource, byOwner, losses, trend, queue] = await Promise.all([
        many<{ stage: string; n: number; value: string }>(sql`
          select o.stage, count(*)::int n, coalesce(sum(o.value_cents),0)::bigint value from opportunities o
          where ${base} and (${open} or coalesce(o.won_at,o.lost_at) >= ${from}) group by o.stage`),
        many<{ source: string; created: number; won: number }>(sql`
          select coalesce(s.name, 'Não informada') source, count(*)::int created, count(*) filter (where o.stage='ganha')::int won
          from opportunities o left join lead_sources s on s.id = o.source_id
          where ${base} and o.created_at >= ${from} group by 1 order by created desc limit 8`),
        many<{ owner: string; created: number; won: number; lost: number }>(sql`
          select u.name owner, count(*)::int created, count(*) filter (where o.stage='ganha')::int won, count(*) filter (where o.stage='perdida')::int lost
          from opportunities o join users u on u.id = o.owner_id
          where ${base} and o.created_at >= ${from} group by u.name order by created desc limit 10`),
        many<{ reason: string; n: number }>(sql`
          select coalesce(o.loss_reason,'nao_informado') reason, count(*)::int n from opportunities o
          where ${base} and o.stage='perdida' and o.lost_at >= ${from} group by 1 order by n desc`),
        many<{ bucket: string; created: number; won: number }>(sql`
          with b as (select generate_series(date_trunc('week', ${from}::timestamptz at time zone ${auth.timezone}), date_trunc('week', now() at time zone ${auth.timezone}), interval '1 week') bucket)
          select to_char(b.bucket,'YYYY-MM-DD') bucket,
            (select count(*)::int from opportunities o where ${base} and date_trunc('week', o.created_at at time zone ${auth.timezone}) = b.bucket) created,
            (select count(*)::int from opportunities o where ${base} and o.stage='ganha' and date_trunc('week', o.won_at at time zone ${auth.timezone}) = b.bucket) won
          from b order by b.bucket`),
        many<Record<string, unknown>>(sql`
          select a.id, a.title, a.type, a.due_at "dueAt", a.priority, a.opportunity_id "opportunityId", o.title "opportunityTitle", c.name "contactName", u.name "ownerName",
                 (a.due_at < now()) overdue
          from activities a join users u on u.id = a.owner_id
          left join opportunities o on o.id = a.opportunity_id left join contacts c on c.id = a.contact_id
          where a.tenant_id = ${t} and a.deleted_at is null and a.completed_at is null and ${actOwner}
          order by (a.due_at < now()) desc, case a.priority when 'alta' then 0 when 'media' then 1 else 2 end, a.due_at asc nulls last
          limit 8`),
      ]);

      return {
        period: { key: query.period, from: from.toISOString(), to: now.toISOString(), previousFrom: prevFrom.toISOString(), timezone: auth.timezone },
        scope: query.scope,
        generatedAt: now.toISOString(),
        freshness: { source: 'CRM (tempo real)', ixc: 'não integrado nesta fase' },
        kpis,
        charts: {
          funnel: funnel.map((f) => ({ ...f, value: Number(f.value) })),
          bySource,
          byOwner: team ? byOwner : [],
          losses,
          trend,
        },
        queue,
      };
    },
  }),
];
