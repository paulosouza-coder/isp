import { useQuery } from '@tanstack/react-query';
import { ROLE_LABELS, STAGE_LABELS, type RoleKey } from '@isp/domain';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useLookups } from '../lib/hooks';
import { useAuth } from '../auth/AuthProvider';
import { ErrorState, LoadingRows, PageHeader } from '../components/ui/primitives';

type AuditRow = { id: string; action: string; entityType: string | null; entityId: string | null; createdAt: string; requestId: string | null; actorName: string | null };

function Audit() {
  const q = useQuery({ queryKey: ['audit'], queryFn: () => api<{ items: AuditRow[] }>('/audit') });
  if (q.isLoading) return <LoadingRows />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Trilha de auditoria</caption>
        <thead className="bg-sunken/60 text-left text-muted"><tr><th className="px-4 py-2 font-medium">Quando</th><th className="px-4 py-2 font-medium">Quem</th><th className="px-4 py-2 font-medium">Ação</th><th className="px-4 py-2 font-medium">Registro</th></tr></thead>
        <tbody>
          {q.data!.items.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <td className="num whitespace-nowrap px-4 py-2">{fmtDateTime(a.createdAt)}</td>
              <td className="px-4 py-2">{a.actorName ?? '—'}</td>
              <td className="px-4 py-2">{a.action}</td>
              <td className="px-4 py-2 text-muted">{a.entityType ? `${a.entityType} ${a.entityId?.slice(0, 8) ?? ''}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsPage() {
  const { me, can } = useAuth();
  const lookups = useLookups();
  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <PageHeader title="Configurações" description="Nesta fase, somente leitura. Edição de funil, papéis, catálogo e integrações chega nas próximas fases." />
      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">Empresa</h2>
        <p>{me?.tenant.name}</p>
        <p className="text-sm text-muted">Fuso horário: {me?.tenant.timezone}</p>
      </section>
      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">Etapas do funil</h2>
        <ol className="flex flex-wrap gap-2">{lookups.data?.stages.map((s) => <li key={s.key} className="rounded-full border border-line px-3 py-1 text-sm">{STAGE_LABELS[s.key]}{s.isTerminal ? ' (encerra)' : ''}</li>)}</ol>
      </section>
      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">Seu acesso</h2>
        <p className="text-sm">{me?.roles.map((r) => ROLE_LABELS[r as RoleKey] ?? r).join(', ')}</p>
        <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted">Permissões ({me?.permissions.length})</summary><p className="mt-2 text-muted">{me?.permissions.join(', ')}</p></details>
      </section>
      {can('audit.read') && (
        <section className="panel overflow-hidden">
          <h2 className="px-4 pt-4 font-semibold">Auditoria</h2>
          <p className="px-4 pb-3 text-sm text-muted">Últimos 200 eventos sensíveis: logins, atribuições, encerramentos e consultas a dados pessoais.</p>
          <Audit />
        </section>
      )}
    </div>
  );
}
