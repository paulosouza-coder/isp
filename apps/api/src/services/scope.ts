import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Permission } from '@isp/domain';
import type { AuthContext } from '../http/context';
import type { DbOrTx } from '../db/client';
import * as s from '../db/schema';
import { forbidden, unprocessable } from '../http/errors';

/**
 * Filtro de visibilidade: sempre por tenant; sem `readAll`, apenas registros do próprio dono.
 * Supervisores (read_all) veem o tenant inteiro nesta fase — escopo por equipe está no backlog.
 */
export function visibility(auth: AuthContext, cols: { tenantId: PgColumn; ownerId: PgColumn; deletedAt?: PgColumn }, readAll: Permission): SQL {
  const parts: SQL[] = [eq(cols.tenantId, auth.tenantId)];
  if (cols.deletedAt) parts.push(isNull(cols.deletedAt));
  if (!auth.permissions.has(readAll)) parts.push(eq(cols.ownerId, auth.userId));
  return and(...parts)!;
}

/** Garante que o usuário-alvo existe, está ativo e pertence ao mesmo tenant. */
export async function assertAssignableUser(db: DbOrTx, auth: AuthContext, userId: string, assignPermission: Permission) {
  if (userId !== auth.userId && !auth.permissions.has(assignPermission)) {
    throw forbidden('Você não pode atribuir registros a outra pessoa.');
  }
  const [u] = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(eq(s.users.id, userId), eq(s.users.tenantId, auth.tenantId), eq(s.users.active, true)))
    .limit(1);
  if (!u) throw unprocessable('Responsável inválido.', [{ path: 'ownerId', message: 'Usuário não encontrado nesta empresa' }]);
}

/** Valida que origem/campanha pertencem ao tenant (evita IDOR por FK). */
export async function assertTenantRefs(db: DbOrTx, auth: AuthContext, refs: { sourceId?: string | null; campaignId?: string | null; contactId?: string | null }) {
  const checks: [string, PgColumn, PgColumn, string | null | undefined, typeof s.leadSources | typeof s.campaigns | typeof s.contacts][] = [
    ['sourceId', s.leadSources.id, s.leadSources.tenantId, refs.sourceId, s.leadSources],
    ['campaignId', s.campaigns.id, s.campaigns.tenantId, refs.campaignId, s.campaigns],
    ['contactId', s.contacts.id, s.contacts.tenantId, refs.contactId, s.contacts],
  ];
  for (const [path, idCol, tenantCol, value, table] of checks) {
    if (!value) continue;
    const rows = await db.select({ id: idCol }).from(table).where(and(eq(idCol, value), eq(tenantCol, auth.tenantId))).limit(1);
    if (!rows.length) throw unprocessable('Referência inválida.', [{ path, message: 'Registro não encontrado nesta empresa' }]);
  }
}
