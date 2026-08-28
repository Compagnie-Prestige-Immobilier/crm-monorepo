import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { StatsLayoutScreen } from './dto.js';
import { StatsLayoutService } from './stats-layout.service.js';

function prismaStub() {
  const store = new Map<string, { key: string; value: string; updatedAt: Date }>();
  return {
    appSetting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(store.get(where.key) ?? null),
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { key: string };
        create: { key: string; value: string };
        update: { value: string };
      }) => {
        const row = {
          key: where.key,
          value: store.get(where.key)?.value ?? create.value,
          updatedAt: new Date('2026-08-24T12:00:00.000Z'),
        };
        row.value = update.value;
        store.set(where.key, row);
        return Promise.resolve(row);
      },
      deleteMany: ({ where }: { where: { key: string } }) => {
        const deleted = store.delete(where.key) ? 1 : 0;
        return Promise.resolve({ count: deleted });
      },
    },
  } as unknown as PrismaService;
}

describe('organisation des statistiques', () => {
  it('retombe sur l’ordre par défaut puis conserve l’ordre enregistré côté serveur', async () => {
    const service = new StatsLayoutService(prismaStub());

    const initial = await service.get('usr-1', StatsLayoutScreen.TELECONSEIL);
    expect(initial.widgets.map((widget) => widget.id)).toEqual([
      'prospects-over-time',
      'top-teleconseillers',
      'conversion-teleconseillers',
      'phase2-status',
      'enrollment-methods',
      'segments',
    ]);

    const saved = await service.put('usr-1', StatsLayoutScreen.TELECONSEIL, {
      widgets: [
        { id: 'segments', visible: true },
        { id: 'top-teleconseillers', visible: false },
      ],
    });

    expect(saved.widgets).toEqual([
      { id: 'segments', visible: true },
      { id: 'top-teleconseillers', visible: false },
      { id: 'prospects-over-time', visible: true },
      { id: 'conversion-teleconseillers', visible: true },
      { id: 'phase2-status', visible: true },
      { id: 'enrollment-methods', visible: true },
    ]);
  });
});
