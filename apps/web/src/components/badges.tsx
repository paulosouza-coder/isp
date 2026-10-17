import {
  ACTIVITY_TYPE_LABELS, CONTRACT_LABELS, COVERAGE_LABELS, LEAD_STATUS_LABELS, LIFECYCLE_LABELS, PRIORITY_LABELS, PROPOSAL_LABELS, STAGE_LABELS,
  type ActivityPriority, type ActivityType, type ContractRequestStatus, type CoverageStatus, type CustomerLifecycle, type LeadStatus, type OpportunityStage, type ProposalStatus,
} from '@isp/domain';
import { Flame, Snowflake, Thermometer } from 'lucide-react';
import { StatusChip, type Tone } from './ui/primitives';

const stageTone: Record<OpportunityStage, Tone> = {
  novo: 'neutral', descoberta: 'info', qualificacao: 'info', oferta: 'primary', negociacao: 'primary', retorno: 'warning', ganha: 'success', perdida: 'danger',
};
/** Cor de faixa por etapa (Kanban). Usa os mesmos tokens semânticos. */
export const stageStripe: Record<OpportunityStage, string> = {
  novo: 'bg-line-strong', descoberta: 'bg-info/60', qualificacao: 'bg-info', oferta: 'bg-primary/60', negociacao: 'bg-primary', retorno: 'bg-warning', ganha: 'bg-success', perdida: 'bg-danger',
};
export const StageChip = ({ stage }: { stage: OpportunityStage }) => <StatusChip tone={stageTone[stage]}>{STAGE_LABELS[stage]}</StatusChip>;

const leadTone: Record<LeadStatus, Tone> = { novo: 'info', em_contato: 'primary', qualificado: 'success', convertido: 'neutral', descartado: 'neutral' };
export const LeadStatusChip = ({ status }: { status: LeadStatus }) => <StatusChip tone={leadTone[status]}>{LEAD_STATUS_LABELS[status]}</StatusChip>;

export function TemperatureChip({ t }: { t: { level: 'quente' | 'morno' | 'frio'; reasons: string[] } }) {
  const map = { quente: { tone: 'danger' as Tone, icon: <Flame className="h-3 w-3" aria-hidden />, label: 'Quente' }, morno: { tone: 'warning' as Tone, icon: <Thermometer className="h-3 w-3" aria-hidden />, label: 'Morno' }, frio: { tone: 'info' as Tone, icon: <Snowflake className="h-3 w-3" aria-hidden />, label: 'Frio' } }[t.level];
  return <StatusChip tone={map.tone} icon={map.icon} title={`Regra: ${t.reasons.join('; ')}`}>{map.label}</StatusChip>;
}

const covTone: Record<CoverageStatus, Tone> = { nao_consultada: 'neutral', pendente: 'warning', elegivel: 'success', inelegivel: 'danger', indeterminada: 'warning' };
export const CoverageChip = ({ s }: { s: CoverageStatus }) => <StatusChip tone={covTone[s]}>Cobertura: {COVERAGE_LABELS[s]}</StatusChip>;

const propTone: Record<ProposalStatus, Tone> = { nao_criada: 'neutral', rascunho: 'neutral', enviada: 'info', aceita: 'success', recusada: 'danger', expirada: 'warning' };
export const ProposalChip = ({ s }: { s: ProposalStatus }) => <StatusChip tone={propTone[s]}>Proposta: {PROPOSAL_LABELS[s]}</StatusChip>;

const contractTone: Record<ContractRequestStatus, Tone> = { nao_solicitada: 'neutral', pendente: 'warning', enviada: 'info', erro: 'danger', confirmada: 'success', rejeitada: 'danger' };
export const ContractChip = ({ s }: { s: ContractRequestStatus }) => <StatusChip tone={contractTone[s]}>Contrato: {CONTRACT_LABELS[s]}</StatusChip>;

const lifeTone: Record<CustomerLifecycle, Tone> = { prospect: 'neutral', ativo: 'success', suspenso: 'warning', cancelado: 'danger', reativado: 'primary' };
export const LifecycleChip = ({ s }: { s: CustomerLifecycle }) => <StatusChip tone={lifeTone[s]}>{LIFECYCLE_LABELS[s]}</StatusChip>;

const prioTone: Record<ActivityPriority, Tone> = { baixa: 'neutral', media: 'info', alta: 'danger' };
export const PriorityChip = ({ p }: { p: ActivityPriority }) => <StatusChip tone={prioTone[p]}>{PRIORITY_LABELS[p]}</StatusChip>;
export const activityTypeLabel = (t: ActivityType) => ACTIVITY_TYPE_LABELS[t];

export function SlaChip({ state }: { state: 'cumprido' | 'cumprido_atrasado' | 'violado' | 'no_prazo' }) {
  const m = { cumprido: ['success', 'SLA cumprido'], cumprido_atrasado: ['warning', 'Contato fora do SLA'], violado: ['danger', 'SLA vencido'], no_prazo: ['neutral', 'No prazo'] } as const;
  return <StatusChip tone={m[state][0]} title="Primeiro contato em até 24 h após a criação">{m[state][1]}</StatusChip>;
}
