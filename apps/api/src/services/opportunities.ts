import type { FastifyRequest } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { maskEmail, maskPhone, type OpportunityReason } from '@isp/domain';
import type { ContactCreate } from '@isp/shared';
import type { DbOrTx } from '../db/client';
import * as s from '../db/schema';
import type { AuthContext } from '../http/context';
import { notFound } from '../http/errors';
import { assertAssignableUser, assertTenantRefs, visibility } from './scope';
import { audit } from './audit';

export type CreateOpportunityInput = {
  contactId?: string | null;
  newContact?: ContactCreate | null;
  leadId?: string | null;
  ownerId?: string | null;
  sourceId?: string | null;
  campaignId?: string | null;
  channel: string | null;
  reasons: OpportunityReason[];
  title: string | null;
  valueCents?: number | null;
};

/**
 * Cria a oportunidade e a persiste imediatamente (spec §4): ID, owner, origem, timestamps, versão
 * e evento "created". Contato novo é provisório, com dados mínimos.
 */
export async function createOpportunity(tx: DbOrTx, auth: AuthContext, req: FastifyRequest, input: CreateOpportunityInput) {
  const ownerId = input.ownerId ?? auth.userId;
  await assertAssignableUser(tx, auth, ownerId, 'opportunity.assign');
  await assertTenantRefs(tx, auth, { sourceId: input.sourceId, campaignId: input.campaignId, contactId: input.contactId });

  let contactId = input.contactId ?? null;
  let contactName: string;
  if (!contactId) {
    if (!input.newContact) throw notFound('Contato');
    const [c] = await tx
      .insert(s.contacts)
      .values({ tenantId: auth.tenantId, name: input.newContact.name, phone: input.newContact.phone, email: input.newContact.email, isProvisional: true, createdBy: auth.userId })
      .returning({ id: s.contacts.id, name: s.contacts.name });
    contactId = c!.id;
    contactName = c!.name;
  } else {
    const [c] = await tx.select({ name: s.contacts.name }).from(s.contacts).where(and(eq(s.contacts.id, contactId), eq(s.contacts.tenantId, auth.tenantId))).limit(1);
    contactName = c!.name;
  }

  if (input.leadId) {
    const [l] = await tx.select({ id: s.leads.id }).from(s.leads).where(and(eq(s.leads.id, input.leadId), eq(s.leads.tenantId, auth.tenantId))).limit(1);
    if (!l) throw notFound('Lead');
  }

  const [customer] = await tx
    .select({ id: s.customers.id })
    .from(s.customers)
    .where(and(eq(s.customers.contactId, contactId), eq(s.customers.tenantId, auth.tenantId)))
    .limit(1);

  const [team] = await tx.select({ teamId: s.teamMemberships.teamId }).from(s.teamMemberships).where(eq(s.teamMemberships.userId, ownerId)).limit(1);
  const now = new Date();
  const [opp] = await tx
    .insert(s.opportunities)
    .values({
      tenantId: auth.tenantId,
      contactId,
      customerId: customer?.id ?? null,
      leadId: input.leadId ?? null,
      ownerId,
      teamId: team?.teamId ?? null,
      title: input.title ?? `${contactName} — nova oportunidade`,
      reasons: input.reasons,
      channel: input.channel,
      sourceId: input.sourceId ?? null,
      campaignId: input.campaignId ?? null,
      valueCents: input.valueCents ?? null,
      sprintStartedAt: now,
      createdBy: auth.userId,
    })
    .returning({ id: s.opportunities.id, code: s.opportunities.code });
  await tx.insert(s.opportunityEvents).values({
    tenantId: auth.tenantId,
    opportunityId: opp!.id,
    type: 'created',
    actorId: auth.userId,
    toValue: 'novo',
    rowVersion: 1,
    payload: { reasons: input.reasons, channel: input.channel, fromLead: input.leadId ?? null, provisionalContact: !input.contactId },
  });
  await audit(tx, req, { action: 'opportunity.create', entityType: 'opportunity', entityId: opp!.id });
  return opp!;
}

