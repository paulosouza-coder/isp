import type { ActivityPriority, ActivityType, CoverageStatus, ContractRequestStatus, LeadStatus, OpportunityReason, OpportunityStage, ProposalStatus } from '@isp/domain';

export type Me = {
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string; timezone: string };
  roles: string[];
  permissions: string[];
  teamIds: string[];
};

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

export type Lookups = {
  users: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  campaigns: { id: string; name: string; sourceId: string | null }[];
  stages: { key: OpportunityStage; name: string; position: number; isTerminal: boolean }[];
  teams: { id: string; name: string }[];
};

export type Lead = {
  id: string;
  status: LeadStatus;
  interests: string[];
  nextAction: string | null;
  nextActionAt: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  notes: string | null;
  convertedOpportunityId: string | null;
  createdAt: string;
  rowVersion: number;
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  piiMasked: boolean;
  ownerId: string | null;
  ownerName: string | null;
  sourceId: string | null;
  sourceName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  temperature: { level: 'quente' | 'morno' | 'frio'; score: number; reasons: string[] };
  sla: { state: 'cumprido' | 'cumprido_atrasado' | 'violado' | 'no_prazo'; deadline: string };
};

export type Opportunity = {
  id: string;
  code: number;
  title: string;
  stage: OpportunityStage;
  proposalStatus: ProposalStatus;
  contractRequestStatus: ContractRequestStatus;
  coverageStatus: CoverageStatus;
  reasons: OpportunityReason[];
  channel: string | null;
  valueCents: number | null;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  lossReason: string | null;
  stageChangedAt: string;
  wonAt: string | null;
  lostAt: string | null;
  sprintStartedAt: string | null;
  sprintElapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  leadId: string | null;
  customerId: string | null;
  customerLifecycle: string | null;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactProvisional: boolean;
  piiMasked: boolean;
  ownerId: string;
  ownerName: string;
  sourceId: string | null;
  sourceName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  ageDays: number;
  daysInStage: number;
  overdue: boolean;
  missingNextAction: boolean;
};

export type PipelineStage = { key: OpportunityStage; name: string; isTerminal: boolean; count: number; valueCents: number; cards: Opportunity[] };

export type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  notes: string | null;
  dueAt: string | null;
  priority: ActivityPriority;
  completedAt: string | null;
  createdAt: string;
  rowVersion: number;
  ownerId: string;
  ownerName: string;
  opportunityId: string | null;
  opportunityTitle: string | null;
  opportunityCode: number | null;
  contactId: string | null;
  contactName: string | null;
  overdue: boolean;
};

export type TimelineItem = {
  kind: 'opportunity' | 'activity';
  id: string;
  type: string;
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  occurredAt: string;
  observedAt: string;
  sourceSystem: string;
  actorName: string | null;
  title?: string;
  activityType?: string;
};

export type Kpi = {
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
