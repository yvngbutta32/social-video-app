import crypto from 'crypto';
import config from './config.js';
import logger from './logger.js';

const ALGORITHM = config.ENCRYPTION_ALGORITHM;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, config.KEY_DERIVATION_ITERATIONS, KEY_LENGTH, 'sha256');
}

function generateKeyId() {
  return crypto.randomBytes(8).toString('hex');
}

export function encrypt(buffer, password = config.ENCRYPTION_KEY) {
  if (!password) {
    throw new Error('Encryption key not configured');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const keyId = generateKeyId();

  return {
    encrypted,
    salt,
    iv,
    authTag,
    keyId,
    algorithm: ALGORITHM,
  };
}

export function decrypt(encryptedData, password = config.ENCRYPTION_KEY) {
  if (!password) {
    throw new Error('Encryption key not configured');
  }

  const { encrypted, salt, iv, authTag } = encryptedData;
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted;
}

export async function encryptStream(readableStream, password = config.ENCRYPTION_KEY) {
  if (!password) {
    throw new Error('Encryption key not configured');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const keyId = generateKeyId();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const authTagPromise = new Promise((resolve) => {
    cipher.on('end', () => resolve(cipher.getAuthTag()));
  });

  const encryptedChunks = [];
  for await (const chunk of readableStream) {
    encryptedChunks.push(cipher.update(chunk));
  }
  encryptedChunks.push(cipher.final());
  const authTag = await authTagPromise;

  return {
    encrypted: Buffer.concat(encryptedChunks),
    salt,
    iv,
    authTag,
    keyId,
    algorithm: ALGORITHM,
  };
}

export async function decryptStream(encryptedData, password = config.ENCRYPTION_KEY) {
  if (!password) {
    throw new Error('Encryption key not configured');
  }

  const { encrypted, salt, iv, authTag } = encryptedData;
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedChunks = [];
  for await (const chunk of encrypted) {
    decryptedChunks.push(decipher.update(chunk));
  }
  decryptedChunks.push(decipher.final());

  return Buffer.concat(decryptedChunks);
}

export function calculateChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function calculateStreamChecksum(readableStream) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    readableStream.on('data', (chunk) => hash.update(chunk));
    readableStream.on('end', () => resolve(hash.digest('hex')));
    readableStream.on('error', reject);
  });
}

export { generateKeyId };