import assert from 'node:assert/strict';
import { sign } from 'hono/jwt';
import app from '../src/index.js';
import { buildAnalyticsMetricWhere, latestMetricSnapshots, summarizeMetricSnapshots } from '../src/lib/analytics-integrity.js';

const secret = 'analytics-integrity-verification-secret';
const env = {
  JWT_SECRET: secret,
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  REDIS_URL: 'redis://localhost:6379/0',
  ENCRYPTION_KEY: 'audit-encryption-key',
};

async function main() {
  const where = buildAnalyticsMetricWhere(
    '11111111-1111-4111-8111-111111111111',
    new Date('2026-08-01T00:00:00.000Z'),
    new Date('2026-08-31T23:59:59.000Z'),
    {
      platform: 'tiktok',
      campaignId: '22222222-2222-4222-8222-222222222222',
      videoId: '33333333-3333-4333-8333-333333333333',
      accountId: '44444444-4444-4444-8444-444444444444',
    },
  );
  assert.equal(where.platform, 'tiktok');
  assert.equal(Array.isArray((where.scheduledPost as { AND?: unknown[] }).AND), true, 'Campaign, video, and account filters must compose under one scheduled-post AND clause.');
  assert.equal((where.scheduledPost as { AND: unknown[] }).AND.length, 3, 'No requested filter may overwrite another requested filter.');

  const latest = latestMetricSnapshots([
    { id: 'old', scheduledPostId: 'post-a', platform: 'tiktok', recordedAt: new Date('2026-08-02T00:00:00.000Z'), importedAt: new Date('2026-08-02T00:00:01.000Z'), views: 50n, likes: 5n },
    { id: 'new', scheduledPostId: 'post-a', platform: 'tiktok', recordedAt: new Date('2026-08-03T00:00:00.000Z'), importedAt: new Date('2026-08-03T00:00:01.000Z'), views: 120n, likes: 12n },
    { id: 'other', scheduledPostId: 'post-b', platform: 'instagram', recordedAt: new Date('2026-08-03T00:00:00.000Z'), importedAt: new Date('2026-08-03T00:00:01.000Z'), views: 40n, likes: 4n },
  ]);
  assert.deepEqual(latest.map((metric) => metric.id).sort(), ['new', 'other'], 'Only the newest observation per scheduled post may be retained.');
  const summary = summarizeMetricSnapshots(latest);
  assert.equal(summary.views, 160, 'Latest snapshots must not double-count historic values.');
  assert.equal(summary.likes, 16, 'Latest snapshots must preserve distinct post observations.');

  const token = await sign({ sub: '55555555-5555-4555-8555-555555555555', email: 'creator@example.test', role: 'creator' }, secret, 'HS256');
  const request = new Request('http://localhost/api/v1/analytics/overview?startDate=2026-08-01T00%3A00%3A00.000Z&endDate=2026-08-31T23%3A59%3A59.000Z', {
    headers: { authorization: `Bearer ${token}` },
  });
  const response = await app.fetch(request, env as never);
  assert.equal(response.status, 400, 'Analytics must reject requests without an explicit workspace context before querying data.');

  console.log('Analytics integrity verification passed.');
}

void main();
