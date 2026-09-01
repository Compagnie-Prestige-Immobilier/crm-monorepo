import { ConflictException } from '@nestjs/common';
import { RepCallOutcome, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RepresentantsService } from '../representants/representants.service.js';
import { RepCampaignsService } from './rep-campaigns.service.js';
import { RepCallAttemptApplyStatus, type CreateRepCallAttemptDto } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

const ALICE: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};

const REP = '0198a000-0000-7000-8000-000000000001';

interface Tx {
  repCallAttempt: { createMany: MockFn };
  representantSuggestion: { create: MockFn };
  representant: { findFirst: MockFn; update: MockFn };
}

let tx: Tx;
let db: {
  repCallAttempt: { findUnique: MockFn };
  representant: { findFirst: MockFn };
  $transaction: MockFn;
};
let service: RepCampaignsService;

const baseBody = (): CreateRepCallAttemptDto =>
  ({
    id: '0198b000-0000-7000-8000-000000000001',
    representantId: REP,
    outcome: RepCallOutcome.REACHED,
    clientCreatedAt: '2026-08-10T10:00:00.000Z',
  }) as CreateRepCallAttemptDto;

beforeEach(() => {
  tx = {
    repCallAttempt: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    representantSuggestion: { create: vi.fn() },
    representant: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: REP }),
    },
  };
  db = {
    repCallAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
    representant: {
      findFirst: vi.fn().mockResolvedValue({
        id: REP,
        relationStatus: 'INCONNU',
        whatsappStatus: 'NON_DEMANDE',
        whatsappE164: null,
        phoneE164: '+221771234567',
      }),
    },
    $transaction: vi.fn((fn: (client: Tx) => unknown) => fn(tx)),
  };
  service = new RepCampaignsService(
    db as unknown as PrismaService,
    {} as unknown as RepresentantsService,
  );
});

describe('correction du numéro pendant la qualification', () => {
  it('un numéro corrigé vers un numéro DÉJÀ pris est refusé proprement', async () => {
    tx.representant.findFirst.mockResolvedValue({ createdBy: { fullName: 'Bob Sarr' } });

    const body = baseBody();
    body.numeroConfirme = false;
    body.phone = '77 000 00 00';

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REPRESENTANT_PHONE_CONFLICT' },
    });
    await expect(service.recordAttempt(ALICE, body)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.representant.update).not.toHaveBeenCalled();
  });

  it('un numéro corrigé vers un numéro LIBRE remplace le téléphone et trace le script', async () => {
    const body = baseBody();
    body.numeroConfirme = false;
    body.phone = '77 000 00 00';
    body.etablissementConfirme = false;
    body.etablissement = 'Lycée de Pikine';
    body.contacte = true;
    body.connaitUES = false;
    body.syndicat = 'SUDES';

    const result = await service.recordAttempt(ALICE, body);
    expect(result.status).toBe(RepCallAttemptApplyStatus.APPLIED);

    const trace = (
      tx.repCallAttempt.createMany.mock.calls[0] as [{ data: Record<string, unknown>[] }]
    )[0].data[0];
    expect(trace).toMatchObject({
      numeroConfirme: false,
      etablissementConfirme: false,
      contacte: true,
      connaitUES: false,
      syndicat: 'SUDES',
    });

    const patch = (tx.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(patch.phoneE164).toBe('+221770000000');
    expect(patch.etablissement).toBe('Lycée de Pikine');
    expect(patch.syndicat).toBe('SUDES');
    expect(patch.contacte).toBe(true);
    expect(patch.connaitUES).toBe(false);
    expect(patch.rev).toEqual({ increment: 1 });
  });

  it('un numéro confirmé ne touche NI l’unicité NI le téléphone', async () => {
    const body = baseBody();
    body.numeroConfirme = true;
    body.contacte = true;

    await service.recordAttempt(ALICE, body);

    expect(tx.representant.findFirst).not.toHaveBeenCalled();
    const patch = (tx.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(patch.phoneE164).toBeUndefined();
    expect(patch.contacte).toBe(true);
  });

  it('un rejeu de la même tentative ressort en DUPLICATE sans réécrire la fiche', async () => {
    db.repCallAttempt.findUnique.mockResolvedValue({ id: baseBody().id });

    const body = baseBody();
    body.numeroConfirme = false;
    body.phone = '77 000 00 00';

    const result = await service.recordAttempt(ALICE, body);
    expect(result.status).toBe(RepCallAttemptApplyStatus.DUPLICATE);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
