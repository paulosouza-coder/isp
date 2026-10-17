import type { ReactNode } from 'react';
import type { BrandSlot } from '@isp/shared';
import { MascotBubble } from '../brand';

/** Cabeçalho das telas: ícone + título grande, subtítulo, mascote com balão fixo e ações. */
export function PageHeader({ icon, title, subtitle, mascot, actions }: { icon: ReactNode; title: string; subtitle: string; mascot?: { slot: BrandSlot; lines: string[]; highlight: ReactNode }; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="mt-1 text-ink" aria-hidden>{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-md text-muted">{subtitle}</p>
        </div>
      </div>
      {mascot && <MascotBubble slot={mascot.slot} lines={mascot.lines} highlight={mascot.highlight} />}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