const owner = alias(s.users, 'opp_owner');

export const opportunitySelect = {
  id: s.opportunities.id,
  code: s.opportunities.code,
  title: s.opportunities.title,
  stage: s.opportunities.stage,
  proposalStatus: s.opportunities.proposalStatus,
  contractRequestStatus: s.opportunities.contractRequestStatus,
  coverageStatus: s.opportunities.coverageStatus,
  reasons: s.opportunities.reasons,
  channel: s.opportunities.channel,
  valueCents: s.opportunities.valueCents,
  nextAction: s.opportunities.nextAction,
  nextActionAt: s.opportunities.nextActionAt,
  notes: s.opportunities.notes,
  lossReason: s.opportunities.lossReason,
  stageChangedAt: s.opportunities.stageChangedAt,
  wonAt: s.opportunities.wonAt,
  lostAt: s.opportunities.lostAt,
  sprintStartedAt: s.opportunities.sprintStartedAt,
  sprintElapsedSeconds: s.opportunities.sprintElapsedSeconds,
  createdAt: s.opportunities.createdAt,
  updatedAt: s.opportunities.updatedAt,
  rowVersion: s.opportunities.rowVersion,
  leadId: s.opportunities.leadId,
  customerId: s.opportunities.customerId,
  customerLifecycle: s.customers.lifecycle,
  contactId: s.contacts.id,
  contactName: s.contacts.name,
  contactPhone: s.contacts.phone,
  contactEmail: s.contacts.email,
  contactProvisional: s.contacts.isProvisional,
  ownerId: s.opportunities.ownerId,
  ownerName: owner.name,
  sourceId: s.opportunities.sourceId,
  sourceName: s.leadSources.name,
  campaignId: s.opportunities.campaignId,
  campaignName: s.campaigns.name,
};

export function opportunityQuery(db: DbOrTx) {
  return db
    .select(opportunitySelect)
    .from(s.opportunities)
    .innerJoin(s.contacts, eq(s.contacts.id, s.opportunities.contactId))
    .innerJoin(owner, eq(owner.id, s.opportunities.ownerId))
    .leftJoin(s.customers, eq(s.customers.id, s.opportunities.customerId))
    .leftJoin(s.leadSources, eq(s.leadSources.id, s.opportunities.sourceId))
    .leftJoin(s.campaigns, eq(s.campaigns.id, s.opportunities.campaignId));
}

export function oppVisibility(auth: AuthContext) {
  return visibility(auth, { tenantId: s.opportunities.tenantId, ownerId: s.opportunities.ownerId, deletedAt: s.opportunities.deletedAt }, 'opportunity.read_all');
}

export async function loadOpportunity(db: DbOrTx, auth: AuthContext, id: string) {
  const [row] = await opportunityQuery(db).where(and(eq(s.opportunities.id, id), oppVisibility(auth))).limit(1);
  if (!row) throw notFound('Oportunidade');
  return row;
}

export type OpportunityRow = Awaited<ReturnType<typeof loadOpportunity>>;

export function opportunityDto(r: OpportunityRow, auth: AuthContext, now = new Date()) {
  const pii = auth.permissions.has('customer.pii.read');
  const open = r.stage !== 'ganha' && r.stage !== 'perdida';
  return {
    ...r,
    contactPhone: pii ? r.contactPhone : maskPhone(r.contactPhone),
    contactEmail: pii ? r.contactEmail : maskEmail(r.contactEmail),
    piiMasked: !pii,
    ageDays: Math.floor((now.getTime() - r.createdAt.getTime()) / 86_400_000),
    daysInStage: Math.floor((now.getTime() - r.stageChangedAt.getTime()) / 86_400_000),
    overdue: open && !!r.nextActionAt && r.nextActionAt < now,
    missingNextAction: open && !r.nextAction && !r.nextActionAt,
  };
}

export const bumpVersion = () => sql`${s.opportunities.rowVersion} + 1`;
