import crypto from 'crypto';
import { readFileSync } from 'fs';

const SUPPORTED_PLATFORM_WEBHOOKS = ['tiktok', 'instagram', 'youtube'] as const;
type SupportedPlatformWebhook = (typeof SUPPORTED_PLATFORM_WEBHOOKS)[number];
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

function readSecret(name: string) {
  const direct = process.env[name];
  if (direct) return direct.trim();
  const file = process.env[`${name}_FILE`];
  if (!file) return '';
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

export function getPlatformWebhookSecret(platform: string) {
  if (!SUPPORTED_PLATFORM_WEBHOOKS.includes(platform as SupportedPlatformWebhook)) return '';
  return readSecret(`${platform.toUpperCase()}_WEBHOOK_SECRET`);
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, '').toLowerCase();
}

export function verifyPlatformWebhook(input: { platform: string; payload: string; signature?: string | null; timestamp?: string | null; now?: Date }) {
  const secret = getPlatformWebhookSecret(input.platform);
  if (!secret) return { configured: false, valid: false, reason: 'provider_webhook_not_configured' as const };
  if (!input.signature) return { configured: true, valid: false, reason: 'signature_missing' as const };

  if (input.timestamp) {
    const timestampMs = Number(input.timestamp) * (input.timestamp.length <= 10 ? 1000 : 1);
    const now = (input.now ?? new Date()).getTime();
    if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
      return { configured: true, valid: false, reason: 'timestamp_out_of_window' as const };
    }
  }

  const expected = crypto.createHmac('sha256', secret).update(input.payload).digest('hex');
  const supplied = normalizeSignature(input.signature);
  const expectedBytes = Buffer.from(expected, 'hex');
  const suppliedBytes = Buffer.from(supplied, 'hex');
  if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
    return { configured: true, valid: false, reason: 'signature_invalid' as const };
  }

  return { configured: true, valid: true, reason: 'verified' as const };
}

export { MAX_TIMESTAMP_AGE_MS, SUPPORTED_PLATFORM_WEBHOOKS };
