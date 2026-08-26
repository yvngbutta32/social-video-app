import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('../src/routes/videos.ts', import.meta.url), 'utf8');
const listRoute = source.slice(source.indexOf("app.get('/',"), source.indexOf("app.post('/uploads/multipart/initiate'"));
const liveSourceRoutes = source.slice(source.indexOf("app.get('/',"), source.indexOf("app.post('/', zValidator"));
const updateRoute = source.slice(source.indexOf("app.patch('/:id'"), source.indexOf("app.delete('/:id'"));
const deleteRoute = source.slice(source.indexOf("app.delete('/:id'"), source.indexOf("app.post('/:id/publish'"));
const duplicateRoute = source.slice(source.indexOf("app.post('/:id/duplicate'"), source.indexOf("app.get('/:id/analytics'"));
const analyticsRoute = source.slice(source.indexOf("app.get('/:id/analytics'"), source.indexOf("return app;"));

assert.match(listRoute, /workspaceForReadRequest\(c, user\)/, 'Source listing must authorize an explicit workspace selection.');
assert.match(liveSourceRoutes, /app\.post\('\/upload'[\s\S]*?creatorWorkspaceForRequest\(c, user\)/, 'Legacy upload must authorize an explicit creator workspace.');
assert.match(liveSourceRoutes, /app\.get\('\/:id'[\s\S]*?workspaceForReadRequest\(c, user\)/, 'Source detail must authorize an explicit workspace selection.');
assert.doesNotMatch(liveSourceRoutes, /workspaceMember\.findFirst/, 'Live source routes must not choose an arbitrary first membership.');
assert.match(liveSourceRoutes, /jsonSafe\(\{ data: video \}\)/, 'Source detail must be JSON-safe for database BigInts.');
for (const route of [updateRoute, deleteRoute, duplicateRoute, analyticsRoute]) {
  assert.doesNotMatch(route, /workspaceMember\.findFirst/, 'Active residual source routes must not choose an arbitrary first membership.');
}
assert.match(updateRoute, /creatorWorkspaceForRequest\(c, user\)/, 'Source updates require explicit creator workspace authorization.');
assert.match(deleteRoute, /creatorWorkspaceForRequest\(c, user\)/, 'Source deletion requires explicit creator workspace authorization.');
assert.match(duplicateRoute, /creatorWorkspaceForRequest\(c, user\)/, 'Source duplication requires explicit creator workspace authorization.');
assert.match(analyticsRoute, /workspaceForReadRequest\(c, user\)/, 'Source analytics requires explicit workspace read authorization.');

console.log('Workspace-scoped source listing contract verified.');
