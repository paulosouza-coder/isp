import type { FastifyRequest } from 'fastify';
import type { DbOrTx } from '../db/client';
import { auditLogs } from '../db/schema';

/** Trilha de auditoria (append-only no banco). Não gravar PII nem segredos em metadata. */
export async function audit(
  db: DbOrTx,
  req: FastifyRequest,
  e: { action: string; tenantId?: string | null; actorId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, unknown> },
) {
  await db.insert(auditLogs).values({
    tenantId: e.tenantId ?? req.auth?.tenantId ?? null,
    actorId: e.actorId ?? req.auth?.userId ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    requestId: String(req.id),
    ip: req.ip,
    metadata: e.metadata,
  });
}
