import { and, asc, desc, eq, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ActivityCreate, ActivityListQuery, ActivityUpdate } from '@isp/shared';
import { isOverdue } from '@isp/domain';
import { defineRoute, IdParams } from '../http/route';
import { conflict, forbidden, notFound } from '../http/errors';
import type { AuthContext } from '../http/context';
import type { DbOrTx } from '../db/client';
import * as s from '../db/schema';
import { assertAssignableUser, assertTenantRefs, visibility } from '../services/scope';
import { loadOpportunity } from '../services/opportunities';

const owner = alias(s.users, 'act_owner');

const select = {
  id: s.activities.id,
  type: s.activities.type,
  title: s.activities.title,
  notes: s.activities.notes,
  dueAt: s.activities.dueAt,
  priority: s.activities.priority,
  completedAt: s.activities.completedAt,
  createdAt: s.activities.createdAt,
  rowVersion: s.activities.rowVersion,
  ownerId: s.activities.ownerId,
  ownerName: owner.name,
  opportunityId: s.activities.opportunityId,
  opportunityTitle: s.opportunities.title,
  opportunityCode: s.opportunities.code,
  leadId: s.activities.leadId,
  contactId: s.activities.contactId,
  contactName: s.contacts.name,
};

function query(db: DbOrTx) {
  return db
    .select(select)
    .from(s.activities)
    .innerJoin(owner, eq(owner.id, s.activities.ownerId))
    .leftJoin(s.opportunities, eq(s.opportunities.id, s.activities.opportunityId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.activities.contactId));
}

const vis = (auth: AuthContext) =>
  visibility(auth, { tenantId: s.activities.tenantId, ownerId: s.activities.ownerId, deletedAt: s.activities.deletedAt }, 'activity.read_all');

async function load(db: DbOrTx, auth: AuthContext, id: string) {
  const [row] = await query(db).where(and(eq(s.activities.id, id), vis(auth))).limit(1);
  if (!row) throw notFound('Atividade');
  return row;
}

function dto(r: Awaited<ReturnType<typeof load>>, now = new Date()) {
  return { ...r, overdue: isOverdue(r.dueAt, r.completedAt, now) };
}

