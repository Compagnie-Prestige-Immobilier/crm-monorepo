import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { WorkspaceContext } from '../../workspaces/workspace.js';
import type { ChampsConversionService } from '../champs-conversion/champs-conversion.service.js';
import { LotsExportService } from './lots-export.service.js';

const ALICE: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};

let findMany: ReturnType<typeof vi.fn>;
let service: LotsExportService;

beforeEach(() => {
  findMany = vi.fn((args: { select: Record<string, unknown> }) =>
    Promise.resolve(
      'representantId' in args.select
        ? [{ representantId: 'rep-1' }, { representantId: 'rep-2' }]
        : [{ prospectId: 'p-1' }],
    ),
  );
  service = new LotsExportService(
    { lotExportItem: { findMany } } as unknown as PrismaService,
    {} as unknown as WorkspaceContext,
    {} as unknown as ChampsConversionService,
  );
});

describe('mes-attributions', () => {
  it('rend les fiches confiées au téléconseiller, fiches supprimées exclues', async () => {
    await expect(service.mesAttributions(ALICE)).resolves.toEqual({
      representantIds: ['rep-1', 'rep-2'],
      prospectIds: ['p-1'],
      tout: false,
    });

    const wheres = (findMany.mock.calls as [{ where: Record<string, unknown> }][]).map(
      (call) => call[0].where,
    );
    expect(wheres).toEqual([
      { assigneeId: ALICE.id, representant: { deletedAt: null } },
      { assigneeId: ALICE.id, prospect: { deletedAt: null } },
    ]);
  });

  it('l’admin reçoit `tout` et deux listes vides : le mobile ne filtre pas', async () => {
    await expect(service.mesAttributions({ ...ALICE, role: Role.ADMIN })).resolves.toEqual({
      representantIds: [],
      prospectIds: [],
      tout: true,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('supervision et direction sont bornées à leurs campagnes comme un téléconseiller', async () => {
    for (const role of [Role.SUPERVISEUR, Role.DIRECTION]) {
      await expect(service.mesAttributions({ ...ALICE, role })).resolves.toEqual({
        representantIds: ['rep-1', 'rep-2'],
        prospectIds: ['p-1'],
        tout: false,
      });
    }
  });
});
