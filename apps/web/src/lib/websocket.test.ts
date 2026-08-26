import { describe, expect, it } from 'vitest';
import { parseMessage } from './websocket';

describe('parseMessage', () => {
  it('accepts a complete typed websocket event', () => {
    expect(parseMessage(JSON.stringify({
      type: 'metrics_update',
      payload: { id: 'metric-1', platform: 'tiktok' },
      timestamp: '2026-08-26T00:00:00.000Z',
    }))).toEqual({
      type: 'metrics_update',
      payload: { id: 'metric-1', platform: 'tiktok' },
      timestamp: '2026-08-26T00:00:00.000Z',
    });
  });

  it('rejects malformed events before they reach creator workflow state', () => {
    expect(parseMessage('{not-json')).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 'metrics_update', payload: [], timestamp: '2026-08-26T00:00:00.000Z' }))).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 42, payload: {}, timestamp: '2026-08-26T00:00:00.000Z' }))).toBeNull();
  });
});
