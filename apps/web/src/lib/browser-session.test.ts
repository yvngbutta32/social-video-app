import { describe, expect, it } from 'vitest';
import { resolveWorkspaceSelection, type BrowserWorkspace } from './browser-session';

describe('browser workspace selection', () => {
  const workspaces: BrowserWorkspace[] = [
    { id: 'workspace-a', name: 'A', slug: 'a' },
    { id: 'workspace-b', name: 'B', slug: 'b' },
  ];

  it('preserves a still-authorized explicit selection', () => {
    expect(resolveWorkspaceSelection(workspaces, 'workspace-b')).toBe('workspace-b');
  });

  it('selects the only authorized workspace and requires choice for multiple workspaces', () => {
    expect(resolveWorkspaceSelection([{ id: 'workspace-a', name: 'A', slug: 'a' }])).toBe('workspace-a');
    expect(resolveWorkspaceSelection(workspaces)).toBeNull();
    expect(resolveWorkspaceSelection(workspaces, 'stale')).toBeNull();
  });
});
