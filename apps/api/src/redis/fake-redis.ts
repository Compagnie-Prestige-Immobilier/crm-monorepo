import { fakeWorkspace } from '../workspaces/fake-workspace.js';
import { RedisService, type RedisClient } from './redis.service.js';

/** Redis en mémoire pour les tests : trois commandes, une horloge pilotable. */
export class FakeRedis implements RedisClient {
  readonly store = new Map<string, { value: string; expiresAt: number }>();
  now = 0;
  failing = false;

  async get(key: string): Promise<string | null> {
    if (this.failing) throw new Error('redis down');
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, _mode: 'EX', seconds: number): Promise<'OK'> {
    if (this.failing) throw new Error('redis down');
    this.store.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    if (this.failing) throw new Error('redis down');
    let removed = 0;
    for (const key of keys) if (this.store.delete(key)) removed += 1;
    return removed;
  }

  async incr(key: string): Promise<number> {
    if (this.failing) throw new Error('redis down');
    const next = Number((await this.get(key)) ?? '0') + 1;
    this.store.set(key, { value: String(next), expiresAt: Number.MAX_SAFE_INTEGER });
    return next;
  }
}

export const fakeRedisService = (client: RedisClient | null = new FakeRedis()): RedisService =>
  new RedisService(fakeWorkspace(), client);
