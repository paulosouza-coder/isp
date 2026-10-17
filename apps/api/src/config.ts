import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().default(3333),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  COOKIE_SECRET: z.string().min(32).optional(),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

export type Config = {
  databaseUrl: string;
  port: number;
  webOrigins: string[];
  cookieSecure: boolean;
  sessionTtlHours: number;
  isProd: boolean;
  logLevel: string;
  cookieSecret: string;
  loginRateLimitPerMinute: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = Env.parse(env);
  const isProd = e.NODE_ENV === 'production';
  if (isProd && !e.COOKIE_SECRET) throw new Error('COOKIE_SECRET (>= 32 caracteres) é obrigatório em produção');
  if (isProd && !e.COOKIE_SECURE) throw new Error('COOKIE_SECURE=true é obrigatório em produção (HTTPS)');
  return {
    cookieSecret: e.COOKIE_SECRET ?? 'dev-only-cookie-secret-change-me-0123456789',
    databaseUrl: e.DATABASE_URL,
    port: e.API_PORT,
    webOrigins: e.WEB_ORIGIN.split(',').map((s) => s.trim()),
    cookieSecure: e.COOKIE_SECURE,
    sessionTtlHours: e.SESSION_TTL_HOURS,
    isProd,
    loginRateLimitPerMinute: e.LOGIN_RATE_LIMIT_PER_MINUTE,
    logLevel: e.LOG_LEVEL,
  };
}
