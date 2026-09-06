import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { WorkspaceContext } from '../workspaces/workspace.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  quit?(): Promise<unknown>;
}

/**
 * Un cache qui ne fait jamais échouer une requête : Redis absent, lent ou
 * tombé, la charge retombe sur Postgres et un seul avertissement est écrit
 * jusqu'au retour de la connexion.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    private readonly workspace: WorkspaceContext,
    private readonly client: RedisClient | null,
  ) {}

  static open(url: string | undefined, logger = new Logger(RedisService.name)): Redis | null {
    if (!url) return null;
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
    let warned = false;
    client.on('error', (error: Error) => {
      if (warned) return;
      warned = true;
      logger.warn(`Redis injoignable, cache désactivé : ${error.message}`);
    });
    // Cache pur, borné : posé ici plutôt que dans chaque compose et Dokploy.
    client.on('ready', () => {
      warned = false;
      void client
        .config('SET', 'maxmemory', '128mb')
        .then(() => client.config('SET', 'maxmemory-policy', 'allkeys-lru'))
        .then(() => client.config('SET', 'save', ''))
        .catch((error: Error) => logger.warn(`Redis : réglage mémoire refusé : ${error.message}`));
    });
    void client.connect().catch(() => undefined);
    return client;
  }

  /** Avec un `group`, la clé porte la version du groupe : `bump` invalide tout d'un coup. */
  async cached<T>(
    name: string,
    ttlSeconds: number,
    load: () => Promise<T>,
    group?: string,
  ): Promise<T> {
    if (!this.client) return load();
    const key = group ? `${group}:${await this.version(group)}:${name}` : name;
    const hit = await this.client.get(this.key(key)).catch(() => null);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    if (value !== undefined) {
      void this.client
        .set(this.key(key), JSON.stringify(value), 'EX', ttlSeconds)
        .catch(() => undefined);
    }
    return value;
  }

  async bust(...names: string[]): Promise<void> {
    if (!this.client || !names.length) return;
    await this.client.del(...names.map((name) => this.key(name))).catch(() => undefined);
  }

  async bump(group: string): Promise<void> {
    await this.client?.incr(this.key(`v:${group}`)).catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit?.().catch(() => undefined);
  }

  private async version(group: string): Promise<string> {
    return (await this.client?.get(this.key(`v:${group}`)).catch(() => null)) ?? '0';
  }

  private key(name: string): string {
    return `cpi:${this.workspace.current()}:${name}`;
  }
}
