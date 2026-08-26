import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('../src/routes/videos.ts', import.meta.url), 'utf8');
const listRoute = source.slice(source.indexOf("app.get('/',"), source.indexOf("app.post('/uploads/multipart/initiate'"));
const liveSourceRoutes = source.slice(source.indexOf("app.get('/',"), source.indexOf("app.post('/', zValidator"));

assert.match(listRoute, /workspaceForReadRequest\(c, user\)/, 'Source listing must authorize an explicit workspace selection.');
assert.match(liveSourceRoutes, /app\.post\('\/upload'[\s\S]*?creatorWorkspaceForRequest\(c, user\)/, 'Legacy upload must authorize an explicit creator workspace.');
assert.match(liveSourceRoutes, /app\.get\('\/:id'[\s\S]*?workspaceForReadRequest\(c, user\)/, 'Source detail must authorize an explicit workspace selection.');
assert.doesNotMatch(liveSourceRoutes, /workspaceMember\.findFirst/, 'Live source routes must not choose an arbitrary first membership.');
assert.match(liveSourceRoutes, /jsonSafe\(\{ data: video \}\)/, 'Source detail must be JSON-safe for database BigInts.');

console.log('Workspace-scoped source listing contract verified.');
