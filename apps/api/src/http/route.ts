/**
 * Registro declarativo de rotas: cada rota declara permissão, schemas Zod e resumo.
 * O helper aplica autenticação, RBAC (negação por padrão), validação 422 e alimenta o OpenAPI.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
import type { Permission } from '@isp/domain';
import { forbidden, unauthorized, unprocessable, zodToProblemErrors } from './errors';
import type { AuthContext } from './context';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RouteDef<B extends ZodTypeAny = ZodTypeAny, Q extends ZodTypeAny = ZodTypeAny, P extends ZodTypeAny = ZodTypeAny> = {
  method: Method;
  url: string;
  summary: string;
  tag: string;
  /** Rota pública (sem sessão). Use com parcimônia. */
  public?: boolean;
  /** Exige TODAS as permissões listadas. Rotas autenticadas sem permissão explícita são negadas. */
  permission?: Permission | Permission[];
  /** Usuário autenticado basta (ex.: /me, logout). Precisa ser declarado explicitamente. */
  anyAuthenticated?: boolean;
  body?: B;
  query?: Q;
  params?: P;
  /** Limite específico da rota, calculado a partir da configuração (ex.: login). */
  rateLimit?: (c: FastifyInstance['config']) => { max: number; timeWindow: string };
  handler: (ctx: {
    req: FastifyRequest;
    reply: FastifyReply;
    auth: AuthContext;
    body: z.infer<B>;
    query: z.infer<Q>;
    params: z.infer<P>;
    app: FastifyInstance;
  }) => Promise<unknown>;
};

export const routeRegistry: RouteDef[] = [];

export function defineRoute<B extends ZodTypeAny = ZodTypeAny, Q extends ZodTypeAny = ZodTypeAny, P extends ZodTypeAny = ZodTypeAny>(
  def: RouteDef<B, Q, P>,
): RouteDef<B, Q, P> {
  return def;
}

function parse<T extends ZodTypeAny>(schema: T | undefined, value: unknown, where: string) {
  if (!schema) return undefined;
  const r = schema.safeParse(value ?? {});
  if (!r.success) throw unprocessable(`Parâmetros inválidos em ${where}.`, zodToProblemErrors(r.error));
  return r.data;
}

export const IdParams = z.object({ id: z.string().uuid('ID inválido') });

export function registerRoutes(app: FastifyInstance, prefix: string, defs: RouteDef<any, any, any>[]) {
  for (const def of defs) {
    if (!def.public && !def.permission && !def.anyAuthenticated) {
      throw new Error(`Rota ${def.method} ${def.url} sem política de acesso declarada`);
    }
    routeRegistry.push({ ...def, url: prefix + def.url });
    app.route({
      method: def.method,
      url: prefix + def.url,
      config: def.rateLimit ? { rateLimit: def.rateLimit(app.config) } : undefined,
      handler: async (req, reply) => {
        let auth = req.auth;
        if (!def.public) {
          if (!auth) throw unauthorized();
          const required = def.permission ? (Array.isArray(def.permission) ? def.permission : [def.permission]) : [];
          for (const p of required) if (!auth.permissions.has(p)) throw forbidden();
        }
        // params primeiro: ID inválido é 404-like (422), nunca vaza erro de banco
        const params = parse(def.params, req.params, 'URL');
        const query = parse(def.query, req.query, 'consulta');
        const body = parse(def.body, req.body, 'corpo');
        const result = await def.handler({ req, reply, auth: auth as AuthContext, body, query, params, app });
        if (reply.sent) return;
        return result ?? reply.code(204).send();
      },
    });
  }
}
