import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Activity, BarChart3, Bell, Cable, ChevronsLeft, ChevronsRight, CircleDollarSign, Contact, Filter, Gauge, KanbanSquare, LogOut, Megaphone, Menu,
  Moon, Plus, Settings, Sun, Target, Users, X,
} from 'lucide-react';
import type { Permission } from '@isp/domain';
import { ROLE_LABELS, type RoleKey } from '@isp/domain';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../lib/api';
import { useHotkey } from '../../lib/hooks';
import { Button } from '../ui/primitives';
import { GlobalSearch } from './GlobalSearch';

type NavItem = { to: string; label: string; icon: ReactNode; permission: Permission; phase?: number };
const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: <Gauge className="h-4 w-4" />, permission: 'dashboard.read' },
  { to: '/leads', label: 'Leads', icon: <Filter className="h-4 w-4" />, permission: 'lead.read' },
  { to: '/pipeline', label: 'Pipeline', icon: <KanbanSquare className="h-4 w-4" />, permission: 'opportunity.read' },
  { to: '/opportunities', label: 'Oportunidades', icon: <Target className="h-4 w-4" />, permission: 'opportunity.read' },
  { to: '/customers', label: 'Clientes', icon: <Contact className="h-4 w-4" />, permission: 'customer.read' },
  { to: '/activities', label: 'Atividades', icon: <Activity className="h-4 w-4" />, permission: 'activity.read' },
  { to: '/campaigns', label: 'Campanhas e origens', icon: <Megaphone className="h-4 w-4" />, permission: 'campaign.read', phase: 5 },
  { to: '/intelligence', label: 'Inteligência (ICP)', icon: <Users className="h-4 w-4" />, permission: 'analytics.read', phase: 5 },
  { to: '/finance', label: 'Financeiro (LTV/CAC)', icon: <CircleDollarSign className="h-4 w-4" />, permission: 'finance.read', phase: 5 },
  { to: '/reports', label: 'Relatórios', icon: <BarChart3 className="h-4 w-4" />, permission: 'analytics.read', phase: 5 },
  { to: '/integrations', label: 'Integrações IXC', icon: <Cable className="h-4 w-4" />, permission: 'integration.read', phase: 4 },
  { to: '/settings', label: 'Configurações', icon: <Settings className="h-4 w-4" />, permission: 'settings.read' },
];

function readCollapsed() {
  try { return localStorage.getItem('sidebar:collapsed') === '1'; } catch { return false; }
}

function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className={clsx('flex h-14 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <SprintMark />
        {!collapsed && <span className="text-md font-semibold text-sidebar-active">ISP Sprint</span>}
      </div>
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {NAV.filter((n) => can(n.permission)).map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/'}
                onClick={onNavigate}
                title={collapsed ? n.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors',
                    collapsed && 'justify-center',
                    isActive ? 'bg-white/10 font-medium text-sidebar-active' : 'hover:bg-white/5 hover:text-sidebar-active',
                  )
                }
              >
                {n.icon}
                {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                {!collapsed && n.phase && <span className="text-[11px] text-sidebar-text/70">Fase {n.phase}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {onToggle && (
        <button onClick={onToggle} className="m-2 flex items-center justify-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-white/5" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher</>}
        </button>
      )}
    </div>
  );
}

/** Marca: sete barras de sinal = sete minutos do Sprint. */
export function SprintMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={clsx('h-5 w-7', className)} aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={i * 4} y={18 - (i + 1) * 2.5} width="2.6" height={(i + 1) * 2.5} rx="0.8" fill="rgb(var(--primary))" opacity={0.45 + i * 0.09} />
      ))}
    </svg>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  return (
    <button
      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-sunken"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignora */ }
      }}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  if (!me) return null;
  const initials = me.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="relative">
      <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-label={`Conta de ${me.user.name}`}>
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-md border border-line bg-raised p-1 shadow-overlay" onMouseLeave={() => setOpen(false)}>
          <div className="border-b border-line px-3 py-2">
            <p className="font-medium">{me.user.name}</p>
            <p className="text-sm text-muted">{me.tenant.name}</p>
            <p className="mt-1 text-xs text-muted">{me.roles.map((r) => ROLE_LABELS[r as RoleKey] ?? r).join(', ')}</p>
          </div>
          <ThemeToggle />
          <button role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-sunken" onClick={async () => { await logout(); nav('/login'); }}>
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function OverdueBell() {
  const { can } = useAuth();
  const { data } = useQuery({
    queryKey: ['activities', 'counts'],
    enabled: can('activity.read'),
    queryFn: () => api<{ counts: { overdue: number; today: number } }>('/activities?status=atrasadas&pageSize=1'),
    refetchInterval: 60_000,
  });
  const n = data?.counts.overdue ?? 0;
  return (
    <Link to="/activities?status=atrasadas" className="relative flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink" aria-label={n ? `${n} atividades vencidas` : 'Nenhuma atividade vencida'}>
      <Bell className="h-5 w-5" />
      {n > 0 && <span className="num absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-semibold leading-[18px] text-inverse">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}

export function AppShell() {
  const { can } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const search = useRef<{ focus: () => void }>(null);
  const nav = useNavigate();
  const loc = useLocation();
  const newOpp = useCallback(() => can('opportunity.create') && nav('/opportunities/new'), [can, nav]);
  useHotkey('/', useCallback(() => search.current?.focus(), []));
  useHotkey('n', newOpp);
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <div className="flex min-h-screen">
      <a href="#conteudo" className="sr-only z-50 rounded bg-primary px-3 py-2 text-inverse focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Pular para o conteúdo</a>
      <aside className={clsx('sticky top-0 hidden h-screen shrink-0 lg:block', collapsed ? 'w-16' : 'w-60')}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            setCollapsed((v) => {
              try { localStorage.setItem('sidebar:collapsed', v ? '0' : '1'); } catch { /* ignora */ }
              return !v;
            });
          }}
        />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="w-64"><Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} /></div>
          <button className="flex-1 bg-ink/40" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X className="ml-2 mt-3 h-6 w-6 text-inverse" /></button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <button className="rounded-sm p-1.5 text-muted hover:bg-sunken lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <GlobalSearch ref={search} />
          <div className="ml-auto flex items-center gap-1.5">
            {can('opportunity.create') && (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={newOpp} title="Atalho: N" className="max-sm:px-2.5">
                <span className="max-sm:sr-only">Nova oportunidade</span>
              </Button>
            )}
            <OverdueBell />
            <UserMenu />
          </div>
        </header>
        <main id="conteudo" className="flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
