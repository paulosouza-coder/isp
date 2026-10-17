/**
 * Registro declarativo de rotas: cada rota declara o MÓDULO e o nível mínimo exigido.
 * O helper aplica autenticação, a matriz de segurança (negação por padrão), validação 422
 * e alimenta o OpenAPI. O escopo de registros (próprio/equipe/total) é aplicado nas consultas.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
import type { AccessLevel, Module } from '@isp/domain';
import { unauthorized, unprocessable, zodToProblemErrors } from './errors';
import type { AuthContext } from './context';
import { requireLevel } from '../services/scope';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RouteDef<B extends ZodTypeAny = ZodTypeAny, Q extends ZodTypeAny = ZodTypeAny, P extends ZodTypeAny = ZodTypeAny> = {
  method: Method;
  url: string;
  summary: string;
  tag: string;
  /** Rota pública (sem sessão). Use com parcimônia. */
  public?: boolean;
  /** Módulo da matriz de segurança e nível mínimo (padrão: Próprio). */
  module?: Module;
  min?: AccessLevel;
  /** Usuário autenticado basta (ex.: /me, logout). Precisa ser declarado explicitamente. */
  anyAuthenticated?: boolean;
  body?: B;
  query?: Q;
  params?: P;
  bodyLimit?: number;
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
    if (!def.public && !def.module && !def.anyAuthenticated) {
      throw new Error(`Rota ${def.method} ${def.url} sem política de acesso declarada`);
    }
    routeRegistry.push({ ...def, url: prefix + def.url });
    app.route({
      method: def.method,
      url: prefix + def.url,
      bodyLimit: def.bodyLimit,
      config: def.rateLimit ? { rateLimit: def.rateLimit(app.config) } : undefined,
      handler: async (req, reply) => {
        const auth = req.auth;
        if (!def.public) {
          if (!auth) throw unauthorized();
          if (def.module) requireLevel(auth, def.module, def.min ?? 'proprio');
        }
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
