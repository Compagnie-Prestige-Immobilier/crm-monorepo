import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@crm/database';

export const WORKSPACES = ['public', 'demo'] as const;
export type Workspace = (typeof WORKSPACES)[number];

@Injectable()
export class WorkspaceContext {
  private readonly storage = new AsyncLocalStorage<Workspace>();

  enter(workspace: Workspace): void {
    this.storage.enterWith(workspace);
  }

  current(): Workspace {
    return this.storage.getStore() ?? 'public';
  }
}

export function workspacePrismaProxy(
  clients: { get(workspace: Workspace): PrismaClient },
  context: WorkspaceContext,
): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, property): unknown {
      const client = clients.get(context.current());
      const value = Reflect.get(client, property, client) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const result = Reflect.apply(value, client, args) as unknown;
        return result;
      };
    },
  });
}
