import { readFile } from 'node:fs/promises';

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const growthRoute = new URL('../src/routes/growth.ts', import.meta.url);
  const source = await readFile(growthRoute, 'utf8');

  expect(source.includes("requireSelectedWorkspaceResourceAccess"), 'Growth routes must use selected-workspace read access.');
  expect(source.includes("requireSelectedCreatorWorkspaceResourceAccess"), 'Growth recipe mutations must use selected creator-workspace access.');
  expect(!source.includes('requireWorkspaceAccess(actor,'), 'Growth routes must not bypass selected-workspace request scope.');
  expect(!source.includes('requireCreatorWorkspaceAccess(actor,'), 'Growth creator mutations must not bypass selected-workspace request scope.');

  for (const route of [
    "app.post('/experiment-plan'",
    "app.get('/adaptations/:variantId'",
    "app.get('/adaptations/:variantId/preview'",
    "app.put('/adaptations/:variantId'",
    "app.get('/readiness/:videoId'",
    "app.get('/learning-signal/:videoId'",
    "app.get('/scorecard/:videoId'",
  ]) {
    expect(source.includes(route), `Expected retained growth route: ${route}`);
  }

  console.log('Growth workspace-resolution contract verified.');
}

void main();
