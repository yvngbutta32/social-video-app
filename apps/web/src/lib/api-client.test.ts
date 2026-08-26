import { describe, expect, it } from 'vitest';
import { createApiHeaders } from './api-client';

describe('workspace-aware API headers', () => {
  it('adds creator authentication and an explicit workspace selection', () => {
    const headers = createApiHeaders({ method: 'POST', body: JSON.stringify({ source: 'private' }) }, 'access-token', 'workspace-1');
    expect(headers.get('authorization')).toBe('Bearer access-token');
    expect(headers.get('x-workspace-id')).toBe('workspace-1');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('keeps multipart uploads free of an incorrect JSON content type', () => {
    const body = new FormData();
    body.append('file', new Blob(['source']), 'source.mp4');
    const headers = createApiHeaders({ method: 'POST', body }, 'access-token', 'workspace-1');
    expect(headers.get('content-type')).toBeNull();
    expect(headers.get('x-workspace-id')).toBe('workspace-1');
  });
});
