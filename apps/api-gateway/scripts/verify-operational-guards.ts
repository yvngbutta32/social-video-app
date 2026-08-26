import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkOperationalReadiness, FixedWindowRateLimiter, RedisFixedWindowRateLimiter, trustedClientKey } from '../src/lib/operational-guards.js';
import api from '../src/index.js';

async function main() {
  const healthy = await checkOperationalReadiness({ database: async () => true, redis: async () => 'PONG', storage: async () => true }, 25);
  assert.deepEqual(healthy, { status: 'ready', dependencies: { database: 'ready', redis: 'ready', storage: 'ready' } });

  const degraded = await checkOperationalReadiness({ database: async () => { throw new Error('offline'); }, redis: async () => new Promise(() => undefined) }, 5);
  assert.equal(degraded.status, 'not_ready');
  assert.equal(degraded.dependencies.database, 'unavailable');
  assert.equal(degraded.dependencies.redis, 'timed_out');

  const limiter = new FixedWindowRateLimiter();
  assert.equal(limiter.take('auth:one', 2, 60_000, 1_000).allowed, true);
  assert.equal(limiter.take('auth:one', 2, 60_000, 1_001).remaining, 0);
  assert.equal(limiter.take('auth:one', 2, 60_000, 1_002).allowed, false);
  assert.equal(limiter.take('auth:one', 2, 60_000, 61_001).allowed, true);

  const redisCalls: string[][] = [];
  const distributed = new RedisFixedWindowRateLimiter({ eval: async (_script, _keys, ...args) => {
    redisCalls.push(args);
    return [3, 59_000];
  } });
  const distributedResult = await distributed.take('sensitive:user-1', 12, 60_000, 1_000);
  assert.deepEqual(distributedResult, { allowed: true, remaining: 9, resetAt: 60_000 });
  assert.deepEqual(redisCalls, [['sensitive:user-1', '60000']]);
  assert.equal(trustedClientKey(new Headers({ 'x-forwarded-for': '203.0.113.10, 198.51.100.3' }), true), 'ip:203.0.113.10');
  assert.equal(trustedClientKey(new Headers({ 'x-forwarded-for': '203.0.113.10' }), false), 'ip:unattributed');

  const callback = await api.fetch(new Request('http://localhost/api/v1/webhooks/platform/tiktok', { method: 'POST', body: '{}' }));
  assert.notEqual(callback.status, 401, 'Provider callbacks must reach their signature/configuration guard without a bearer token.');

  const readiness = await api.fetch(new Request('http://localhost/ready'));
  const readinessPayload = await readiness.json() as { status?: string; dependencies?: Record<string, string>; error?: string };
  assert(['ready', 'not_ready'].includes(readinessPayload.status || ''));
  assert.equal(typeof readinessPayload.dependencies?.database, 'string');
  assert.equal(typeof readinessPayload.dependencies?.redis, 'string');
  assert.equal(typeof readinessPayload.dependencies?.storage, 'string');
  assert.equal('error' in readinessPayload, false, 'Readiness must not return raw dependency errors.');

  let rateLimited = false;
  for (let attempt = 0; attempt < 13; attempt += 1) {
    const response = await api.fetch(new Request('http://localhost/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    if (response.status === 429) rateLimited = true;
  }
  assert.equal(rateLimited, true, 'Sensitive unauthenticated routes must return 429 after the bounded request budget is consumed.');

  const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(index, /checkOperationalReadiness/);
  assert.match(index, /bodyLimit/);
  assert.match(index, /FixedWindowRateLimiter/);
  assert.match(index, /RedisFixedWindowRateLimiter/);
  assert.match(index, /rateLimitCacheUnavailableUntil/);
  assert.match(index, /probePrivateSourceStorage/);
  assert.match(index, /webhooks\/platform/);
  console.log('Operational guard verification passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
