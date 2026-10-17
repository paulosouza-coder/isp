import { and, asc, eq, sql } from 'drizzle-orm';
import { defineRoute } from '../http/route';
import * as s from '../db/schema';

export const metaRoutes = [
  defineRoute({
    method: 'GET',
    url: '/meta/lookups',
    summary: 'Listas de apoio: usuários, origens, campanhas, etapas, times e planos ativos',
    tag: 'Configurações',
    anyAuthenticated: true,
    handler: async ({ app, auth }) => {
      const t = auth.tenantId;
      const [users, sources, campaigns, stages, teams, plans] = await Promise.all([
        app.db
          .select({ id: s.users.id, name: s.users.name, hasAvatar: sql<boolean>`exists(select 1 from user_avatars ua where ua.user_id = "users"."id")` })
          .from(s.users)
          .where(and(eq(s.users.tenantId, t), eq(s.users.active, true)))
          .orderBy(asc(s.users.name)),
        app.db.select({ id: s.leadSources.id, name: s.leadSources.name }).from(s.leadSources).where(and(eq(s.leadSources.tenantId, t), eq(s.leadSources.active, true))).orderBy(asc(s.leadSources.name)),
        app.db.select({ id: s.campaigns.id, name: s.campaigns.name, sourceId: s.campaigns.sourceId }).from(s.campaigns).where(and(eq(s.campaigns.tenantId, t), eq(s.campaigns.active, true))).orderBy(asc(s.campaigns.name)),
        app.db
          .select({ id: s.pipelineStages.id, key: s.pipelineStages.key, name: s.pipelineStages.name, position: s.pipelineStages.position, isTerminal: s.pipelineStages.isTerminal })
          .from(s.pipelineStages)
          .where(and(eq(s.pipelineStages.tenantId, t), eq(s.pipelineStages.active, true)))
          .orderBy(asc(s.pipelineStages.position)),
        app.db.select({ id: s.teams.id, name: s.teams.name }).from(s.teams).where(eq(s.teams.tenantId, t)).orderBy(asc(s.teams.name)),
        app.db
          .select({ id: s.plans.id, name: s.plans.name, line: s.plans.line, segment: s.plans.segment, priceCents: s.plans.priceCents })
          .from(s.plans)
          .where(and(eq(s.plans.tenantId, t), eq(s.plans.active, true)))
          .orderBy(asc(s.plans.priceCents)),
      ]);
      return { users, sources, campaigns, stages, teams, plans };
    },
  }),
];
