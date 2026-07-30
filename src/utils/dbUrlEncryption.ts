import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = process.env.DB_URL_ENCRYPTION_KEY;
  if (!secret) throw new Error('DB_URL_ENCRYPTION_KEY environment variable is required');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptDbUrl(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptDbUrl(data: string): string {
  const parts = data.split(':');
  if (parts.length !== 3) return data;
  try {
    const key = getKey();
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return data;
  }
}
