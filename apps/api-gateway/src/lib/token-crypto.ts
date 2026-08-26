import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

function keyFromSecret(secret: string, salt: Buffer) {
  if (!secret) throw new Error('ENCRYPTION_KEY is required for token storage');
  return crypto.pbkdf2Sync(secret, salt, 120_000, KEY_LENGTH, 'sha256');
}

export function encryptToken(token: string, secret = process.env.ENCRYPTION_KEY) {
  if (!token) throw new Error('Cannot encrypt an empty token');
  if (!secret) throw new Error('ENCRYPTION_KEY is required for token storage');
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFromSecret(secret, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, salt, iv, tag, ciphertext].map((value) => value.toString('base64url')).join('.');
}

export function decryptToken(payload: string, secret = process.env.ENCRYPTION_KEY) {
  const [version, saltEncoded, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
  if (version !== VERSION || !saltEncoded || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Unsupported encrypted token format');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyFromSecret(secret || '', Buffer.from(saltEncoded, 'base64url')), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8');
}

export function isEncryptedToken(payload: string | null | undefined) {
  return Boolean(payload?.startsWith(`${VERSION}.`));
}
