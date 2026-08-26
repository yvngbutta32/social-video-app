import assert from 'node:assert/strict';
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
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(login.status, 400, 'Public login must reach validation instead of JWT middleware.');

  const register = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(register.status, 400, 'Public invitation registration must reach validation instead of JWT middleware.');

  const refresh = await request('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'refreshToken=not-a-valid-jwt' },
    body: JSON.stringify({}),
  });
  assert.equal(refresh.status, 401, 'Public refresh must validate its cookie token instead of requiring an access JWT.');
  const refreshBody = await refresh.json() as { error?: string };
  assert.match(refreshBody.error || '', /refresh token/i);

  const protectedRoute = await request('/api/v1/accounts');
  assert.equal(protectedRoute.status, 401, 'Creator account routes must remain JWT-protected.');

  console.log('Authentication boundary verification passed.');
}

void main();