export const activityRoutes = [
  defineRoute({
    method: 'GET',
    url: '/activities',
    summary: 'Lista atividades (minhas/equipe; abertas, atrasadas, hoje, concluídas)',
    tag: 'Atividades',
    permission: 'activity.read',
    query: ActivityListQuery,
    handler: async ({ app, auth, query: q }) => {
      if (q.scope === 'equipe' && !auth.permissions.has('activity.read_all')) throw forbidden('Sem permissão para ver atividades da equipe.');
      const where: SQL[] = [vis(auth)];
      if (q.scope === 'minhas') where.push(eq(s.activities.ownerId, auth.userId));
      const tz = auth.timezone;
      if (q.status === 'abertas') where.push(isNull(s.activities.completedAt));
      if (q.status === 'concluidas') where.push(isNotNull(s.activities.completedAt));
      if (q.status === 'atrasadas') where.push(isNull(s.activities.completedAt), lt(s.activities.dueAt, sql`now()`));
      if (q.status === 'hoje') {
        where.push(isNull(s.activities.completedAt), sql`(${s.activities.dueAt} at time zone ${tz})::date = (now() at time zone ${tz})::date`);
      }
      if (q.opportunityId) where.push(eq(s.activities.opportunityId, q.opportunityId));
      if (q.leadId) where.push(eq(s.activities.leadId, q.leadId));
      if (q.contactId) where.push(eq(s.activities.contactId, q.contactId));
      const cond = and(...where);
      const order = q.status === 'concluidas' ? [desc(s.activities.completedAt)] : [sql`${s.activities.dueAt} asc nulls last`, asc(s.activities.createdAt)];
      const [rows, [{ total } = { total: 0 }], counts] = await Promise.all([
        query(app.db).where(cond).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
        app.db.select({ total: sql<number>`count(*)::int` }).from(s.activities).where(cond),
        app.db
          .select({
            overdue: sql<number>`count(*) filter (where ${s.activities.completedAt} is null and ${s.activities.dueAt} < now())::int`,
            today: sql<number>`count(*) filter (where ${s.activities.completedAt} is null and (${s.activities.dueAt} at time zone ${tz})::date = (now() at time zone ${tz})::date)::int`,
            open: sql<number>`count(*) filter (where ${s.activities.completedAt} is null)::int`,
          })
          .from(s.activities)
          .where(and(vis(auth), q.scope === 'minhas' ? eq(s.activities.ownerId, auth.userId) : undefined)),
      ]);
      const now = new Date();
      return { items: rows.map((r) => dto(r, now)), page: q.page, pageSize: q.pageSize, total, counts: counts[0] };
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/activities',
    summary: 'Cria atividade (idempotente para lembretes idênticos em aberto)',
    tag: 'Atividades',
    permission: 'activity.create',
    body: ActivityCreate,
    handler: async ({ app, auth, body, reply }) => {
      const ownerId = body.ownerId ?? auth.userId;
      const result = await app.db.transaction(async (tx) => {
        // atribuir a outra pessoa exige visão de equipe
        await assertAssignableUser(tx, auth, ownerId, 'activity.read_all');
        await assertTenantRefs(tx, auth, { contactId: body.contactId });
        let contactId = body.contactId ?? null;
        if (body.opportunityId) {
          const opp = await loadOpportunity(tx, auth, body.opportunityId);
          contactId = contactId ?? opp.contactId;
        }
        if (body.leadId) {
          const [l] = await tx.select({ contactId: s.leads.contactId }).from(s.leads).where(and(eq(s.leads.id, body.leadId), eq(s.leads.tenantId, auth.tenantId))).limit(1);
          if (!l) throw notFound('Lead');
          contactId = contactId ?? l.contactId;
        }
        const dueAt = body.dueAt ? new Date(body.dueAt) : null;
        // evita lembrete duplicado (duplo clique, retry de rede)
        const dup = await tx
          .select({ id: s.activities.id })
          .from(s.activities)
          .where(
            and(
              eq(s.activities.tenantId, auth.tenantId),
              eq(s.activities.ownerId, ownerId),
              eq(s.activities.type, body.type),
              eq(s.activities.title, body.title),
              isNull(s.activities.completedAt),
              isNull(s.activities.deletedAt),
              body.opportunityId ? eq(s.activities.opportunityId, body.opportunityId) : isNull(s.activities.opportunityId),
              dueAt ? eq(s.activities.dueAt, dueAt) : isNull(s.activities.dueAt),
            ),
          )
          .limit(1);
        if (dup[0]) return { id: dup[0].id, created: false };
        const [a] = await tx
          .insert(s.activities)
          .values({
            tenantId: auth.tenantId,
            type: body.type,
            title: body.title,
            notes: body.notes,
            dueAt,
            priority: body.priority,
            ownerId,
            opportunityId: body.opportunityId ?? null,
            leadId: body.leadId ?? null,
            contactId,
            createdBy: auth.userId,
          })
          .returning({ id: s.activities.id });
        await tx.insert(s.activityEvents).values({ tenantId: auth.tenantId, activityId: a!.id, type: 'created', actorId: auth.userId, payload: { dueAt: dueAt?.toISOString() ?? null, type: body.type } });
        return { id: a!.id, created: true };
      });
      reply.code(result.created ? 201 : 200);
      return { ...dto(await load(app.db, auth, result.id)), deduplicated: !result.created };
    },
  }),

  defineRoute({
    method: 'PATCH',
    url: '/activities/:id',
    summary: 'Conclui, reabre, reagenda ou edita atividade',
    tag: 'Atividades',
    permission: 'activity.update',
    params: IdParams,
    body: ActivityUpdate,
    handler: async ({ app, auth, params, body }) => {
      await app.db.transaction(async (tx) => {
        const cur = await load(tx, auth, params.id);
        if (cur.rowVersion !== body.rowVersion) throw conflict(cur.rowVersion);
        if (body.ownerId && body.ownerId !== cur.ownerId) await assertAssignableUser(tx, auth, body.ownerId, 'activity.read_all');
        const now = new Date();
        const dueAt = body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null;
        const events: { type: string; payload: Record<string, unknown> }[] = [];
        if (body.completed === true && !cur.completedAt) events.push({ type: 'completed', payload: {} });
        if (body.completed === false && cur.completedAt) events.push({ type: 'reopened', payload: {} });
        if (dueAt !== undefined && (dueAt?.getTime() ?? null) !== (cur.dueAt?.getTime() ?? null)) {
          events.push({ type: 'rescheduled', payload: { from: cur.dueAt?.toISOString() ?? null, to: dueAt?.toISOString() ?? null } });
        }
        if (body.ownerId && body.ownerId !== cur.ownerId) events.push({ type: 'assigned', payload: { from: cur.ownerId, to: body.ownerId } });
        if (body.title || body.priority || body.notes !== undefined) events.push({ type: 'updated', payload: {} });
        const updated = await tx
          .update(s.activities)
          .set({
            title: body.title,
            priority: body.priority,
            notes: body.notes,
            ownerId: body.ownerId,
            dueAt,
            completedAt: body.completed === undefined ? undefined : body.completed ? cur.completedAt ?? now : null,
            completedBy: body.completed === undefined ? undefined : body.completed ? auth.userId : null,
            updatedAt: now,
            rowVersion: sql`${s.activities.rowVersion} + 1`,
          })
          .where(and(eq(s.activities.id, params.id), eq(s.activities.tenantId, auth.tenantId), eq(s.activities.rowVersion, body.rowVersion)))
          .returning({ id: s.activities.id });
        if (!updated.length) throw conflict(cur.rowVersion);
        for (const e of events) await tx.insert(s.activityEvents).values({ tenantId: auth.tenantId, activityId: params.id, type: e.type, actorId: auth.userId, payload: e.payload });
      });
      return dto(await load(app.db, auth, params.id));
    },
  }),
];
