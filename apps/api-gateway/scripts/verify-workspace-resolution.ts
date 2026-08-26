import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routes = ['accounts.ts', 'campaigns.ts', 'webhooks.ts', 'videos.ts'];

function activeSource(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

async function main() {
  for (const route of routes) {
    const source = activeSource(await readFile(new URL(`../src/routes/${route}`, import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /workspaceMember\.findFirst/, `${route} must not choose an arbitrary first workspace membership.`);
    assert.match(source, /x-workspace-id/, `${route} must require explicit workspace selection for live creator data routes.`);
  }
  for (const route of ['accounts.ts', 'campaigns.ts', 'webhooks.ts']) {
    const source = activeSource(await readFile(new URL(`../src/routes/${route}`, import.meta.url), 'utf8'));
    assert.match(source, /requireCreatorWorkspaceAccess/, `${route} must retain a creator-only mutation authorization boundary.`);
  }
  console.log('Uniform explicit workspace-resolution contract verified.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
