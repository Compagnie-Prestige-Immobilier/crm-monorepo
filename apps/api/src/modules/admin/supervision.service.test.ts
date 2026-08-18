import { Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { SupervisionService } from './supervision.service.js';

const prismaWith = (
  findMany: ReturnType<typeof vi.fn>,
): { service: SupervisionService; findMany: typeof findMany } => {
  const groupBy = vi.fn().mockResolvedValue([]);
  const prisma = {
    user: { findMany },
    refreshToken: { groupBy },
    syncBatch: { groupBy },
    callAttempt: { groupBy },
    bankCaseTransition: { groupBy },
  };
  return {
    service: new SupervisionService(prisma as unknown as PrismaService, fakeDemoVisibility()),
    findMany,
  };
};

describe('qui figure dans l’écran des comptes supervisés', () => {
  it('les EXÉCUTANTS, et eux seuls', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = prismaWith(findMany);

    await service.overview();

    const where = (findMany.mock.calls[0]?.[0] as { where: { role: { in: Role[] } } }).where;
    expect(where.role.in).toEqual([Role.COMMERCIAL, Role.BANQUE_FINANCE]);
  });

  /**
   * La présence se déduit des lots de synchronisation et des tentatives
   * d'appel. Un superviseur n'en produit aucun : sa ligne serait dormante en
   * permanence, et il fausserait les trois compteurs de présence.
   */
  it('PAS le superviseur, qui n’exécute rien et n’a donc aucun signal', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = prismaWith(findMany);

    await service.overview();

    const where = (findMany.mock.calls[0]?.[0] as { where: { role: { in: Role[] } } }).where;
    expect(where.role.in).not.toContain(Role.SUPERVISEUR);
    expect(where.role.in).not.toContain(Role.ADMIN);
  });
});
