import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { api, ApiError } from '../lib/api';
import type { Me } from '../lib/types';
import { Button, FormField, Input } from '../components/ui/primitives';
import { ConfiarFacilPartial, Logo } from '../components/brand';

export function LoginPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (me) return <Navigate to={safeNext} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<Me>('/auth/login', { method: 'POST', body: { email, password } });
      qc.setQueryData(['me'], data);
      nav(safeNext, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo publicAsset />
          <p className="text-md font-semibold text-white"><ConfiarFacilPartial /></p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg bg-surface p-6 shadow-overlay" noValidate>
          <div>
            <h1 className="text-lg font-extrabold text-ink">Entrar no CRM</h1>
            <p className="text-sm text-muted">Use seu e-mail corporativo.</p>
          </div>
          <FormField label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Senha" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          {error && <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>Entrar</Button>
        </form>
        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-sm text-white/70">Demonstração: carlos@yepnet.test (gerência), ana@yepnet.test (supervisão), lucas@yepnet.test (vendedor) · senha Sprint@2026</p>
        )}
      </div>
    </div>
  );
}
