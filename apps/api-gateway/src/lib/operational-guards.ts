export type DependencyState = 'ready' | 'unavailable' | 'timed_out';

export type ReadinessReport = {
  status: 'ready' | 'not_ready';
  dependencies: Record<string, DependencyState>;
};

export type DependencyProbe = () => Promise<unknown>;

function timeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dependency_timeout')), timeoutMs)),
  ]);
}

export async function checkOperationalReadiness(checks: Record<string, DependencyProbe>, timeoutMs: number): Promise<ReadinessReport> {
  const dependencies: Record<string, DependencyState> = {};
  await Promise.all(Object.entries(checks).map(async ([name, probe]) => {
    try {
      await timeout(Promise.resolve().then(probe), timeoutMs);
      dependencies[name] = 'ready';
    } catch (error) {
      dependencies[name] = error instanceof Error && error.message === 'dependency_timeout' ? 'timed_out' : 'unavailable';
    }
  }));
  return { status: Object.values(dependencies).every((state) => state === 'ready') ? 'ready' : 'not_ready', dependencies };
}

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

type RateLimitBucket = { count: number; resetAt: number };

export class FixedWindowRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  take(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
  }
}

export type RedisScriptClient = {
  eval: (...args: any[]) => Promise<unknown>;
};

const fixedWindowLua = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  'return { current, ttl }',
].join('\n');

export class RedisFixedWindowRateLimiter {
  constructor(private readonly redis: RedisScriptClient) {}

  async take(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const result = await this.redis.eval(fixedWindowLua, 1, key, String(windowMs));
    if (!Array.isArray(result) || result.length < 2) throw new Error('Invalid distributed rate-limit response.');
    const [countValue, ttlValue] = result;
    const count = Number(countValue);
    const ttl = Math.max(0, Number(ttlValue));
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: now + ttl };
  }
}

export function trustedClientKey(headers: Headers, trustProxy: boolean) {
  if (trustProxy) {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return `ip:${forwarded}`;
  }
  return 'ip:unattributed';
}
