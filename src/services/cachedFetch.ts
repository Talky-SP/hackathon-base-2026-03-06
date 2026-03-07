import { authenticatedFetch } from './authFetch';

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function cachedFetch<T = unknown>(
  url: string,
  options?: { ttl?: number; init?: RequestInit },
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTL_MS;
  const entry = cache.get(url);

  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }

  const res = await authenticatedFetch(url, options?.init);
  const data: T = await res.json();

  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

export function clearCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) {
      cache.delete(key);
    }
  }
}
