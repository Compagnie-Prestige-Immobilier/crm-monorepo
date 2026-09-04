import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  RepCallOutcome,
  RepresentantRelation,
  Role,
  StatutQualificationEffect,
} from '@crm/database';
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
  representant: { findFirst: MockFn; update: MockFn; updateMany: MockFn };
  representantRelationChange: { create: MockFn };
  deviceCallDetection: { updateMany: MockFn };
}

let tx: Tx;
let db: {
  repCallAttempt: { findUnique: MockFn };
  representant: { findFirst: MockFn };
  statutQualification: { findUnique: MockFn };
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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    representantRelationChange: { create: vi.fn() },
    deviceCallDetection: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
        lastCallAt: null,
      }),
    },
    statutQualification: { findUnique: vi.fn().mockResolvedValue(null) },
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

describe('preuve d’appel lue dans le journal Android', () => {
  const trace = (): Record<string, unknown> =>
    (tx.repCallAttempt.createMany.mock.calls[0] as [{ data: Record<string, unknown>[] }])[0]
      .data[0] ?? {};

  it('la tentative garde le type, la durée et l’heure du journal', async () => {
    const body = baseBody();
    body.deviceCallType = 'sortant';
    body.deviceCallDurationSeconds = 92;
    body.deviceCallAt = '2026-08-10T10:00:14.000Z';

    await service.recordAttempt(ALICE, body);

    expect(trace()).toMatchObject({
      deviceCallType: 'sortant',
      deviceCallDurationSeconds: 92,
      deviceCallAt: new Date('2026-08-10T10:00:14.000Z'),
    });
  });

  it('sans preuve, la tentative reste déclarative', async () => {
    await service.recordAttempt(ALICE, baseBody());

    expect(trace()).toMatchObject({
      deviceCallType: null,
      deviceCallDurationSeconds: null,
      deviceCallAt: null,
    });
  });

  // Le téléphone remonte souvent l'appel avant que la fiche soit consignée :
  // sans ce rattrapage, la supervision compterait l'appel comme non consigné.
  it('la tentative réclame les appels déjà détectés sur la même fiche', async () => {
    const body = baseBody();
    body.deviceCallAt = '2026-08-10T09:59:00.000Z';

    await service.recordAttempt(ALICE, body);

    const [args] = tx.deviceCallDetection.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toMatchObject({
      performedById: ALICE.id,
      representantId: REP,
      attemptId: null,
    });
    expect(args.data).toEqual({ attemptId: body.id });
    expect(args.where.OR).toEqual([
      {
        deviceCallAt: {
          gte: new Date('2026-08-10T08:00:00.000Z'),
          lte: new Date('2026-08-10T10:00:00.000Z'),
        },
      },
      {
        deviceCallAt: {
          gte: new Date('2026-08-10T09:57:00.000Z'),
          lte: new Date('2026-08-10T10:01:00.000Z'),
        },
      },
    ]);
  });
});

describe('dernier appel porté par la fiche', () => {
  const patch = (): Record<string, unknown> =>
    (tx.representant.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

  it('un représentant joint peut demander un rappel : la fiche le porte', async () => {
    const body = baseBody();
    body.callbackAt = '2026-08-12T09:00:00.000Z';

    await service.recordAttempt(ALICE, body);

    expect(patch()).toMatchObject({
      lastCallOutcome: RepCallOutcome.REACHED,
      lastCallAt: new Date('2026-08-10T10:00:00.000Z'),
      lastCallById: ALICE.id,
      nextCallbackAt: new Date('2026-08-12T09:00:00.000Z'),
    });
  });

  it('un appel de plus honore le rappel promis', async () => {
    const body = baseBody();
    body.outcome = RepCallOutcome.UNREACHABLE;

    await service.recordAttempt(ALICE, body);

    expect(patch()).toMatchObject({
      lastCallOutcome: RepCallOutcome.UNREACHABLE,
      nextCallbackAt: null,
    });
  });

  it('une tentative arrivée hors ligne, plus ancienne que le dernier appel, ne réécrit pas la fiche', async () => {
    db.representant.findFirst.mockResolvedValue({
      id: REP,
      relationStatus: 'INCONNU',
      whatsappStatus: 'NON_DEMANDE',
      whatsappE164: null,
      phoneE164: '+221771234567',
      lastCallAt: new Date('2026-08-11T10:00:00.000Z'),
    });

    await service.recordAttempt(ALICE, baseBody());

    expect(tx.representant.update).not.toHaveBeenCalled();
  });

  it('l’issue « À rappeler » exige toujours sa date', async () => {
    const body = baseBody();
    body.outcome = RepCallOutcome.CALLBACK;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REP_CAMPAIGN_CALLBACK_AT_REQUIRED' },
    });
  });
});

