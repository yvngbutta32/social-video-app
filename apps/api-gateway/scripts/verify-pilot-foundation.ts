import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOwnerRoutes } from '../src/routes/owner.js';
import { mergePilotSettings } from '../src/lib/pilot-access.js';

async function main() {
  const schemaPath = new URL('../../web/prisma/schema.prisma', import.meta.url);
  const migrationPath = new URL('../../web/prisma/migrations/2_closed_pilot_invites/migration.sql', import.meta.url);
  const authPath = new URL('../src/routes/auth.ts', import.meta.url);

  const [schema, migration, authSource] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(migrationPath, 'utf8'),
    readFile(authPath, 'utf8'),
  ]);

  assert.match(schema, /workspaceId\s+String\?/);
  assert.match(schema, /workspace\s+Workspace\?\s+@relation\(fields: \[workspaceId\], references: \[id\], onDelete: SetNull\)/);
  assert.match(migration, /ADD COLUMN "workspace_id" TEXT/i);
  assert.match(migration, /FOREIGN KEY \("workspace_id"\)/i);

  assert.match(authSource, /inviteCode:\s*z\.string\(\)\.min\(8\)/);
  assert.match(authSource, /A valid pilot invitation is required/);
  assert.match(authSource, /workspaceId:\s*workspace\.id/);
  assert.doesNotMatch(authSource, /Create default workspace for user/);

  const app = createOwnerRoutes();
  const routeSignatures = app.routes.map((route: { method: string; path: string }) => `${route.method} ${route.path}`);
  for (const requiredRoute of [
    'GET /clients',
    'POST /invites',
    'POST /invites/:id/revoke',
    'GET /clients/:id',
  ]) {
    assert(routeSignatures.includes(requiredRoute), `Missing required owner route: ${requiredRoute}`);
  }

  assert(!routeSignatures.some((route) => /\/clients\/:id\/(pause|resume)/.test(route)), 'Developer route must not control creator publishing');

  const merged = mergePilotSettings({ pilotStatus: 'pending', untouched: true }, { publishingPaused: true });
  assert.equal(merged.pilotStatus, 'pending');
  assert.equal(merged.publishingPaused, true);
  assert.equal((merged as Record<string, unknown>).untouched, true);

  console.log('Pilot foundation contract verification passed.');
  console.log(`Verified ${routeSignatures.length} owner routes with creator-autonomy safeguards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
