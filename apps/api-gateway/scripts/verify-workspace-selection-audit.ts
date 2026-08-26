import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '../src/routes/auth.ts'), 'utf8');
const required = [
  "app.post('/workspace-selection'",
  "c.req.header('x-workspace-id')",
  "workspaceMember.findFirst({ where: { userId: user.id, workspaceId }",
  "prisma.auditLog.create",
  "action: 'workspace_selected'",
  "resourceType: 'workspace'",
];
for (const value of required) {
  if (!source.includes(value)) throw new Error(`Workspace selection audit contract is missing: ${value}`);
}
console.log('Workspace selection audit contract verified');
