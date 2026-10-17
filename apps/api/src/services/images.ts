import { createHash } from 'node:crypto';
import { unprocessable } from '../http/errors';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Valida imagem enviada em base64 pelos BYTES (não pela extensão nem pelo tipo declarado).
 * Aceita PNG, JPEG e WebP. SVG é recusado: pode conter script.
 */
export function decodeImage(b64: string): { data: Buffer; mime: 'image/png' | 'image/jpeg' | 'image/webp'; sha256: string } {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) throw unprocessable('Arquivo inválido.', [{ path: 'data', message: 'Conteúdo não está em base64' }]);
  const data = Buffer.from(clean, 'base64');
  if (data.length === 0) throw unprocessable('Arquivo vazio.');
  if (data.length > MAX_IMAGE_BYTES) throw unprocessable('Arquivo maior que 2 MB.', [{ path: 'data', message: 'Limite de 2 MB por imagem' }]);
  let mime: 'image/png' | 'image/jpeg' | 'image/webp' | null = null;
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = 'image/png';
  else if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) mime = 'image/jpeg';
  else if (data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') mime = 'image/webp';
  if (!mime) throw unprocessable('Formato não aceito. Envie PNG, JPG ou WebP.', [{ path: 'data', message: 'Formato não reconhecido (SVG não é aceito)' }]);
  return { data, mime, sha256: createHash('sha256').update(data).digest('hex') };
}
