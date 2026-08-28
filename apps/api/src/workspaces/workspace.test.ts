import { describe, expect, it } from 'vitest';

import { WorkspaceContext, workspacePrismaProxy } from './workspace.js';

describe('WorkspaceContext', () => {
  // Un garde entre dans l'espace, puis le pipeline repart d'un contexte
  // antérieur avant d'appeler le handler : le store de `run` doit survivre.
  it('l’espace choisi dans un garde est encore lu par le handler', async () => {
    const context = new WorkspaceContext();
    const vu = await context.run(async () => {
      await Promise.resolve();
      context.enter('demo');
      await new Promise<void>((resolve) => setImmediate(resolve));
      return context.current();
    });
    expect(vu).toBe('demo');
    expect(context.current()).toBe('public');
  });

  it('deux requêtes ne partagent pas leur espace', async () => {
    const context = new WorkspaceContext();
    const [a, b] = await Promise.all([
      context.run(async () => {
        context.enter('demo');
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        return context.current();
      }),
      context.run(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
        return context.current();
      }),
    ]);
    expect([a, b]).toEqual(['demo', 'public']);
  });
});

describe('workspacePrismaProxy', () => {
  it('route chaque lecture vers le workspace courant', () => {
    const context = new WorkspaceContext();
    const clients = {
      get: (workspace: 'public' | 'demo') => ({ marker: workspace }),
    };
    const prisma = workspacePrismaProxy(clients as never, context) as unknown as {
      marker: string;
    };

    expect(prisma.marker).toBe('public');
    context.enter('demo');
    expect(prisma.marker).toBe('demo');
  });
});
