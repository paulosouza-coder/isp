import { useEffect, useState } from 'react';
import { LOSS_REASONS, LOSS_REASON_LABELS, STAGE_LABELS, isTerminal, type LossReason, type OpportunityStage } from '@isp/domain';
import { ConfirmDialog } from '../components/ui/overlay';
import { FormField, Notice, Select, Textarea } from '../components/ui/primitives';

export type TransitionRequest = { from: OpportunityStage; to: OpportunityStage; title: string };
export type TransitionPayload = { toStage: OpportunityStage; reason?: string | null; lossReason?: LossReason | null; confirm?: boolean };

/** Transições que pedem confirmação: venda fechada, perda e reabertura. As demais são diretas. */
export const needsDialog = (from: OpportunityStage, to: OpportunityStage) => isTerminal(to) || isTerminal(from);

export function TransitionDialog({ request, onCancel, onConfirm, loading }: { request: TransitionRequest | null; onCancel: () => void; onConfirm: (p: TransitionPayload) => void; loading?: boolean }) {
  const [reason, setReason] = useState('');
  const [loss, setLoss] = useState<LossReason | ''>('');
  useEffect(() => { setReason(''); setLoss(''); }, [request]);
  if (!request) return null;
  const { from, to } = request;
  const reopening = isTerminal(from);
  const title = reopening ? 'Reabrir oportunidade' : to === 'ganha' ? 'Marcar venda fechada' : to === 'perdida' ? 'Marcar como perdida' : `Mover para ${STAGE_LABELS[to]}`;
  return (
    <ConfirmDialog
      open
      title={title}
      tone={to === 'perdida' ? 'danger' : 'primary'}
      confirmLabel={reopening ? 'Reabrir' : to === 'ganha' ? 'Marcar venda fechada' : to === 'perdida' ? 'Marcar como perdida' : 'Mover'}
      loading={loading}
      confirmDisabled={(to === 'perdida' && !loss) || (reopening && !reason.trim())}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ toStage: to, confirm: true, reason: reason.trim() || null, lossReason: to === 'perdida' ? (loss as LossReason) : null })}
    >
      <p><strong>{request.title}</strong>: {STAGE_LABELS[from]} → {STAGE_LABELS[to]}</p>
      {to === 'ganha' && <Notice tone="warning">Venda fechada é ganho comercial. O contrato só conta como confirmado após validação no IXC.</Notice>}
      {to === 'perdida' && (
        <FormField label="Motivo da perda" htmlFor="td-loss" required>
          <Select id="td-loss" value={loss} onChange={(e) => setLoss(e.target.value as LossReason)} data-autofocus>
            <option value="">Selecione</option>
            {LOSS_REASONS.map((r) => <option key={r} value={r}>{LOSS_REASON_LABELS[r]}</option>)}
          </Select>
        </FormField>
      )}
      <FormField label={reopening ? 'Por que reabrir?' : 'Observação (opcional)'} htmlFor="td-reason" required={reopening}>
        <Textarea id="td-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[64px]" />
      </FormField>
    </ConfirmDialog>
  );
}
