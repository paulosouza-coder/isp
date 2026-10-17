import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/layout/AppShell';
import { LoadingRows } from './components/ui/primitives';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { LeadsPage } from './pages/Leads';
import { PipelinePage } from './pages/Pipeline';
import { OpportunitiesPage } from './pages/Opportunities';
import { NewOpportunityPage, OpportunityWorkspacePage } from './pages/OpportunityWorkspace';
import { CustomersPage } from './pages/Customers';
import { CustomerDetailPage } from './pages/CustomerDetail';
import { ActivitiesPage } from './pages/Activities';
import { PhasePlaceholder } from './pages/PhasePlaceholder';
import { SettingsPage } from './pages/Settings';

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <LoadingRows />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="opportunities" element={<OpportunitiesPage />} />
        <Route path="opportunities/new" element={<NewOpportunityPage />} />
        <Route path="opportunities/:id" element={<OpportunityWorkspacePage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="activities" element={<ActivitiesPage />} />
        <Route path="campaigns" element={<PhasePlaceholder title="Campanhas e origens" phase={5} what="custos por campanha, atribuição versionada e conversão por origem" />} />
        <Route path="intelligence" element={<PhasePlaceholder title="Inteligência (ICP)" phase={5} what="ICP de aquisição, de valor e prioritário, com tamanho de amostra e incerteza" />} />
        <Route path="finance" element={<PhasePlaceholder title="Financeiro (LTV/CAC)" phase={5} what="CAC blended e por canal, LTV realizado e projetado, churn e payback por coorte" />} />
        <Route path="reports" element={<PhasePlaceholder title="Relatórios" phase={5} what="funil, coortes, retenção e exportação sob permissão" />} />
        <Route path="integrations" element={<PhasePlaceholder title="Integrações IXC" phase={4} what="saúde da sincronização, cursores, rejeições e matriz de endpoints verificados" />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<PhasePlaceholder title="Página não encontrada" what="" notFound />} />
      </Route>
    </Routes>
  );
}
