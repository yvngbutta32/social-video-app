import { describe, expect, it } from 'vitest';
import { parseOwnerClients, parseOwnerOperationalHealth } from './owner-overview-contract';

describe('owner oversight projections', () => {
  it('parses only safe client summary fields', () => {
    const clients = parseOwnerClients({ data: [{ id: 'w1', name: 'Creator One', slug: 'creator-one', status: 'active', publishingPaused: false, connectedPlatforms: ['tiktok'], counts: { members: 1, videos: 2, socialAccounts: 1, abTests: 0 }, updatedAt: '2026-08-26T00:00:00.000Z', secret: 'never' }] });
    expect(clients).toEqual([{ id: 'w1', name: 'Creator One', slug: 'creator-one', status: 'active', publishingPaused: false, connectedPlatforms: ['tiktok'], counts: { members: 1, videos: 2, socialAccounts: 1, abTests: 0 }, updatedAt: '2026-08-26T00:00:00.000Z' }]);
  });

  it('accepts only named safe readiness states', () => {
    expect(parseOwnerOperationalHealth({ data: { status: 'not_ready', dependencies: { database: 'ready', storage: 'timed_out', hidden: 'raw_error' }, timestamp: '2026-08-26T00:00:00.000Z' } })).toEqual({ status: 'not_ready', dependencies: { database: 'ready', storage: 'timed_out' }, timestamp: '2026-08-26T00:00:00.000Z' });
  });
});
