import { z } from 'zod';
import {
  OPPORTUNITY_STAGES, LEAD_STATUSES, OPPORTUNITY_REASONS, LOSS_REASONS, ACTIVITY_TYPES, ACTIVITY_PRIORITIES,
} from '@isp/domain';

const trimmed = (max: number) => z.string().trim().max(max);
const optText = (max: number) => trimmed(max).optional().nullable().transform((v) => (v ? v : null));
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[\d\s()+\-.]*$/, 'Telefone deve conter apenas números e ( ) + - .')
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const email = z.string().trim().toLowerCase().email('E-mail inválido').max(200).optional().nullable().or(z.literal('').transform(() => null));
const cents = z.number().int().min(0).max(100_000_000);
const rowVersion = z.number().int().min(1);

// ------------------------------------------------------------------ auth
export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

// ------------------------------------------------------------------ paginação
export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// ------------------------------------------------------------------ contatos
export const ContactCreate = z.object({
  name: trimmed(160).min(2, 'Informe ao menos 2 caracteres'),
  phone,
  email,
});
export type ContactCreate = z.infer<typeof ContactCreate>;

// ------------------------------------------------------------------ leads
export const LEAD_SORTS = ['created_at', 'name', 'next_action_at', 'last_contact_at', 'status'] as const;
export const LeadListQuery = PageQuery.extend({
  q: trimmed(100).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  ownerId: z.union([uuid, z.literal('me'), z.literal('none')]).optional(),
  sourceId: uuid.optional(),
  sort: z.enum(LEAD_SORTS).default('created_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type LeadListQuery = z.infer<typeof LeadListQuery>;

export const LeadCreate = z.object({
  name: trimmed(160).min(2, 'Informe ao menos 2 caracteres'),
  phone,
  email,
  sourceId: uuid.optional().nullable(),
  campaignId: uuid.optional().nullable(),
  interests: z.array(trimmed(40).min(1)).max(10).default([]),
  ownerId: uuid.optional().nullable(),
  nextAction: optText(200),
  nextActionAt: isoDate.optional().nullable(),
  notes: optText(2000),
});
export type LeadCreate = z.infer<typeof LeadCreate>;

export const LeadUpdate = LeadCreate.partial().extend({
  status: z.enum(LEAD_STATUSES).optional(),
  lastContactAt: isoDate.optional().nullable(),
  rowVersion,
});
export type LeadUpdate = z.infer<typeof LeadUpdate>;

export const BulkAssign = z.object({
  ids: z.array(uuid).min(1).max(200),
  ownerId: uuid,
});

// ------------------------------------------------------------------ oportunidades
export const OPPORTUNITY_SORTS = ['updated_at', 'created_at', 'title', 'value_cents', 'next_action_at', 'stage'] as const;
export const OpportunityListQuery = PageQuery.extend({
  q: trimmed(100).optional(),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  ownerId: z.union([uuid, z.literal('me')]).optional(),
  sourceId: uuid.optional(),
  status: z.enum(['abertas', 'encerradas', 'todas']).default('abertas'),
  sort: z.enum(OPPORTUNITY_SORTS).default('updated_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type OpportunityListQuery = z.infer<typeof OpportunityListQuery>;

export const OpportunityCreate = z
  .object({
    contactId: uuid.optional().nullable(),
    newContact: ContactCreate.optional().nullable(),
    leadId: uuid.optional().nullable(),
    title: optText(160),
    sourceId: uuid.optional().nullable(),
    campaignId: uuid.optional().nullable(),
    channel: optText(40),
    reasons: z.array(z.enum(OPPORTUNITY_REASONS)).max(6).default([]),
    ownerId: uuid.optional().nullable(),
    valueCents: cents.optional().nullable(),
  })
  .refine((v) => !!v.contactId !== !!v.newContact, {
    message: 'Selecione um contato existente ou informe um novo contato (apenas um).',
    path: ['contactId'],
  });
export type OpportunityCreate = z.infer<typeof OpportunityCreate>;

export const OpportunityUpdate = z.object({
  title: optText(160),
  ownerId: uuid.optional(),
  sourceId: uuid.optional().nullable(),
  campaignId: uuid.optional().nullable(),
  channel: optText(40),
  reasons: z.array(z.enum(OPPORTUNITY_REASONS)).max(6).optional(),
  valueCents: cents.optional().nullable(),
  nextAction: optText(200),
  nextActionAt: isoDate.optional().nullable(),
  notes: optText(4000),
  rowVersion,
});
export type OpportunityUpdate = z.infer<typeof OpportunityUpdate>;

export const OpportunityTransition = z.object({
  toStage: z.enum(OPPORTUNITY_STAGES),
  reason: optText(500),
  lossReason: z.enum(LOSS_REASONS).optional().nullable(),
  confirm: z.boolean().optional(),
  rowVersion,
});
export type OpportunityTransition = z.infer<typeof OpportunityTransition>;

// ------------------------------------------------------------------ atividades
export const ActivityListQuery = PageQuery.extend({
  scope: z.enum(['minhas', 'equipe']).default('minhas'),
  status: z.enum(['abertas', 'atrasadas', 'hoje', 'concluidas', 'todas']).default('abertas'),
  opportunityId: uuid.optional(),
  leadId: uuid.optional(),
  contactId: uuid.optional(),
});
export type ActivityListQuery = z.infer<typeof ActivityListQuery>;

export const ActivityCreate = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: trimmed(200).min(2, 'Descreva a atividade'),
  dueAt: isoDate.optional().nullable(),
  priority: z.enum(ACTIVITY_PRIORITIES).default('media'),
  ownerId: uuid.optional().nullable(),
  opportunityId: uuid.optional().nullable(),
  leadId: uuid.optional().nullable(),
  contactId: uuid.optional().nullable(),
  notes: optText(2000),
});
export type ActivityCreate = z.infer<typeof ActivityCreate>;

export const ActivityUpdate = z.object({
  title: trimmed(200).min(2).optional(),
  dueAt: isoDate.optional().nullable(),
  priority: z.enum(ACTIVITY_PRIORITIES).optional(),
  ownerId: uuid.optional(),
  notes: optText(2000),
  completed: z.boolean().optional(),
  rowVersion,
});
export type ActivityUpdate = z.infer<typeof ActivityUpdate>;

// ------------------------------------------------------------------ clientes
export const CustomerListQuery = PageQuery.extend({
  q: trimmed(100).optional(),
  lifecycle: z.enum(['prospect', 'ativo', 'suspenso', 'cancelado', 'reativado']).optional(),
});

// ------------------------------------------------------------------ dashboard
export const DashboardQuery = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  scope: z.enum(['meu', 'equipe']).default('meu'),
});
export type DashboardQuery = z.infer<typeof DashboardQuery>;

// ------------------------------------------------------------------ erros
export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  requestId?: string;
  errors?: { path: string; message: string }[];
  currentRowVersion?: number;
};
