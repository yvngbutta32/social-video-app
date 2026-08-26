export type OwnerClientSummary = {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'paused' | 'deactivated';
  publishingPaused: boolean;
  connectedPlatforms: string[];
  counts: { members: number; videos: number; socialAccounts: number; abTests: number };
  updatedAt: string;
};

export type OwnerOperationalHealth = {
  status: 'ready' | 'not_ready';
  dependencies: Record<string, 'ready' | 'unavailable' | 'timed_out'>;
  timestamp: string;
};

export function parseOwnerClients(payload: unknown): OwnerClientSummary[] {
  const rows = (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) throw new Error('The private portfolio overview is unavailable.');
  return rows.flatMap((row) => {
    const value = row as Record<string, unknown>;
    const counts = value.counts as Record<string, unknown> | undefined;
    if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.slug !== 'string' || !counts) return [];
    const status = value.status;
    if (status !== 'pending' && status !== 'active' && status !== 'paused' && status !== 'deactivated') return [];
    const number = (key: string) => typeof counts[key] === 'number' && Number.isFinite(counts[key]) ? counts[key] : 0;
    return [{
      id: value.id,
      name: value.name,
      slug: value.slug,
      status,
      publishingPaused: value.publishingPaused === true,
      connectedPlatforms: Array.isArray(value.connectedPlatforms) ? value.connectedPlatforms.filter((platform): platform is string => typeof platform === 'string') : [],
      counts: { members: number('members'), videos: number('videos'), socialAccounts: number('socialAccounts'), abTests: number('abTests') },
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    }];
  });
}

export function parseOwnerOperationalHealth(payload: unknown): OwnerOperationalHealth {
  const data = (payload as { data?: unknown })?.data as Record<string, unknown> | undefined;
  if (!data || (data.status !== 'ready' && data.status !== 'not_ready') || !data.dependencies || typeof data.timestamp !== 'string') {
    throw new Error('The private operational health view is unavailable.');
  }
  const dependencies: Record<string, 'ready' | 'unavailable' | 'timed_out'> = {};
  for (const [name, state] of Object.entries(data.dependencies as Record<string, unknown>)) {
    if (state === 'ready' || state === 'unavailable' || state === 'timed_out') dependencies[name] = state;
  }
  return { status: data.status, dependencies, timestamp: data.timestamp };
}
