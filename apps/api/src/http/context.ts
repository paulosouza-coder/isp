import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull, inArray } from 'drizzle-orm';
import type { Permission } from '@isp/domain';
import type { DB } from '../db/client';
import type { Config } from '../config';
import * as s from '../db/schema';
import { hashToken } from '../auth/password';

export type AuthContext = {
  sessionId: string;
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  timezone: string;
  tenantName: string;
  roles: string[];
  permissions: Set<string>;
  teamIds: string[];
};

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
    config: Config;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export const SESSION_COOKIE = 'isp_session';

/** Resolve a sessão a partir do cookie. Nunca confia em tenant/usuário vindos do cliente. */
export async function resolveSession(app: FastifyInstance, req: FastifyRequest): Promise<AuthContext | null> {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  const now = new Date();
  const rows = await app.db
    .select({
      sessionId: s.sessions.id,
      userId: s.users.id,
      tenantId: s.users.tenantId,
      name: s.users.name,
      email: s.users.email,
      active: s.users.active,
      timezone: s.tenants.timezone,
      tenantName: s.tenants.name,
      lastSeenAt: s.sessions.lastSeenAt,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .innerJoin(s.tenants, eq(s.tenants.id, s.users.tenantId))
    .where(and(eq(s.sessions.tokenHash, hashToken(unsigned.value)), isNull(s.sessions.revokedAt), gt(s.sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row || !row.active) return null;

  const roleRows = await app.db
    .select({ key: s.roles.key, roleId: s.roles.id })
    .from(s.userRoles)
    .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
    .where(and(eq(s.userRoles.userId, row.userId), eq(s.roles.tenantId, row.tenantId)));
  const perms = roleRows.length
    ? await app.db
        .select({ permission: s.rolePermissions.permission })
        .from(s.rolePermissions)
        .where(inArray(s.rolePermissions.roleId, roleRows.map((r) => r.roleId)))
    : [];
  const teams = await app.db.select({ teamId: s.teamMemberships.teamId }).from(s.teamMemberships).where(eq(s.teamMemberships.userId, row.userId));

  // atualiza last_seen no máximo 1x por minuto
  if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
    await app.db.update(s.sessions).set({ lastSeenAt: now }).where(eq(s.sessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    timezone: row.timezone,
    tenantName: row.tenantName,
    roles: roleRows.map((r) => r.key),
    permissions: new Set(perms.map((p) => p.permission)),
    teamIds: teams.map((t) => t.teamId),
  };
}

export function can(auth: AuthContext, p: Permission) {
  return auth.permissions.has(p);
}

export type Reply = FastifyReply;