describe('périmètre par campagne', () => {
  it('un COMMERCIAL borne sa lecture à ses fiches et à ses attributions', async () => {
    await service.recordAttempt(ALICE, baseBody());

    const where = (
      db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({
      OR: [{ createdById: ALICE.id }, { lotItems: { some: { assigneeId: ALICE.id } } }],
    });
  });

  it('un représentant HORS campagne est refusé, sans être nié', async () => {
    // Hors périmètre pour la lecture bornée, présent pour la seconde.
    db.representant.findFirst.mockImplementation((args: { where: { OR?: unknown } }) =>
      Promise.resolve(args.where.OR ? null : { id: REP }),
    );

    await expect(service.recordAttempt(ALICE, baseBody())).rejects.toMatchObject({
      response: { code: 'REP_CAMPAIGN_NOT_ASSIGNED' },
    });
    await expect(service.recordAttempt(ALICE, baseBody())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('un représentant qui n’existe pas reste un 404', async () => {
    db.representant.findFirst.mockResolvedValue(null);

    await expect(service.recordAttempt(ALICE, baseBody())).rejects.toMatchObject({
      response: { code: 'REPRESENTANT_NOT_FOUND' },
    });
  });

  it('l’encadrement n’est borné par rien', async () => {
    const SUP: AuthenticatedUser = { ...ALICE, id: 'sup-1', role: Role.SUPERVISEUR };

    await service.recordAttempt(SUP, baseBody());

    const where = (
      db.representant.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).not.toHaveProperty('OR');
  });
});

describe('le statut de qualification commande l’issue', () => {
  const STATUT = '0198c000-0000-7000-8000-000000000001';

  const statut = (over: Record<string, unknown> = {}) => ({
    id: STATUT,
    code: 'INTERESSE',
    label: 'Intéressé',
    effect: StatutQualificationEffect.REACHED,
    requiresCallback: false,
    isActive: true,
    ...over,
  });

  it('accepte une tentative SANS statut : les versions déjà installées n’en émettent pas', async () => {
    const resultat = await service.recordAttempt(ALICE, baseBody());

    expect(resultat.status).toBe(RepCallAttemptApplyStatus.APPLIED);
    expect(db.statutQualification.findUnique).not.toHaveBeenCalled();
  });

  it('enregistre le statut sur la tentative ET sur la fiche', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut());
    const body = baseBody();
    body.statutQualificationId = STATUT;

    await service.recordAttempt(ALICE, body);

    expect(tx.repCallAttempt.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ statutQualificationId: STATUT })],
      }),
    );
    expect(tx.representant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statutQualificationId: STATUT }),
      }),
    );
  });

  it('refuse une issue qui contredit le statut, au lieu d’enregistrer la contradiction', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut());
    const body = baseBody();
    body.statutQualificationId = STATUT;
    body.outcome = RepCallOutcome.UNREACHABLE;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REP_OUTCOME_STATUT_MISMATCH' },
    });
    expect(tx.repCallAttempt.createMany).not.toHaveBeenCalled();
  });

  it('refuse un statut inconnu', async () => {
    db.statutQualification.findUnique.mockResolvedValue(null);
    const body = baseBody();
    body.statutQualificationId = STATUT;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REP_STATUT_QUALIFICATION_UNKNOWN' },
    });
  });

  it('refuse un statut retiré depuis la dernière synchronisation', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut({ isActive: false }));
    const body = baseBody();
    body.statutQualificationId = STATUT;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REP_STATUT_QUALIFICATION_INACTIVE' },
    });
  });

  it('exige la date quand le statut arme un rappel, par la règle qui existait déjà', async () => {
    db.statutQualification.findUnique.mockResolvedValue(
      statut({
        code: 'A_RAPPELER',
        label: 'À rappeler',
        effect: StatutQualificationEffect.SCHEDULE_CALLBACK,
        requiresCallback: true,
      }),
    );
    const body = baseBody();
    body.statutQualificationId = STATUT;
    body.outcome = RepCallOutcome.CALLBACK;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REP_CAMPAIGN_CALLBACK_AT_REQUIRED' },
    });

    body.callbackAt = '2026-09-10T09:00:00.000Z';
    expect((await service.recordAttempt(ALICE, body)).status).toBe(
      RepCallAttemptApplyStatus.APPLIED,
    );
  });
});

