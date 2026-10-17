import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { BulkAssign, LeadCreate, LeadListQuery, LeadUpdate } from '@isp/shared';
import { leadSla, leadTemperature, maskEmail, maskPhone } from '@isp/domain';
import { defineRoute, IdParams } from '../http/route';
import { conflict, notFound, unprocessable } from '../http/errors';
import type { AuthContext } from '../http/context';
import * as s from '../db/schema';
import type { DbOrTx } from '../db/client';
import { assertAssignableUser, assertTenantRefs, visibility } from '../services/scope';
import { audit } from '../services/audit';
import { createOpportunity } from '../services/opportunities';

const owner = alias(s.users, 'owner');

const leadSelect = {
  id: s.leads.id,
  status: s.leads.status,
  interests: s.leads.interests,
  nextAction: s.leads.nextAction,
  nextActionAt: s.leads.nextActionAt,
  firstContactAt: s.leads.firstContactAt,
  lastContactAt: s.leads.lastContactAt,
  notes: s.leads.notes,
  convertedOpportunityId: s.leads.convertedOpportunityId,
  createdAt: s.leads.createdAt,
  updatedAt: s.leads.updatedAt,
  rowVersion: s.leads.rowVersion,
  contactId: s.contacts.id,
  name: s.contacts.name,
  phone: s.contacts.phone,
  email: s.contacts.email,
  ownerId: s.leads.ownerId,
  ownerName: owner.name,
  sourceId: s.leads.sourceId,
  sourceName: s.leadSources.name,
  campaignId: s.leads.campaignId,
  campaignName: s.campaigns.name,
};

type LeadRow = Awaited<ReturnType<typeof loadLead>>;

function toDto(r: LeadRow, auth: AuthContext, now = new Date()) {
  const pii = auth.permissions.has('customer.pii.read');
  return {
    ...r,
    phone: pii ? r.phone : maskPhone(r.phone),
    email: pii ? r.email : maskEmail(r.email),
    piiMasked: !pii,
    temperature: leadTemperature({ now, createdAt: r.createdAt, lastContactAt: r.lastContactAt, nextActionAt: r.nextActionAt, interests: r.interests, status: r.status }),
    sla: leadSla(r.createdAt, r.firstContactAt, now),
  };
}

function baseQuery(db: DbOrTx) {
  return db
    .select(leadSelect)
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(owner, eq(owner.id, s.leads.ownerId))
    .leftJoin(s.leadSources, eq(s.leadSources.id, s.leads.sourceId))
    .leftJoin(s.campaigns, eq(s.campaigns.id, s.leads.campaignId));
}

async function loadLead(db: DbOrTx, auth: AuthContext, id: string) {
  const [row] = await baseQuery(db)
    .where(and(eq(s.leads.id, id), visibility(auth, { tenantId: s.leads.tenantId, ownerId: s.leads.ownerId, deletedAt: s.leads.deletedAt }, 'lead.read_all')))
    .limit(1);
  if (!row) throw notFound('Lead');
  return row;
}

const SORT_COLUMNS = {
  created_at: s.leads.createdAt,
  name: s.contacts.name,
  next_action_at: s.leads.nextActionAt,
  last_contact_at: s.leads.lastContactAt,
  status: s.leads.status,
} as const;

