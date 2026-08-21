import CryptoJS from 'crypto-js';
import { getConfig } from './config.js';

const config = getConfig();

const ENCRYPTION_KEY = CryptoJS.enc.Hex.parse(config.ENCRYPTION_KEY);
const ENCRYPTION_IV = CryptoJS.enc.Hex.parse(config.ENCRYPTION_IV);

export function encrypt(data: string): string {
  const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY, {
    iv: ENCRYPTION_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

export function decrypt(encryptedData: string): string {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY, {
    iv: ENCRYPTION_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export function encryptBuffer(buffer: Buffer): string {
  return encrypt(buffer.toString('base64'));
}

export function decryptToBuffer(encryptedData: string): Buffer {
  const decrypted = decrypt(encryptedData);
  return Buffer.from(decrypted, 'base64');
}

export function generateChecksum(data: Buffer): string {
  return CryptoJS.SHA256(CryptoJS.enc.Base64.stringify(CryptoJS.enc.Base64.parse(data.toString('base64')))).toString(CryptoJS.enc.Hex);
}