describe('la relation que le statut pose sur la fiche', () => {
  const STATUT = '0198c000-0000-7000-8000-000000000002';

  const statut = (relationStatus: RepresentantRelation | null) => ({
    id: STATUT,
    code: 'NON_INTERESSE',
    label: 'Non intéressé',
    effect: StatutQualificationEffect.REFUSED,
    requiresCallback: false,
    relationStatus,
    isActive: true,
  });

  const bascule = (): Record<string, unknown> | undefined =>
    (
      tx.representant.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }] | undefined
    )?.[0].data;

  const refus = (): CreateRepCallAttemptDto => {
    const body = baseBody();
    body.outcome = RepCallOutcome.REFUSED;
    body.statutQualificationId = STATUT;
    return body;
  };

  it('bascule la relation quand le client n’en envoie pas', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut(RepresentantRelation.REFUS));

    await service.recordAttempt(ALICE, refus());

    expect(bascule()).toMatchObject({ relationStatus: RepresentantRelation.REFUS });
  });

  it('laisse le dernier mot au client qui répond à la question', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut(RepresentantRelation.REFUS));
    const body = refus();
    body.relationStatus = RepresentantRelation.AMBASSADEUR;

    await service.recordAttempt(ALICE, body);

    expect(bascule()).toMatchObject({ relationStatus: RepresentantRelation.AMBASSADEUR });
  });

  it('ne pose rien quand le statut ne tranche pas', async () => {
    db.statutQualification.findUnique.mockResolvedValue(statut(null));

    await service.recordAttempt(ALICE, refus());

    expect(tx.representant.updateMany).not.toHaveBeenCalled();
  });

  // Une transition refusee ne doit PAS faire echouer l'enregistrement : la
  // tentative vient du terrain, souvent hors ligne, et l'erreur serait
  // definitive. La relation posee est simplement laissee de cote.
  it('enregistre la tentative même quand la relation posée serait un retour en arrière', async () => {
    db.representant.findFirst.mockResolvedValue({
      id: REP,
      relationStatus: RepresentantRelation.AMBASSADEUR,
      whatsappStatus: 'NON_DEMANDE',
      whatsappE164: null,
      phoneE164: '+221771234567',
      lastCallAt: null,
    });
    db.statutQualification.findUnique.mockResolvedValue(statut(RepresentantRelation.CONTACTE));

    const resultat = await service.recordAttempt(ALICE, refus());

    expect(resultat.status).toBe(RepCallAttemptApplyStatus.APPLIED);
    expect(tx.representant.updateMany).not.toHaveBeenCalled();
  });

  it('refuse en revanche la relation ILLÉGALE que le client affirme', async () => {
    db.representant.findFirst.mockResolvedValue({
      id: REP,
      relationStatus: RepresentantRelation.AMBASSADEUR,
      whatsappStatus: 'NON_DEMANDE',
      whatsappE164: null,
      phoneE164: '+221771234567',
      lastCallAt: null,
    });
    db.statutQualification.findUnique.mockResolvedValue(statut(RepresentantRelation.REFUS));
    const body = refus();
    body.relationStatus = RepresentantRelation.CONTACTE;

    await expect(service.recordAttempt(ALICE, body)).rejects.toMatchObject({
      response: { code: 'REPRESENTANT_RELATION_TRANSITION_REFUSED' },
    });
  });
});