export const leadRoutes = [
  defineRoute({
    method: 'GET',
    url: '/leads',
    summary: 'Lista leads com busca, filtros, ordenação e paginação',
    tag: 'Leads',
    permission: 'lead.read',
    query: LeadListQuery,
    handler: async ({ app, auth, query }) => {
      const where: SQL[] = [visibility(auth, { tenantId: s.leads.tenantId, ownerId: s.leads.ownerId, deletedAt: s.leads.deletedAt }, 'lead.read_all')];
      if (query.q) {
        const term = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`;
        where.push(or(ilike(s.contacts.name, term), ilike(s.contacts.phone, term), ilike(s.contacts.email, term))!);
      }
      if (query.status) where.push(eq(s.leads.status, query.status));
      if (query.sourceId) where.push(eq(s.leads.sourceId, query.sourceId));
      if (query.ownerId === 'me') where.push(eq(s.leads.ownerId, auth.userId));
      else if (query.ownerId === 'none') where.push(isNull(s.leads.ownerId));
      else if (query.ownerId) where.push(eq(s.leads.ownerId, query.ownerId));
      const cond = and(...where);
      const col = SORT_COLUMNS[query.sort];
      const order = query.dir === 'asc' ? sql`${col} asc nulls last` : sql`${col} desc nulls last`;
      const [rows, [{ total } = { total: 0 }]] = await Promise.all([
        baseQuery(app.db).where(cond).orderBy(order, desc(s.leads.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
        app.db
          .select({ total: sql<number>`count(*)::int` })
          .from(s.leads)
          .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
          .where(cond),
      ]);
      const now = new Date();
      return { items: rows.map((r) => toDto(r, auth, now)), page: query.page, pageSize: query.pageSize, total };
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/leads/:id',
    summary: 'Detalhe do lead',
    tag: 'Leads',
    permission: 'lead.read',
    params: IdParams,
    handler: async ({ app, auth, params }) => toDto(await loadLead(app.db, auth, params.id), auth),
  }),

  defineRoute({
    method: 'POST',
    url: '/leads',
    summary: 'Cria lead (e o contato associado)',
    tag: 'Leads',
    permission: 'lead.create',
    body: LeadCreate,
    handler: async ({ app, auth, body, reply, req }) => {
      const ownerId = body.ownerId ?? auth.userId;
      const id = await app.db.transaction(async (tx) => {
        await assertAssignableUser(tx, auth, ownerId, 'lead.assign');
        await assertTenantRefs(tx, auth, { sourceId: body.sourceId, campaignId: body.campaignId });
        const [contact] = await tx
          .insert(s.contacts)
          .values({ tenantId: auth.tenantId, name: body.name, phone: body.phone, email: body.email, createdBy: auth.userId })
          .returning({ id: s.contacts.id });
        const [lead] = await tx
          .insert(s.leads)
          .values({
            tenantId: auth.tenantId,
            contactId: contact!.id,
            ownerId,
            sourceId: body.sourceId ?? null,
            campaignId: body.campaignId ?? null,
            interests: body.interests,
            nextAction: body.nextAction,
            nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
            notes: body.notes,
            createdBy: auth.userId,
          })
          .returning({ id: s.leads.id });
        await audit(tx, req, { action: 'lead.create', entityType: 'lead', entityId: lead!.id });
        return lead!.id;
      });
      reply.code(201);
      return toDto(await loadLead(app.db, auth, id), auth);
    },
  }),

  defineRoute({
    method: 'PATCH',
    url: '/leads/:id',
    summary: 'Atualiza lead (concorrência otimista por rowVersion)',
    tag: 'Leads',
    permission: 'lead.update',
    params: IdParams,
    body: LeadUpdate,
    handler: async ({ app, auth, params, body, req }) => {
      await app.db.transaction(async (tx) => {
        const current = await loadLead(tx, auth, params.id);
        if (current.rowVersion !== body.rowVersion) throw conflict(current.rowVersion as number);
        if (body.ownerId !== undefined && body.ownerId !== current.ownerId) {
          if (!body.ownerId) throw unprocessable('Responsável obrigatório.');
          await assertAssignableUser(tx, auth, body.ownerId, 'lead.assign');
          await audit(tx, req, { action: 'lead.assign', entityType: 'lead', entityId: params.id, metadata: { from: current.ownerId, to: body.ownerId } });
        }
        await assertTenantRefs(tx, auth, { sourceId: body.sourceId, campaignId: body.campaignId });

        const contactPatch: Partial<typeof s.contacts.$inferInsert> = {};
        if (body.name !== undefined) contactPatch.name = body.name;
        if (body.phone !== undefined) contactPatch.phone = body.phone;
        if (body.email !== undefined) contactPatch.email = body.email;
        if (Object.keys(contactPatch).length) {
          await tx
            .update(s.contacts)
            .set({ ...contactPatch, updatedAt: new Date(), rowVersion: sql`${s.contacts.rowVersion} + 1` })
            .where(and(eq(s.contacts.id, current.contactId as string), eq(s.contacts.tenantId, auth.tenantId)));
        }
        const lastContact = body.lastContactAt ? new Date(body.lastContactAt) : undefined;
        const patch: Partial<typeof s.leads.$inferInsert> = {
          status: body.status,
          ownerId: body.ownerId ?? undefined,
          sourceId: body.sourceId,
          campaignId: body.campaignId,
          interests: body.interests,
          nextAction: body.nextAction,
          nextActionAt: body.nextActionAt === undefined ? undefined : body.nextActionAt ? new Date(body.nextActionAt) : null,
          notes: body.notes,
          lastContactAt: body.lastContactAt === undefined ? undefined : lastContact ?? null,
          firstContactAt: lastContact && !current.firstContactAt ? lastContact : undefined,
        };
        if (body.status === 'convertido') throw unprocessable('Use "Converter em oportunidade" para converter o lead.');
        const updated = await tx
          .update(s.leads)
          .set({ ...patch, updatedAt: new Date(), rowVersion: sql`${s.leads.rowVersion} + 1` })
          .where(and(eq(s.leads.id, params.id), eq(s.leads.tenantId, auth.tenantId), eq(s.leads.rowVersion, body.rowVersion)))
          .returning({ id: s.leads.id });
        if (!updated.length) throw conflict(current.rowVersion as number);
      });
      return toDto(await loadLead(app.db, auth, params.id), auth);
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/leads/bulk-assign',
    summary: 'Atribui vários leads a um responsável (auditado)',
    tag: 'Leads',
    permission: ['lead.read_all', 'lead.assign'],
    body: BulkAssign,
    handler: async ({ app, auth, body, req }) => {
      return app.db.transaction(async (tx) => {
        await assertAssignableUser(tx, auth, body.ownerId, 'lead.assign');
        const rows = await tx
          .update(s.leads)
          .set({ ownerId: body.ownerId, updatedAt: new Date(), rowVersion: sql`${s.leads.rowVersion} + 1` })
          .where(and(eq(s.leads.tenantId, auth.tenantId), inArray(s.leads.id, body.ids), isNull(s.leads.deletedAt)))
          .returning({ id: s.leads.id });
        await audit(tx, req, { action: 'lead.bulk_assign', entityType: 'lead', metadata: { ownerId: body.ownerId, count: rows.length, ids: rows.map((r) => r.id) } });
        return { updated: rows.length };
      });
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/leads/:id/convert',
    summary: 'Converte lead em oportunidade (mantém vínculo e histórico)',
    tag: 'Leads',
    permission: ['lead.update', 'opportunity.create'],
    params: IdParams,
    body: z.object({ rowVersion: z.number().int().min(1) }),
    handler: async ({ app, auth, params, body, req, reply }) => {
      const result = await app.db.transaction(async (tx) => {
        const lead = await loadLead(tx, auth, params.id);
        if (lead.rowVersion !== body.rowVersion) throw conflict(lead.rowVersion as number);
        if (lead.status === 'convertido' && lead.convertedOpportunityId) {
          return { opportunityId: lead.convertedOpportunityId as string, created: false };
        }
        if (lead.status === 'descartado') throw unprocessable('Lead descartado não pode ser convertido. Reative-o antes.');
        const opp = await createOpportunity(tx, auth, req, {
          contactId: lead.contactId as string,
          leadId: lead.id as string,
          ownerId: (lead.ownerId as string | null) ?? auth.userId,
          sourceId: lead.sourceId as string | null,
          campaignId: lead.campaignId as string | null,
          reasons: [],
          title: null,
          channel: null,
          valueCents: null,
        });
        await tx
          .update(s.leads)
          .set({ status: 'convertido', convertedOpportunityId: opp.id, updatedAt: new Date(), rowVersion: sql`${s.leads.rowVersion} + 1` })
          .where(and(eq(s.leads.id, params.id), eq(s.leads.tenantId, auth.tenantId)));
        return { opportunityId: opp.id, created: true };
      });
      reply.code(result.created ? 201 : 200);
      return result;
    },
  }),
];
