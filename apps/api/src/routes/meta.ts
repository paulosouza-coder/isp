import { and, asc, desc, eq } from 'drizzle-orm';
import { defineRoute } from '../http/route';
import * as s from '../db/schema';

export const metaRoutes = [
  defineRoute({
    method: 'GET',
    url: '/meta/lookups',
    summary: 'Listas de apoio: usuários ativos, origens, campanhas e etapas do funil',
    tag: 'Configurações',
    anyAuthenticated: true,
    handler: async ({ app, auth }) => {
      const t = auth.tenantId;
      const [users, sources, campaigns, stages, teams] = await Promise.all([
        app.db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.tenantId, t), eq(s.users.active, true))).orderBy(asc(s.users.name)),
        app.db.select({ id: s.leadSources.id, name: s.leadSources.name }).from(s.leadSources).where(and(eq(s.leadSources.tenantId, t), eq(s.leadSources.active, true))).orderBy(asc(s.leadSources.name)),
        app.db.select({ id: s.campaigns.id, name: s.campaigns.name, sourceId: s.campaigns.sourceId }).from(s.campaigns).where(and(eq(s.campaigns.tenantId, t), eq(s.campaigns.active, true))).orderBy(asc(s.campaigns.name)),
        app.db.select({ key: s.pipelineStages.key, name: s.pipelineStages.name, position: s.pipelineStages.position, isTerminal: s.pipelineStages.isTerminal }).from(s.pipelineStages).where(eq(s.pipelineStages.tenantId, t)).orderBy(asc(s.pipelineStages.position)),
        app.db.select({ id: s.teams.id, name: s.teams.name }).from(s.teams).where(eq(s.teams.tenantId, t)),
      ]);
      return { users, sources, campaigns, stages, teams };
    },
  }),

  defineRoute({
    method: 'GET',
    url: '/audit',
    summary: 'Trilha de auditoria recente (restrita)',
    tag: 'Configurações',
    permission: 'audit.read',
    handler: async ({ app, auth }) => {
      const rows = await app.db
        .select({ id: s.auditLogs.id, action: s.auditLogs.action, entityType: s.auditLogs.entityType, entityId: s.auditLogs.entityId, createdAt: s.auditLogs.createdAt, requestId: s.auditLogs.requestId, actorName: s.users.name })
        .from(s.auditLogs)
        .leftJoin(s.users, eq(s.users.id, s.auditLogs.actorId))
        .where(eq(s.auditLogs.tenantId, auth.tenantId))
        .orderBy(desc(s.auditLogs.createdAt))
        .limit(200);
      return { items: rows };
    },
  }),
];
