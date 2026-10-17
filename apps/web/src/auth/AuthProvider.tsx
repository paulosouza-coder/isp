import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission } from '@isp/domain';
import { api, ApiError } from '../lib/api';
import { setTimezone } from '../lib/format';
import type { Me } from '../lib/types';

type AuthState = {
  me: Me | null;
  loading: boolean;
  can: (p: Permission) => boolean;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (q.data) setTimezone(q.data.tenant.timezone);
  }, [q.data]);

  useEffect(() => {
    const onUnauthorized = () => qc.setQueryData(['me'], null);
    window.addEventListener('isp:unauthorized', onUnauthorized);
    return () => window.removeEventListener('isp:unauthorized', onUnauthorized);
  }, [qc]);

  const me = q.data ?? null;
  const perms = new Set(me?.permissions ?? []);
  const value: AuthState = {
    me,
    loading: q.isLoading,
    can: (p) => perms.has(p),
    refresh: () => q.refetch(),
    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        qc.clear();
        qc.setQueryData(['me'], null);
      }
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

/** Esconde UI sem permissão. A API revalida tudo — isto é só ergonomia. */
export function PermissionGuard({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
