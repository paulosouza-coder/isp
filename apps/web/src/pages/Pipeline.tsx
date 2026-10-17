import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type Announcements } from '@dnd-kit/core';
import { AlertCircle, Clock, KanbanSquare, MoreHorizontal, Search, Table2 } from 'lucide-react';
import { STAGE_LABELS, type OpportunityStage } from '@isp/domain';
import { api, qs } from '../lib/api';
import { fmtBRL, fmtDateTime } from '../lib/format';
import { useDebounced, useLookups, useUrlState } from '../lib/hooks';
import type { Opportunity, PipelineStage } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { Button, ErrorState, Input, LoadingRows, PageHeader, Select } from '../components/ui/primitives';
import { CoverageChip, stageStripe } from '../components/badges';
import { TransitionDialog, needsDialog, type TransitionRequest } from '../features/TransitionDialog';
import { useTransitionMutation } from '../features/useTransition';

function MoveMenu({ opp, stages, onMove }: { opp: Opportunity; stages: PipelineStage[]; onMove: (to: OpportunityStage) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button className="rounded-sm p-1 text-muted hover:bg-sunken hover:text-ink" aria-label={`Mover ${opp.title} para outra etapa`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-line bg-raised py-1 shadow-overlay" onMouseLeave={() => setOpen(false)}>
          <li className="px-3 py-1 text-xs text-muted">Mover para</li>
          {stages.filter((s) => s.key !== opp.stage).map((s) => (
            <li key={s.key}>
              <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={() => { setOpen(false); onMove(s.key); }}>
                <span className={clsx('h-2 w-2 rounded-full', stageStripe[s.key])} aria-hidden />
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ opp, stages, onMove, canMove, showOwner }: { opp: Opportunity; stages: PipelineStage[]; onMove: (o: Opportunity, to: OpportunityStage) => void; canMove: boolean; showOwner: boolean }) {
  const nav = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id, data: { opp }, disabled: !canMove });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-roledescription="cartão arrastável"
      aria-label={`${opp.title}, ${opp.contactName}. Espaço para pegar e setas para mover; Enter abre.`}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && !isDragging) nav(`/opportunities/${opp.id}`);
      }}
      onClick={() => nav(`/opportunities/${opp.id}`)}
      className={clsx('cursor-pointer rounded-md border border-line bg-surface p-3 text-sm hover:border-line-strong', isDragging && 'z-30 opacity-80 shadow-overlay')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{opp.contactName}</p>
          <p className="truncate text-xs text-muted">OP-{opp.code} · {opp.sourceName ?? 'Origem não informada'}</p>
        </div>
        {canMove && <MoveMenu opp={opp} stages={stages} onMove={(to) => onMove(opp, to)} />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="num font-medium">{opp.valueCents !== null ? fmtBRL(opp.valueCents) : <span className="text-muted">Sem valor</span>}</span>
        <span className="num text-xs text-muted" title="Idade da oportunidade">{opp.ageDays} d</span>
      </div>
      {opp.stage !== 'ganha' && opp.stage !== 'perdida' && (
        <p className={clsx('mt-2 flex items-center gap-1 text-xs', opp.overdue ? 'font-medium text-danger' : opp.missingNextAction ? 'text-warning' : 'text-muted')}>
          {opp.overdue || opp.missingNextAction ? <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{opp.missingNextAction ? 'Sem próxima ação' : `${opp.overdue ? 'Vencida: ' : ''}${opp.nextAction ?? 'Ação'} · ${fmtDateTime(opp.nextActionAt)}`}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
        {opp.coverageStatus !== 'nao_consultada' ? <CoverageChip s={opp.coverageStatus} /> : <span />}
        {showOwner && <span className="truncate text-xs text-muted">{opp.ownerName}</span>}
      </div>
    </li>
  );
}

function Column({ stage, children }: { stage: PipelineStage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <section ref={setNodeRef} aria-labelledby={`col-${stage.key}`} className={clsx('flex w-72 shrink-0 flex-col rounded-lg border bg-sunken/60', isOver ? 'border-primary' : 'border-line')}>
      <div className={clsx('h-1 rounded-t-lg', stageStripe[stage.key])} aria-hidden />
      <header className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
        <h2 id={`col-${stage.key}`} className="font-semibold">{stage.name} <span className="num ml-1 text-sm font-normal text-muted">{stage.count}</span></h2>
        <span className="num text-sm text-muted">{fmtBRL(stage.valueCents)}</span>
      </header>
      {children}
    </section>
  );
}

export function PipelinePage() {
  const { can, me } = useAuth();
  const lookups = useLookups();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ q: '', ownerId: '', sourceId: '' });
  const [search, setSearch] = useState(f.q);
  const dq = useDebounced(search);
  useEffect(() => { if (dq !== f.q) setF({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({ queryKey: ['pipeline', f], queryFn: () => api<{ stages: PipelineStage[]; terminalWindowDays: number }>(`/pipeline${qs(f)}`) });
  const transition = useTransitionMutation();
  const [pending, setPending] = useState<(TransitionRequest & { opp: Opportunity }) | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const canMove = can('opportunity.update');
  const stages = q.data?.stages ?? [];

  const requestMove = (opp: Opportunity, to: OpportunityStage) => {
    if (opp.stage === to) return;
    if (needsDialog(opp.stage, to)) setPending({ opp, from: opp.stage, to, title: opp.title });
    else transition.mutate({ opp, payload: { toStage: to } });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const opp = e.active.data.current?.opp as Opportunity | undefined;
    const to = e.over?.id as OpportunityStage | undefined;
    if (opp && to) requestMove(opp, to);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou ${(active.data.current?.opp as Opportunity).title}.`,
    onDragOver: ({ over }) => (over ? `Sobre a coluna ${STAGE_LABELS[over.id as OpportunityStage]}.` : 'Fora das colunas.'),
    onDragEnd: ({ over }) => (over ? `Solto em ${STAGE_LABELS[over.id as OpportunityStage]}.` : 'Movimento cancelado.'),
    onDragCancel: () => 'Movimento cancelado.',
  };

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`Oportunidades abertas por etapa. Ganhas e perdidas mostram os últimos ${q.data?.terminalWindowDays ?? 30} dias.`}
        actions={
          <div className="flex rounded-sm border border-line bg-surface p-0.5" role="group" aria-label="Visualização">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-soft px-3 py-1 text-sm font-medium text-primary" aria-current="page"><KanbanSquare className="h-4 w-4" />Kanban</span>
            <Link to={`/opportunities${qs({ q: f.q, ownerId: f.ownerId, sourceId: f.sourceId })}`} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm text-muted hover:text-ink"><Table2 className="h-4 w-4" />Tabela</Link>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap items-end gap-2" role="search">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <label htmlFor="pl-q" className="sr-only">Buscar no pipeline</label>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
          <Input id="pl-q" className="pl-8" placeholder="Contato, título ou OP-número" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can('opportunity.read_all') && (
          <Select aria-label="Responsável" className="w-auto" value={f.ownerId} onChange={(e) => setF({ ownerId: e.target.value })}>
            <option value="">Toda a equipe</option>
            <option value="me">Minhas</option>
            {lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
        <Select aria-label="Origem" className="w-auto" value={f.sourceId} onChange={(e) => setF({ sourceId: e.target.value })}>
          <option value="">Todas as origens</option>
          {lookups.data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      {q.isLoading ? (
        <LoadingRows />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: 'Pressione espaço para pegar o cartão, use as setas para escolher a coluna e espaço para soltar. Esc cancela. Também é possível usar o menu “Mover para”.' } }}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {stages.map((s) => (
              <Column key={s.key} stage={s}>
                <ul className="flex min-h-[120px] flex-col gap-2 px-2 pb-2">
                  {s.cards.map((c) => (
                    <Card key={c.id} opp={c} stages={stages} onMove={requestMove} canMove={canMove} showOwner={c.ownerId !== me?.user.id} />
                  ))}
                  {s.cards.length === 0 && <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Nenhuma oportunidade</li>}
                </ul>
              </Column>
            ))}
          </div>
        </DndContext>
      )}
      {stages.length > 0 && stages.every((s) => s.count === 0) && (
        <div className="panel mt-2 p-6 text-center">
          <p className="font-medium">Pipeline vazio</p>
          <p className="text-muted">Use “Nova oportunidade” (atalho N) para abrir um Sprint.</p>
          {can('opportunity.create') && <Button variant="primary" className="mt-3" onClick={() => nav('/opportunities/new')}>Nova oportunidade</Button>}
        </div>
      )}

      <TransitionDialog
        request={pending}
        loading={transition.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(payload) => {
          if (!pending) return;
          transition.mutate({ opp: pending.opp, payload }, { onSettled: () => setPending(null) });
        }}
      />
    </div>
  );
}
