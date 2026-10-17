import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtDateTime, fmtRelative } from '../lib/format';
import type { Activity } from '../lib/types';
import { useToast } from '../components/ui/overlay';
import { PriorityChip, activityTypeLabel } from '../components/badges';

/** Lista de atividades com conclusão em um clique (checkbox nativo = acessível por teclado). */
export function ActivityList({ items, showLink = true, showOwner = false }: { items: Activity[]; showLink?: boolean; showOwner?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const toggle = useMutation({
    mutationFn: (a: Activity) => api<Activity>(`/activities/${a.id}`, { method: 'PATCH', body: { completed: !a.completedAt, rowVersion: a.rowVersion } }),
    onSuccess: (a) => {
      toast({ tone: 'success', message: a.completedAt ? 'Atividade concluída' : 'Atividade reaberta' });
      qc.invalidateQueries({ queryKey: ['activities'] });
      if (a.opportunityId) qc.invalidateQueries({ queryKey: ['timeline', a.opportunityId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => {
      toast({ tone: 'error', message: (e as Error).message });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={!!a.completedAt}
            disabled={toggle.isPending && toggle.variables?.id === a.id}
            onChange={() => toggle.mutate(a)}
            aria-label={`${a.completedAt ? 'Reabrir' : 'Concluir'}: ${a.title}`}
          />
          <div className="min-w-0 flex-1">
            <p className={clsx('font-medium', a.completedAt && 'text-muted line-through')}>{a.title}</p>
            <p className="text-sm text-muted">
              {activityTypeLabel(a.type)} ·{' '}
              <span className={clsx('num', a.overdue && 'font-medium text-danger')}>{a.dueAt ? (a.overdue ? `venceu ${fmtRelative(a.dueAt)}` : fmtDateTime(a.dueAt)) : 'sem prazo'}</span>
              {showOwner && <> · {a.ownerName}</>}
              {showLink && a.opportunityId && (
                <> · <Link className="link" to={`/opportunities/${a.opportunityId}`}>{a.contactName ?? `OP-${a.opportunityCode}`}</Link></>
              )}
            </p>
          </div>
          <PriorityChip p={a.priority} />
        </li>
      ))}
    </ul>
  );
}
