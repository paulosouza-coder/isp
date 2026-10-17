import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui/primitives';

/** Módulos de fases futuras: visíveis no menu (por permissão) mas sem dados inventados. */
export function PhasePlaceholder({ title, phase, what, notFound }: { title: string; phase?: number; what: string; notFound?: boolean }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="panel">
        {notFound ? (
          <EmptyState title="Esta página não existe" description="Confira o endereço ou volte para a visão geral." action={<Link className="link" to="/">Ir para a visão geral</Link>} />
        ) : (
          <EmptyState
            icon={<Construction className="h-8 w-8" />}
            title={`Previsto para a Fase ${phase}`}
            description={`Aqui ficarão ${what}. Nenhum número é exibido antes de existir fonte de dados verificada.`}
            action={<Link className="link" to="/pipeline">Ir para o pipeline</Link>}
          />
        )}
      </div>
    </div>
  );
}
