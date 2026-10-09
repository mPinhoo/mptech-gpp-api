import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { AppError } from '../utils/errors.js';
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function secureEqual(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function statusToken(id: string) {
  const secret = process.env.BILLING_STATUS_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError('Configuração de cobrança incompleta.', 503);
  return createHmac('sha256', secret).update(id).digest('hex');
}
function encryptionKey() {
  const key = Buffer.from(process.env.BILLING_ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32)
    throw new AppError('Chave da fila de emails inválida.', 503);
  return key;
}
export function encrypt(data: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((x) => x.toString('base64'))
    .join('.');
}
export function decrypt<T>(value: string): T {
  const [iv, tag, bytes] = value
    .split('.')
    .map((x) => Buffer.from(x, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'),
  );
}
