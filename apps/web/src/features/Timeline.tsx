import { useQuery } from '@tanstack/react-query';
import { ACTIVITY_TYPE_LABELS, LOSS_REASON_LABELS, STAGE_LABELS, type ActivityType, type LossReason, type OpportunityStage } from '@isp/domain';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { TimelineItem } from '../lib/types';
import { ErrorState, LoadingRows } from '../components/ui/primitives';

const FIELD_LABELS: Record<string, string> = {
  title: 'título', ownerId: 'responsável', sourceId: 'origem', campaignId: 'campanha', channel: 'canal', reasons: 'motivos', valueCents: 'valor', nextAction: 'próxima ação', nextActionAt: 'data da próxima ação', notes: 'anotações',
};

function describe(i: TimelineItem): string {
  if (i.kind === 'activity') {
    const t = i.activityType ? ACTIVITY_TYPE_LABELS[i.activityType as ActivityType] : 'Atividade';
    const verb = { created: 'agendada', completed: 'concluída', reopened: 'reaberta', rescheduled: 'reagendada', assigned: 'reatribuída', updated: 'editada' }[i.type] ?? i.type;
    return `${t} ${verb}: ${i.title}`;
  }
  const st = (v?: string | null) => (v ? STAGE_LABELS[v as OpportunityStage] ?? v : '—');
  switch (i.type) {
    case 'created': return 'Oportunidade criada';
    case 'stage_changed': {
      const loss = (i.payload?.lossReason as LossReason | undefined);
      return `Etapa: ${st(i.fromValue)} → ${st(i.toValue)}${loss ? ` (motivo: ${LOSS_REASON_LABELS[loss]})` : ''}`;
    }
    case 'reopened': return `Reaberta: ${st(i.fromValue)} → ${st(i.toValue)}`;
    case 'assigned': return 'Responsável alterado';
    case 'updated': {
      const changed = Object.keys((i.payload?.changed as Record<string, unknown>) ?? {});
      return `Atualizou ${changed.map((c) => FIELD_LABELS[c] ?? c).join(', ')}`;
    }
    default: return i.type;
  }
}

export function Timeline({ opportunityId }: { opportunityId: string }) {
  const q = useQuery({ queryKey: ['timeline', opportunityId], queryFn: () => api<{ items: TimelineItem[] }>(`/opportunities/${opportunityId}/timeline`) });
  if (q.isLoading) return <LoadingRows rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="text-sm text-muted">Sem eventos.</p>;
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {items.map((i) => (
        <li key={`${i.kind}-${i.id}`} className="relative">
          <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${i.kind === 'activity' ? 'bg-info' : i.toValue === 'ganha' ? 'bg-success' : i.toValue === 'perdida' ? 'bg-danger' : 'bg-primary'}`} aria-hidden />
          <p className="text-sm">{describe(i)}</p>
          {i.reason && <p className="text-sm text-muted">“{i.reason}”</p>}
          <p className="text-xs text-muted">
            <time dateTime={i.occurredAt}>{fmtDateTime(i.occurredAt)}</time> · {i.actorName ?? 'Sistema'} · fonte {i.sourceSystem === 'crm' ? 'CRM' : i.sourceSystem}
          </p>
        </li>
      ))}
    </ol>
  );
}
