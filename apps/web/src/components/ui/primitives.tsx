import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ChevronRight, Info, Loader2 } from 'lucide-react';

// ------------------------------------------------------------------ Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode };

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-inverse hover:bg-primary-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-sunken',
  danger: 'bg-danger text-inverse border border-transparent hover:opacity-90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // aria-disabled mantém o foco navegável enquanto carrega; disabled real evita duplo clique
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-9 px-3.5 text-base',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ------------------------------------------------------------------ Form
export function FormField({ label, error, hint, children, required, htmlFor, className }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean; htmlFor: string; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} aria-describedby={invalid && rest.id ? `${rest.id}-error` : undefined} className={clsx('field-input h-9', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={clsx('field-input h-9 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx('field-input min-h-[80px] resize-y', className)} {...rest} />;
});

/** Grupo de seleção múltipla acessível (checkbox nativo estilizado como chip). */
export function ChipGroup<T extends string>({ legend, options, value, onChange, labels }: { legend: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labels: Record<T, string> }) {
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value.includes(o);
          return (
            <label key={o} htmlFor={`${id}-${o}`} className={clsx('cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors', checked ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink hover:border-line-strong')}>
              <input id={`${id}-${o}`} type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(checked ? value.filter((x) => x !== o) : [...value, o])} />
              {labels[o]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------------ Status
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted border-line',
  primary: 'bg-primary-soft text-primary border-primary/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
};
export function StatusChip({ tone = 'neutral', children, icon, title }: { tone?: Tone; children: ReactNode; icon?: ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {icon}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ Estados
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton h-4', className)} aria-hidden />;
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={i % 2 ? 'w-4/5' : 'w-full'} />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-md font-semibold">{title}</p>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Não foi possível carregar.';
  const rid = (error as { problem?: { requestId?: string } })?.problem?.requestId;
  return (
    <div role="alert" className="m-4 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft p-4 text-danger">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{msg}</p>
        {rid && <p className="mt-1 text-xs opacity-80">Código da requisição: {rid}</p>}
      </div>
      {onRetry && <Button size="sm" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  return (
    <div className={clsx('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', tone === 'warning' ? 'border-warning/30 bg-warning-soft text-warning' : 'border-info/20 bg-info-soft text-info')}>
      {tone === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ Cabeçalho
export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {it.to ? <Link className="hover:text-ink hover:underline" to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: string; description?: ReactNode; actions?: ReactNode; breadcrumb?: { label: string; to?: string }[] }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ------------------------------------------------------------------ Tabs (padrão WAI-ARIA)
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <button
          key={t.key}
          role="tab"
          id={`tab-${t.key}`}
          aria-selected={value === t.key}
          tabIndex={value === t.key ? 0 : -1}
          onClick={() => onChange(t.key)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
              onChange(next.key);
              document.getElementById(`tab-${next.key}`)?.focus();
            }
          }}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', value === t.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
          {t.count !== undefined && <span className="num ml-1.5 rounded-full bg-sunken px-1.5 text-xs text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SaveStatus({ state, onRetry }: { state: 'idle' | 'saving' | 'saved' | 'error'; onRetry?: () => void }) {
  if (state === 'idle') return null;
  return (
    <span role="status" aria-live="polite" className={clsx('inline-flex items-center gap-1.5 text-sm', state === 'error' ? 'text-danger' : 'text-muted')}>
      {state === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Salvando…</>}
      {state === 'saved' && <>Salvo</>}
      {state === 'error' && (
        <>
          Falha ao salvar —{' '}
          <button className="underline" onClick={onRetry}>tentar novamente</button>
        </>
      )}
    </span>
  );
}
