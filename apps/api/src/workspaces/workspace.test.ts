import { describe, expect, it } from 'vitest';

import { WorkspaceContext, workspacePrismaProxy } from './workspace.js';

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
