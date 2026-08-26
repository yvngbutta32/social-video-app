import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function main() {
  const ownerRoute = await readFile(new URL('../src/routes/owner.ts', import.meta.url), 'utf8');
  const readiness = await readFile(new URL('../src/lib/deployment-readiness.ts', import.meta.url), 'utf8');
  assert.match(ownerRoute, /app\.get\('\/operational-health'/);
  assert.match(ownerRoute, /requirePlatformOwner/);
  assert.match(ownerRoute, /getDeploymentReadiness/);
  assert.match(ownerRoute, /operational_health_viewed/);
  assert.match(readiness, /database/);
  assert.match(readiness, /redis/);
  assert.match(readiness, /storage/);
  assert.doesNotMatch(ownerRoute, /MINIO_SECRET_KEY|REDIS_URL|DATABASE_URL/);
  console.log('Owner operational health contract verified');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
