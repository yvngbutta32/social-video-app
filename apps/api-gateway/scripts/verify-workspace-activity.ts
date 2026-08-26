import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '../src/routes/auth.ts'), 'utf8');
const required = [
  "app.get('/workspace-activity'",
  "workspaceActivityQuerySchema",
  "c.req.header('x-workspace-id')",
  "workspaceMember.findFirst({ where: { userId: user.id, workspaceId }",
  "action: { in: [...creatorActivityActions] }",
  "select: { action: true, resourceType: true, createdAt: true }",
];
for (const value of required) if (!source.includes(value)) throw new Error(`Workspace activity contract is missing: ${value}`);
if (source.includes("select: { action: true, resourceType: true, createdAt: true, userAgent")) throw new Error('Workspace activity must not expose user-agent data.');
console.log('Workspace activity contract verified');
