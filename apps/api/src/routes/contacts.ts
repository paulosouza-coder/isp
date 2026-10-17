import { and, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { ContactCreate, CustomerListQuery } from '@isp/shared';
import { maskEmail, maskPhone } from '@isp/domain';
import { defineRoute, IdParams } from '../http/route';
import { notFound } from '../http/errors';
import type { AuthContext } from '../http/context';
import * as s from '../db/schema';
import { audit } from '../services/audit';
import { opportunityDto, opportunityQuery, oppVisibility } from '../services/opportunities';

const like = (q: string) => `%${q.replace(/[%_\\]/g, '\\$&')}%`;

function contactPii<T extends { phone: string | null; email: string | null }>(auth: AuthContext, c: T) {
  const pii = auth.permissions.has('customer.pii.read');
  return { ...c, phone: pii ? c.phone : maskPhone(c.phone), email: pii ? c.email : maskEmail(c.email), piiMasked: !pii };
}

/** Oportunidades visíveis ao usuário para um contato (respeita escopo próprio × equipe). */
const visibleOppCount = (auth: AuthContext) =>
  auth.permissions.has('opportunity.read_all')
    ? sql<number>`(select count(*)::int from opportunities o where o.contact_id = ${s.contacts.id} and o.tenant_id = ${auth.tenantId} and o.deleted_at is null)`
    : sql<number>`(select count(*)::int from opportunities o where o.contact_id = ${s.contacts.id} and o.tenant_id = ${auth.tenantId} and o.deleted_at is null and o.owner_id = ${auth.userId})`;

export const contactRoutes = [
  defineRoute({
    method: 'GET',
    url: '/contacts',
    summary: 'Busca de contatos (combobox da nova oportunidade)',
    tag: 'Clientes',
    permission: 'customer.read',
    query: z.object({ q: z.string().trim().min(2).max(100) }),
    handler: async ({ app, auth, query }) => {
      const rows = await app.db
        .select({
          id: s.contacts.id,
          name: s.contacts.name,
          phone: s.contacts.phone,
          email: s.contacts.email,
          customerId: s.customers.id,
          lifecycle: s.customers.lifecycle,
          externalId: s.customers.externalId,
        })
        .from(s.contacts)
        .leftJoin(s.customers, eq(s.customers.contactId, s.contacts.id))
        .where(
          and(
            eq(s.contacts.tenantId, auth.tenantId),
            isNull(s.contacts.deletedAt),
            or(ilike(s.contacts.name, like(query.q)), ilike(s.contacts.phone, like(query.q)), ilike(s.contacts.email, like(query.q)), eq(s.customers.externalId, query.q)),
          ),
        )
        .orderBy(sql`${s.customers.id} is null`, s.contacts.name)
        .limit(10);
      return { items: rows.map((r) => contactPii(auth, r)) };
    },
  }),

  defineRoute({
    method: 'POST',
    url: '/contacts',
    summary: 'Cria contato',
    tag: 'Clientes',
    permission: 'customer.create',
    body: ContactCreate,
    handler: async ({ app, auth, body, reply }) => {
      const [c] = await app.db.insert(s.contacts).values({ tenantId: auth.tenantId, ...body, createdBy: auth.userId }).returning();
      reply.code(201);
      return contactPii(auth, { id: c!.id, name: c!.name, phone: c!.phone, email: c!.email });
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/customers',
    summary: 'Lista pessoas/clientes com ciclo de vida e oportunidades',
    tag: 'Clientes',
    permission: 'customer.read',
    query: CustomerListQuery,
    handler: async ({ app, auth, query }) => {
      const where: SQL[] = [eq(s.contacts.tenantId, auth.tenantId), isNull(s.contacts.deletedAt)];
      if (query.q) where.push(or(ilike(s.contacts.name, like(query.q)), ilike(s.contacts.phone, like(query.q)), eq(s.customers.externalId, query.q))!);
      if (query.lifecycle === 'prospect') where.push(isNull(s.customers.id));
      else if (query.lifecycle) where.push(eq(s.customers.lifecycle, query.lifecycle));
      const cond = and(...where);
      const [rows, [{ total } = { total: 0 }]] = await Promise.all([
        app.db
          .select({
            id: s.contacts.id,
            name: s.contacts.name,
            phone: s.contacts.phone,
            email: s.contacts.email,
            isProvisional: s.contacts.isProvisional,
            createdAt: s.contacts.createdAt,
            customerId: s.customers.id,
            lifecycle: s.customers.lifecycle,
            externalId: s.customers.externalId,
            sourceSystem: s.customers.sourceSystem,
            ingestedAt: s.customers.ingestedAt,
            opportunities: visibleOppCount(auth),
          })
          .from(s.contacts)
          .leftJoin(s.customers, eq(s.customers.contactId, s.contacts.id))
          .where(cond)
          .orderBy(sql`${s.customers.id} is null`, s.contacts.name)
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
        app.db.select({ total: sql<number>`count(*)::int` }).from(s.contacts).leftJoin(s.customers, eq(s.customers.contactId, s.contacts.id)).where(cond),
      ]);
      return { items: rows.map((r) => ({ ...contactPii(auth, r), lifecycle: r.lifecycle ?? 'prospect' })), page: query.page, pageSize: query.pageSize, total };
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/contacts/:id',
    summary: 'Ficha do contato/cliente: identidade, IDs externos, oportunidades e atividades',
    tag: 'Clientes',
    permission: 'customer.read',
    params: IdParams,
    handler: async ({ app, auth, params, req }) => {
      const [c] = await app.db
        .select({
          id: s.contacts.id,
          name: s.contacts.name,
          phone: s.contacts.phone,
          email: s.contacts.email,
          isProvisional: s.contacts.isProvisional,
          createdAt: s.contacts.createdAt,
          customerId: s.customers.id,
          lifecycle: s.customers.lifecycle,
          sourceSystem: s.customers.sourceSystem,
          externalId: s.customers.externalId,
          sourceUpdatedAt: s.customers.sourceUpdatedAt,
          ingestedAt: s.customers.ingestedAt,
        })
        .from(s.contacts)
        .leftJoin(s.customers, eq(s.customers.contactId, s.contacts.id))
        .where(and(eq(s.contacts.id, params.id), eq(s.contacts.tenantId, auth.tenantId), isNull(s.contacts.deletedAt)))
        .limit(1);
      if (!c) throw notFound('Contato não encontrado.');
      const externalIds = c.customerId
        ? await app.db.select({ system: s.customerExternalIds.system, externalId: s.customerExternalIds.externalId }).from(s.customerExternalIds).where(and(eq(s.customerExternalIds.customerId, c.customerId), eq(s.customerExternalIds.tenantId, auth.tenantId)))
        : [];
      const opps = await opportunityQuery(app.db).where(and(eq(s.opportunities.contactId, params.id), oppVisibility(auth))).orderBy(desc(s.opportunities.updatedAt));
      const addresses = await app.db
        .select()
        .from(s.addresses)
        .where(and(eq(s.addresses.tenantId, auth.tenantId), or(eq(s.addresses.contactId, params.id), c.customerId ? eq(s.addresses.customerId, c.customerId) : undefined)))
        .orderBy(desc(s.addresses.validFrom));
      const staleHours = c.ingestedAt ? (Date.now() - c.ingestedAt.getTime()) / 3_600_000 : null;
      if (auth.permissions.has('customer.pii.read')) {
        await audit(app.db, req, { action: 'customer.pii_view', entityType: 'contact', entityId: params.id });
      }
      return {
        ...contactPii(auth, c),
        lifecycle: c.lifecycle ?? 'prospect',
        externalIds,
        addresses: auth.permissions.has('customer.pii.read') ? addresses : addresses.map((a) => ({ ...a, street: a.street ? '••••' : null, number: null, complement: null })),
        freshness: c.ingestedAt ? { ingestedAt: c.ingestedAt, stale: (staleHours ?? 0) > 24, staleHours } : null,
        opportunities: opps.map((o) => opportunityDto(o, auth)),
      };
    },
  }),
];
