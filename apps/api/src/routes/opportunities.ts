import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { OpportunityCreate, OpportunityListQuery, OpportunityTransition, OpportunityUpdate } from '@isp/shared';
import { OPEN_STAGES, TERMINAL_STAGES, validateTransition, type OpportunityStage } from '@isp/domain';
import { defineRoute, IdParams } from '../http/route';
import { conflict, unprocessable } from '../http/errors';
import * as s from '../db/schema';
import {
  bumpVersion, createOpportunity, loadOpportunity, opportunityDto, opportunityQuery, oppVisibility,
} from '../services/opportunities';
import { assertAssignableUser, assertTenantRefs } from '../services/scope';
import { audit } from '../services/audit';

const SORTS = {
  updated_at: s.opportunities.updatedAt,
  created_at: s.opportunities.createdAt,
  title: s.opportunities.title,
  value_cents: s.opportunities.valueCents,
  next_action_at: s.opportunities.nextActionAt,
  stage: s.opportunities.stage,
} as const;

const PipelineQuery = z.object({
  q: z.string().trim().max(100).optional(),
  ownerId: z.union([z.string().uuid(), z.literal('me')]).optional(),
  sourceId: z.string().uuid().optional(),
});

function commonFilters(auth: Parameters<typeof oppVisibility>[0], f: { q?: string; ownerId?: string; sourceId?: string }) {
  const where: SQL[] = [oppVisibility(auth)];
  if (f.q) {
    const term = `%${f.q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(or(ilike(s.opportunities.title, term), ilike(s.contacts.name, term), sql`${s.opportunities.code}::text = ${f.q.replace(/^OP-/i, '')}`)!);
  }
  if (f.ownerId === 'me') where.push(eq(s.opportunities.ownerId, auth.userId));
  else if (f.ownerId) where.push(eq(s.opportunities.ownerId, f.ownerId));
  if (f.sourceId) where.push(eq(s.opportunities.sourceId, f.sourceId));
  return where;
}

export const opportunityRoutes = [
  defineRoute({
    method: 'GET',
    url: '/opportunities',
    summary: 'Lista oportunidades (tabela) com filtros e paginação',
    tag: 'Oportunidades',
    permission: 'opportunity.read',
    query: OpportunityListQuery,
    handler: async ({ app, auth, query }) => {
      const where = commonFilters(auth, query);
      if (query.stage) where.push(eq(s.opportunities.stage, query.stage));
      if (query.status === 'abertas') where.push(inArray(s.opportunities.stage, OPEN_STAGES as string[]));
      if (query.status === 'encerradas') where.push(inArray(s.opportunities.stage, TERMINAL_STAGES as unknown as string[]));
      const cond = and(...where);
      const col = SORTS[query.sort];
      const [rows, [{ total } = { total: 0 }]] = await Promise.all([
        opportunityQuery(app.db)
          .where(cond)
          .orderBy(query.dir === 'asc' ? sql`${col} asc nulls last` : sql`${col} desc nulls last`, desc(s.opportunities.id))
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
        app.db.select({ total: sql<number>`count(*)::int` }).from(s.opportunities).innerJoin(s.contacts, eq(s.contacts.id, s.opportunities.contactId)).where(cond),
      ]);
      const now = new Date();
      return { items: rows.map((r) => opportunityDto(r, auth, now)), page: query.page, pageSize: query.pageSize, total };
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/pipeline',
    summary: 'Kanban: colunas configuradas com contagem, valor e cards',
    tag: 'Oportunidades',
    permission: 'opportunity.read',
    query: PipelineQuery,
    handler: async ({ app, auth, query }) => {
      const stages = await app.db
        .select()
        .from(s.pipelineStages)
        .where(and(eq(s.pipelineStages.tenantId, auth.tenantId), eq(s.pipelineStages.active, true)))
        .orderBy(asc(s.pipelineStages.position));
      const since = new Date(Date.now() - 30 * 86_400_000);
      const where = commonFilters(auth, query);
      // abertas: todas; encerradas: só as dos últimos 30 dias, para o quadro não crescer sem limite
      where.push(or(inArray(s.opportunities.stage, OPEN_STAGES as string[]), gte(s.opportunities.stageChangedAt, since))!);
      const rows = await opportunityQuery(app.db).where(and(...where)).orderBy(sql`${s.opportunities.nextActionAt} asc nulls last`).limit(1000);
      const now = new Date();
      return {
        stages: stages.map((st) => {
          const cards = rows.filter((r) => r.stage === st.key).map((r) => opportunityDto(r, auth, now));
          return {
            key: st.key as OpportunityStage,
            name: st.name,
            isTerminal: st.isTerminal,
            count: cards.length,
            valueCents: cards.reduce((acc, c) => acc + (c.valueCents ?? 0), 0),
            cards,
          };
        }),
        terminalWindowDays: 30,
        generatedAt: now.toISOString(),
      };
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/opportunities',
    summary: 'Cria oportunidade (persistida imediatamente) — abre o workspace Sprint',
    tag: 'Oportunidades',
    permission: 'opportunity.create',
    body: OpportunityCreate,
    handler: async ({ app, auth, body, req, reply }) => {
      if (body.newContact && !auth.permissions.has('customer.create')) throw unprocessable('Sem permissão para criar contato.');
      const opp = await app.db.transaction(async (tx) => {
        const created = await createOpportunity(tx, auth, req, body);
        if (body.leadId) {
          await tx
            .update(s.leads)
            .set({ status: 'convertido', convertedOpportunityId: created.id, updatedAt: new Date(), rowVersion: sql`${s.leads.rowVersion} + 1` })
            .where(and(eq(s.leads.id, body.leadId), eq(s.leads.tenantId, auth.tenantId), isNull(s.leads.convertedOpportunityId)));
        }
        return created;
      });
      reply.code(201);
      return opportunityDto(await loadOpportunity(app.db, auth, opp.id), auth);
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/opportunities/:id',
    summary: 'Detalhe da oportunidade',
    tag: 'Oportunidades',
    permission: 'opportunity.read',
    params: IdParams,
    handler: async ({ app, auth, params }) => opportunityDto(await loadOpportunity(app.db, auth, params.id), auth),
  }),

  defineRoute({
    method: 'PATCH',
    url: '/opportunities/:id',
    summary: 'Atualiza campos da oportunidade (não altera etapa nem status externos)',
    tag: 'Oportunidades',
    permission: 'opportunity.update',
    params: IdParams,
    body: OpportunityUpdate,
    handler: async ({ app, auth, params, body, req }) => {
      await app.db.transaction(async (tx) => {
        const cur = await loadOpportunity(tx, auth, params.id);
        if (cur.rowVersion !== body.rowVersion) throw conflict(cur.rowVersion);
        if (body.ownerId && body.ownerId !== cur.ownerId) {
          await assertAssignableUser(tx, auth, body.ownerId, 'opportunity.assign');
          if (!auth.permissions.has('opportunity.assign')) throw unprocessable('Sem permissão para reatribuir.');
        }
        await assertTenantRefs(tx, auth, { sourceId: body.sourceId, campaignId: body.campaignId });
        const patch = {
          title: body.title ?? undefined,
          ownerId: body.ownerId,
          sourceId: body.sourceId,
          campaignId: body.campaignId,
          channel: body.channel,
          reasons: body.reasons,
          valueCents: body.valueCents,
          nextAction: body.nextAction,
          nextActionAt: body.nextActionAt === undefined ? undefined : body.nextActionAt ? new Date(body.nextActionAt) : null,
          notes: body.notes,
        };
        const changed: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          const before = (cur as Record<string, unknown>)[k];
          const norm = (x: unknown) => (x instanceof Date ? x.toISOString() : Array.isArray(x) ? x.join(',') : x ?? null);
          if (norm(before) !== norm(v)) changed[k] = { from: k === 'notes' ? undefined : norm(before), to: k === 'notes' ? undefined : norm(v) };
        }
        const updated = await tx
          .update(s.opportunities)
          .set({ ...patch, updatedAt: new Date(), rowVersion: bumpVersion() })
          .where(and(eq(s.opportunities.id, params.id), eq(s.opportunities.tenantId, auth.tenantId), eq(s.opportunities.rowVersion, body.rowVersion)))
          .returning({ rowVersion: s.opportunities.rowVersion });
        if (!updated.length) throw conflict(cur.rowVersion);
        if (Object.keys(changed).length) {
          await tx.insert(s.opportunityEvents).values({
            tenantId: auth.tenantId,
            opportunityId: params.id,
            type: changed.ownerId ? 'assigned' : 'updated',
            actorId: auth.userId,
            payload: { changed },
            rowVersion: updated[0]!.rowVersion,
          });
        }
        if (changed.ownerId) await audit(tx, req, { action: 'opportunity.assign', entityType: 'opportunity', entityId: params.id, metadata: changed.ownerId });
      });
      return opportunityDto(await loadOpportunity(app.db, auth, params.id), auth);
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/opportunities/:id/transition',
    summary: 'Muda a etapa do funil com regras de servidor (409 versão, 422 regra)',
    tag: 'Oportunidades',
    permission: 'opportunity.update',
    params: IdParams,
    body: OpportunityTransition,
    handler: async ({ app, auth, params, body, req }) => {
      await app.db.transaction(async (tx) => {
        const cur = await loadOpportunity(tx, auth, params.id);
        if (cur.rowVersion !== body.rowVersion) throw conflict(cur.rowVersion);
        const from = cur.stage as OpportunityStage;
        const v = validateTransition({ from, to: body.toStage, reason: body.reason, lossReason: body.lossReason, confirm: body.confirm, canReopen: auth.permissions.has('opportunity.reopen') });
        if (!v.ok) throw unprocessable(v.message, [{ path: v.code, message: v.message }]);
        const now = new Date();
        const reopening = TERMINAL_STAGES.includes(from);
        const updated = await tx
          .update(s.opportunities)
          .set({
            stage: body.toStage,
            stageChangedAt: now,
            wonAt: body.toStage === 'ganha' ? now : reopening ? null : undefined,
            lostAt: body.toStage === 'perdida' ? now : reopening ? null : undefined,
            lossReason: body.toStage === 'perdida' ? body.lossReason : reopening ? null : undefined,
            updatedAt: now,
            rowVersion: bumpVersion(),
          })
          .where(and(eq(s.opportunities.id, params.id), eq(s.opportunities.tenantId, auth.tenantId), eq(s.opportunities.rowVersion, body.rowVersion)))
          .returning({ rowVersion: s.opportunities.rowVersion });
        if (!updated.length) throw conflict(cur.rowVersion);
        await tx.insert(s.opportunityEvents).values({
          tenantId: auth.tenantId,
          opportunityId: params.id,
          type: reopening ? 'reopened' : 'stage_changed',
          actorId: auth.userId,
          fromValue: from,
          toValue: body.toStage,
          reason: body.reason ?? null,
          payload: body.lossReason ? { lossReason: body.lossReason } : null,
          rowVersion: updated[0]!.rowVersion,
        });
        if (reopening || TERMINAL_STAGES.includes(body.toStage)) {
          await audit(tx, req, { action: reopening ? 'opportunity.reopen' : `opportunity.${body.toStage}`, entityType: 'opportunity', entityId: params.id, metadata: { from, to: body.toStage } });
        }
      });
      return opportunityDto(await loadOpportunity(app.db, auth, params.id), auth);
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/opportunities/:id/timeline',
    summary: 'Linha do tempo: eventos da oportunidade e atividades vinculadas',
    tag: 'Oportunidades',
    permission: 'opportunity.read',
    params: IdParams,
    handler: async ({ app, auth, params }) => {
      await loadOpportunity(app.db, auth, params.id); // checa visibilidade
      const events = await app.db
        .select({
          id: s.opportunityEvents.id,
          type: s.opportunityEvents.type,
          fromValue: s.opportunityEvents.fromValue,
          toValue: s.opportunityEvents.toValue,
          reason: s.opportunityEvents.reason,
          payload: s.opportunityEvents.payload,
          occurredAt: s.opportunityEvents.occurredAt,
          observedAt: s.opportunityEvents.observedAt,
          sourceSystem: s.opportunityEvents.sourceSystem,
          actorName: s.users.name,
        })
        .from(s.opportunityEvents)
        .leftJoin(s.users, eq(s.users.id, s.opportunityEvents.actorId))
        .where(and(eq(s.opportunityEvents.opportunityId, params.id), eq(s.opportunityEvents.tenantId, auth.tenantId)))
        .orderBy(desc(s.opportunityEvents.occurredAt));
      const acts = await app.db
        .select({ id: s.activityEvents.id, type: s.activityEvents.type, payload: s.activityEvents.payload, occurredAt: s.activityEvents.occurredAt, actorName: s.users.name, title: s.activities.title, activityType: s.activities.type })
        .from(s.activityEvents)
        .innerJoin(s.activities, eq(s.activities.id, s.activityEvents.activityId))
        .leftJoin(s.users, eq(s.users.id, s.activityEvents.actorId))
        .where(and(eq(s.activities.opportunityId, params.id), eq(s.activities.tenantId, auth.tenantId)));
      const items = [
        ...events.map((e) => ({ kind: 'opportunity' as const, ...e })),
        ...acts.map((a) => ({ kind: 'activity' as const, ...a, observedAt: a.occurredAt, sourceSystem: 'crm' })),
      ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      return { items };
    },
  }),
];
