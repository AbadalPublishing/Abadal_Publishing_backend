import { Inject, Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

/**
 * Wrapper around CacheModule that exposes a clean read-through pattern:
 *   const data = await cache.wrap('products:featured', 60_000, () => loadFromDb())
 *
 * Calls loader only on cache miss. Saves DB hits → less Railway compute & connection usage.
 * TTL is in milliseconds.
 */
@Injectable()
export class CacheHelper {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key)
    if (cached !== undefined && cached !== null) return cached
    const fresh = await loader()
    await this.cache.set(key, fresh, ttlMs)
    return fresh
  }

  async invalidate(prefix: string) {
    // cache-manager v5+ exposes `.stores[0].keys()` differently per backend.
    // For the in-memory store we use, we simulate prefix invalidation via known keys.
    // For simplicity, call `del` on exact keys you control.
    await this.cache.del(prefix)
  }

  async del(key: string) {
    await this.cache.del(key)
  }
}
