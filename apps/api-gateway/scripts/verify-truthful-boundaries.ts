import assert from 'node:assert/strict';
import { sign } from 'hono/jwt';
import app from '../src/index.js';

const env = {
  JWT_SECRET: 'audit-secret-with-sufficient-length',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  REDIS_URL: 'redis://localhost:6379/0',
  ENCRYPTION_KEY: 'audit-encryption-key',
};

async function request(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, init), env as never);
}

async function main() {
  const token = await sign({ sub: '11111111-1111-4111-8111-111111111111', email: 'audit@example.com', role: 'creator' }, env.JWT_SECRET, 'HS256');
  const creatorHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const directVideo = await request('/api/v1/videos', {
    method: 'POST',
    headers: creatorHeaders,
    body: JSON.stringify({ title: 'Audit source', sourceUrl: 'https://example.com/source.mp4', platforms: ['tiktok'] }),
  });
  assert.equal(directVideo.status, 410, 'Retired direct video creation must not claim upload success.');

  const directPublish = await request('/api/v1/videos/11111111-1111-4111-8111-111111111111/publish', { method: 'POST', headers: creatorHeaders });
  assert.equal(directPublish.status, 410, 'Retired direct publishing must not claim delivery success.');

  const recovery = await request('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'audit@example.com' }),
  });
  assert.equal(recovery.status, 503, 'Unimplemented recovery must not claim that an email was sent.');

  const exportRequest = await request('/api/v1/analytics/export', {
    method: 'POST',
    headers: creatorHeaders,
    body: JSON.stringify({ startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-26T00:00:00.000Z', format: 'csv' }),
  });
  assert.equal(exportRequest.status, 503, 'Unimplemented analytics exports must not claim completion.');

  console.log('Truthful-boundary verification passed.');
}

void main();
