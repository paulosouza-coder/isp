import { createContext, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { BrandSlot } from '@isp/shared';

/**
 * Espaços de imagem da Personalização. Nenhuma imagem fica fixa no código:
 * sem upload, o espaço fica vazio ou mostra só o texto, sem quebrar o layout.
 */
const BrandCtx = createContext<{ version: number; bump: () => void }>({ version: 0, bump: () => {} });

export function BrandProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(() => Date.now());
  return <BrandCtx.Provider value={{ version, bump: () => setVersion(Date.now()) }}>{children}</BrandCtx.Provider>;
}
export const useBrand = () => useContext(BrandCtx);

export function BrandImage({ slot, alt = '', className, publicAsset, fallback = null }: { slot: BrandSlot; alt?: string; className?: string; publicAsset?: boolean; fallback?: ReactNode }) {
  const { version } = useBrand();
  const [failedFor, setFailedFor] = useState<number | null>(null);
  if (failedFor === version) return <>{fallback}</>;
  return (
    <img
      src={`/api/v1/${publicAsset ? 'public/brand' : 'brand'}/${slot}?v=${version}`}
      alt={alt}
      className={className}
      onError={() => setFailedFor(version)}
    />
  );
}

/** Logotipo: imagem enviada em Personalização; sem imagem, o nome da marca em texto. */
export function Logo({ publicAsset, className }: { publicAsset?: boolean; className?: string }) {
  return (
    <BrandImage
      slot="logo_escuro"
      alt="Yepnet"
      publicAsset={publicAsset}
      className={clsx('h-11 w-auto max-w-[180px] object-contain', className)}
      fallback={
        <span className={clsx('select-none text-[40px] font-extrabold leading-none tracking-tight', className)} aria-label="Yepnet">
          <span className="text-white">Yep</span>
          <span className="text-lime">net</span>
        </span>
      }
    />
  );
}

/** Balão do mascote com o texto fixo de cada tela (decisão de 17/10: textos não são editáveis). */
export function MascotBubble({ slot, lines, highlight }: { slot: BrandSlot; lines: string[]; highlight: ReactNode }) {
  return (
    <div className="hidden items-end gap-0 lg:flex" aria-hidden>
      <BrandImage slot={slot} className="-mb-2 -mt-6 h-[132px] w-[132px] object-contain" />
      <div className="relative rounded-lg bg-primary-soft px-4 py-3 text-md font-bold leading-snug text-ink">
        {lines.map((l) => <span key={l} className="block whitespace-nowrap">{l}</span>)}
        <span className="block whitespace-nowrap">{highlight}</span>
      </div>
    </div>
  );
}

export const ConfiarFacil = () => <span className="text-lime-ink">Confiar ficou fácil.</span>;
export const ConfiarFacilPartial = () => <>Confiar ficou <span className="text-lime-ink">fácil.</span></>;
