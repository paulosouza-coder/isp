import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
// Parâmetros OWASP para scrypt: N=2^17, r=8, p=1 (~128 MiB). Usamos 2^15 em dev/teste para velocidade.
const N = process.env.NODE_ENV === 'production' ? 2 ** 17 : 2 ** 15;
const PARAMS = { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Hash fixo usado quando o e-mail não existe, para igualar o tempo de resposta (anti-enumeração). */
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
