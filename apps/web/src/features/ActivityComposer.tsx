import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACTIVITY_PRIORITIES, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, PRIORITY_LABELS, type ActivityPriority, type ActivityType } from '@isp/domain';
import { api, ApiError } from '../lib/api';
import { localInputToIso } from '../lib/format';
import type { Activity } from '../lib/types';
import { Button, FormField, Input, Select, Textarea } from '../components/ui/primitives';
import { useToast } from '../components/ui/overlay';

function defaultDue() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

export function ActivityComposer({ opportunityId, contactId, defaultType = 'retorno', defaultTitle = '', onDone, formId = 'activity-form', hideSubmit }: { opportunityId?: string; contactId?: string; defaultType?: ActivityType; defaultTitle?: string; onDone?: () => void; formId?: string; hideSubmit?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<ActivityType>(defaultType);
  const [title, setTitle] = useState(defaultTitle);
  const [due, setDue] = useState(defaultDue());
  const [priority, setPriority] = useState<ActivityPriority>('media');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const m = useMutation({
    mutationFn: () =>
      api<Activity & { deduplicated: boolean }>('/activities', {
        method: 'POST',
        body: { type, title: title.trim(), dueAt: localInputToIso(due), priority, notes: notes || null, opportunityId: opportunityId ?? null, contactId: contactId ?? null },
      }),
    onSuccess: (a) => {
      toast({ tone: 'success', message: a.deduplicated ? 'Essa atividade já estava agendada' : 'Atividade agendada' });
      qc.invalidateQueries({ queryKey: ['activities'] });
      if (opportunityId) qc.invalidateQueries({ queryKey: ['timeline', opportunityId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setTitle('');
      setNotes('');
      onDone?.();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors());
      toast({ tone: 'error', message: (e as Error).message });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (m.isPending) return;
    if (title.trim().length < 2) return setErrors({ title: 'Descreva a atividade' });
    setErrors({});
    m.mutate();
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipo" htmlFor={`${formId}-type`}>
          <Select id={`${formId}-type`} value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
          </Select>
        </FormField>
        <FormField label="Prioridade" htmlFor={`${formId}-prio`}>
          <Select id={`${formId}-prio`} value={priority} onChange={(e) => setPriority(e.target.value as ActivityPriority)}>
            {ACTIVITY_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="O que fazer" htmlFor={`${formId}-title`} required error={errors.title}>
        <Input id={`${formId}-title`} value={title} invalid={!!errors.title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: retornar com comparação de planos" data-autofocus />
      </FormField>
      <FormField label="Quando" htmlFor={`${formId}-due`} error={errors.dueAt}>
        <Input id={`${formId}-due`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </FormField>
      <FormField label="Observações" htmlFor={`${formId}-notes`}>
        <Textarea id={`${formId}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />
      </FormField>
      {!hideSubmit && <Button type="submit" variant="primary" loading={m.isPending}>Agendar</Button>}
    </form>
  );
}
