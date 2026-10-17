import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useUrlState } from '../lib/hooks';
import type { Activity, Paged } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, ErrorState, LoadingRows, PageHeader, Tabs } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlay';
import { ActivityList } from '../features/ActivityList';
import { ActivityComposer } from '../features/ActivityComposer';

type Resp = Paged<Activity> & { counts: { overdue: number; today: number; open: number } };
type Status = 'abertas' | 'atrasadas' | 'hoje' | 'concluidas' | 'todas';

export function ActivitiesPage() {
  const { can } = useAuth();
  const [f, setF] = useUrlState({ status: 'abertas', scope: 'minhas', page: '1' });
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['activities', 'list', f], queryFn: () => api<Resp>(`/activities${qs({ ...f, pageSize: 50 })}`), placeholderData: keepPreviousData });
  const c = q.data?.counts;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Atividades"
        description="Retornos, ligações, visitas e tarefas."
        actions={
          <>
            {can('activity.read_all') && (
              <div role="radiogroup" aria-label="De quem" className="flex rounded-sm border border-line bg-surface p-0.5">
                {(['minhas', 'equipe'] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={f.scope === s} onClick={() => setF({ scope: s })} className={`rounded-sm px-3 py-1 text-sm ${f.scope === s ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:text-ink'}`}>{s === 'minhas' ? 'Minhas' : 'Equipe'}</button>
                ))}
              </div>
            )}
            {can('activity.create') && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nova atividade</Button>}
          </>
        }
      />
      <div className="panel">
        <div className="px-4 pt-2">
          <Tabs<Status>
            label="Filtrar atividades"
            value={f.status as Status}
            onChange={(s) => setF({ status: s })}
            tabs={[
              { key: 'abertas', label: 'Abertas', count: c?.open },
              { key: 'atrasadas', label: 'Vencidas', count: c?.overdue },
              { key: 'hoje', label: 'Hoje', count: c?.today },
              { key: 'concluidas', label: 'Concluídas' },
              { key: 'todas', label: 'Todas' },
            ]}
          />
        </div>
        <div className="px-4 pb-2" role="tabpanel" aria-labelledby={`tab-${f.status}`}>
          {q.isLoading ? <LoadingRows /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? (
            <EmptyState
              title={f.status === 'atrasadas' ? 'Nada vencido' : f.status === 'hoje' ? 'Nada para hoje' : 'Nenhuma atividade'}
              description={f.status === 'atrasadas' ? 'Todos os retornos estão em dia.' : 'Agende retornos a partir das oportunidades ou crie uma atividade avulsa.'}
            />
          ) : (
            <ActivityList items={q.data.items} showOwner={f.scope === 'equipe'} />
          )}
          {q.data && q.data.total > q.data.items.length && <p className="py-2 text-sm text-muted">Mostrando {q.data.items.length} de {q.data.total}.</p>}
        </div>
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nova atividade" footer={<><Button onClick={() => setCreating(false)}>Cancelar</Button><Button variant="primary" type="submit" form="new-activity">Agendar</Button></>}>
        <ActivityComposer formId="new-activity" hideSubmit defaultType="tarefa" onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
