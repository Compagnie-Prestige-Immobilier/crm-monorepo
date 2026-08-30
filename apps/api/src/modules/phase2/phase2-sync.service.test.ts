import {
  CallOutcome,
  EnrollmentMethod,
  Phase2Status,
  ScheduledCallbackStatus,
} from '@crm/database';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_OUTCOME_REASONS } from '../referentiels/call-outcome-rules.js';
import { Phase2SyncService, type Phase2TransactionClient } from './phase2-sync.service.js';
import type { CallAttemptOpDto } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockTx {
  callAttempt: Record<'findUnique' | 'createMany', MockFn>;
  callOutcomeReason: Record<'findUnique', MockFn>;
  prospect: Record<'findFirst' | 'updateMany' | 'update', MockFn>;
  prospectJourney: Record<'upsert' | 'updateMany', MockFn>;
  scheduledCallback: Record<'updateMany' | 'createMany', MockFn>;
}

/** Le référentiel tel qu'il sort du semis : les six motifs système, actifs. */
const seededReason = (code: string): Record<string, unknown> | null => {
  const system = SYSTEM_OUTCOME_REASONS.find((reason) => reason.code === code);
  if (!system) return null;
  return {
    id: `reason-${system.code}`,
    code: system.code,
    label: system.label,
    effect: system.effect,
    requiresComment: system.requiresComment,
    requiresCallback: system.requiresCallback,
    isActive: true,
  };
};

const prospectRow = (): Record<string, unknown> => ({
  id: 'p-1',
  projet: 'CHUES',
  rev: 3,
  updatedAt: new Date('2026-08-01T09:00:00.000Z'),
});

/** L'état de phase 2 vit sur le parcours, plus sur la fiche. */
const journeyRow = (): Record<string, unknown> => ({
  id: 'j-1',
  phase2Status: Phase2Status.PENDING,
  enrollmentMethod: null,
  enrollmentCapturedById: null,
  enrollmentCapturedAt: null,
});

let tx: MockTx;

const prepare = (): void => {
  tx = {
    callAttempt: {
      findUnique: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    callOutcomeReason: {
      findUnique: vi.fn((args: { where: { code: string } }) =>
        Promise.resolve(seededReason(args.where.code)),
      ),
    },
    prospect: {
      findFirst: vi.fn().mockResolvedValue(prospectRow()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ ...prospectRow(), rev: 4 }),
    },
    prospectJourney: {
      upsert: vi.fn().mockResolvedValue(journeyRow()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    scheduledCallback: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
};

const op = {
  id: 'att-1',
  prospectId: 'p-1',
  outcome: CallOutcome.UNREACHABLE,
  clientCreatedAt: '2026-08-01T10:00:00.000Z',
};

const apply = (override: Partial<CallAttemptOpDto> = {}): Promise<unknown> =>
  new Phase2SyncService().applyCallAttempt(tx as unknown as Phase2TransactionClient, 'com-1', {
    ...op,
    ...override,
  });

const writtenRow = (): Record<string, unknown> =>
  (tx.callAttempt.createMany.mock.calls[0]?.[0] as { data: Record<string, unknown>[] }).data[0] ??
  {};

describe('nature de la tentative écrite', () => {
  beforeEach(() => {
    prepare();
  });

  it('prospect réel : la tentative est réelle', async () => {
    await apply();
  });
});

const RENDEZ_VOUS = '2026-08-05T09:00:00.000Z';

const priseDeRendezVous = {
  outcome: CallOutcome.METHOD_OBTAINED,
  method: EnrollmentMethod.APPOINTMENT,
  rendezVousAt: RENDEZ_VOUS,
} as const;

describe('renseignements de conversion', () => {
  beforeEach(() => {
    prepare();
  });

  it('écrit sur la TENTATIVE ce que l’appel apprend', async () => {
    await apply({
      ...priseDeRendezVous,
      email: 'awa@cpi.sn',
      fonctionnaire: true,
      engagementEnCours: false,
      dureeEtablissementMois: 84,
      comment: 'rendez-vous à l’agence',
    });

    const row = writtenRow();
    expect(row.email).toBe('awa@cpi.sn');
    expect(row.fonctionnaire).toBe(true);
    expect(row.engagementEnCours).toBe(false);
    expect(row.dureeEtablissementMois).toBe(84);
    expect(row.comment).toBe('rendez-vous à l’agence');
    expect((row.rendezVousAt as Date).toISOString()).toBe(RENDEZ_VOUS);
    expect(tx.prospect.update).not.toHaveBeenCalled();
  });

  it('écrit sur le PROSPECT ce que la fiche porte déjà, et rien d’autre', async () => {
    await apply({
      ...priseDeRendezVous,
      nom: '  Diop ',
      prenom: 'Awa',
      profession: 'Enseignante',
      banqueId: 'b-1',
      syndicatId: 's-1',
    });

    const [args] = tx.prospect.update.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ id: 'p-1' });
    expect(args.data).toEqual({
      nom: 'Diop',
      prenom: 'Awa',
      profession: 'Enseignante',
      banqueId: 'b-1',
      syndicatId: 's-1',
      rev: { increment: 1 },
    });

    const row = writtenRow();
    expect(row.nom).toBeUndefined();
    expect(row.banqueId).toBeUndefined();
  });

  it('un champ absent laisse la valeur en place : le silence n’efface rien', async () => {
    await apply({ ...priseDeRendezVous, prenom: 'Awa' });

    const [args] = tx.prospect.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({ prenom: 'Awa', rev: { increment: 1 } });
  });

  it('un nom vidé n’écrase pas celui de la fiche', async () => {
    await apply({ ...priseDeRendezVous, nom: '   ' });

    expect(tx.prospect.update).not.toHaveBeenCalled();
  });

  it('la révision rendue est celle d’APRÈS la correction', async () => {
    tx.prospect.update.mockResolvedValue({ ...prospectRow(), rev: 4 });
    tx.prospect.findFirst.mockResolvedValue({ ...prospectRow(), rev: 5 });

    const result = (await apply({ outcome: CallOutcome.UNREACHABLE, nom: 'Diop' })) as {
      state: { rev: number };
    };

    expect(result.state.rev).toBe(4);
  });

  it('le rejeu d’une tentative déjà reçue ne recorrige pas la fiche', async () => {
    tx.callAttempt.findUnique.mockResolvedValue({ id: 'att-1' });
    await apply({ ...priseDeRendezVous, nom: 'Diop' });

    expect(tx.prospect.update).not.toHaveBeenCalled();
  });

  it('une tentative perdue à l’insertion ne corrige rien', async () => {
    tx.callAttempt.createMany.mockResolvedValue({ count: 0 });
    await apply({ ...priseDeRendezVous, nom: 'Diop' });

    expect(tx.prospect.update).not.toHaveBeenCalled();
  });

  it('la prise de rendez-vous sans date est refusée avant toute écriture', async () => {
    expect(
      await codeOf(
        apply({ outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.APPOINTMENT }),
      ),
    ).toBe('PHASE2_RENDEZ_VOUS_REQUIRED');
    expect(tx.callAttempt.createMany).not.toHaveBeenCalled();
    expect(tx.prospect.update).not.toHaveBeenCalled();
  });

  it('une date de rendez-vous antérieure à l’appel est refusée', async () => {
    expect(
      await codeOf(apply({ ...priseDeRendezVous, rendezVousAt: '2026-07-01T09:00:00.000Z' })),
    ).toBe('PHASE2_RENDEZ_VOUS_PAST');
  });

  it('une adresse électronique qui n’en est pas une est refusée', async () => {
    expect(await codeOf(apply({ ...priseDeRendezVous, email: 'awa' }))).toBe(
      'PHASE2_EMAIL_INVALID',
    );
  });
});

const RAPPEL = '2026-08-02T09:00:00.000Z';

const callbackWritten = (): Record<string, unknown> =>
  (tx.scheduledCallback.createMany.mock.calls[0]?.[0] as { data: Record<string, unknown>[] })
    .data[0] ?? {};

describe('rappel planifié', () => {
  beforeEach(() => {
    prepare();
  });

  it('CALLBACK avec date : le rappel est créé sur la tentative qui l’a promis', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    const row = callbackWritten();
    expect(row.prospectId).toBe('p-1');
    expect(row.sourceAttemptId).toBe('att-1');
    expect(row.assignedToId).toBe('com-1');
    expect((row.scheduledAt as Date).toISOString()).toBe(RAPPEL);
  });

  it('un rappel existe sans tâche', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(callbackWritten()).toMatchObject({ prospectId: 'p-1', assignedToId: 'com-1' });
  });

  it('dépose le rappel précédent en SUPERSEDED avant d’insérer', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    const [args] = tx.scheduledCallback.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ prospectId: 'p-1', status: ScheduledCallbackStatus.PENDING });
    expect(args.data).toEqual({ status: ScheduledCallbackStatus.SUPERSEDED });
    expect(tx.scheduledCallback.updateMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      tx.scheduledCallback.createMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('CALLBACK sans date ne planifie rien, et n’efface pas le rappel en cours', async () => {
    await apply({ outcome: CallOutcome.CALLBACK });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('le rejeu de la MÊME tentative ne recrée pas de rappel', async () => {
    tx.callAttempt.findUnique.mockResolvedValue({ id: 'att-1' });
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('une tentative perdue à l’insertion ne déclenche aucun rappel', async () => {
    tx.callAttempt.createMany.mockResolvedValue({ count: 0 });
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
  });

  it('une issue terminale clôt le rappel en cours et dit lequel l’a clos', async () => {
    await apply({ outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.PLATFORM });

    const [args] = tx.scheduledCallback.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ prospectId: 'p-1', status: ScheduledCallbackStatus.PENDING });
    expect(args.data).toEqual({
      status: ScheduledCallbackStatus.DONE,
      closedAttemptId: 'att-1',
    });
  });

  it('une issue NON terminale laisse le rappel en attente', async () => {
    await apply();

    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });
});

const codeOf = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as { code?: string };
    return body.code ?? '';
  }
  throw new Error('aucune exception levée');
};

describe('résolution du motif d’issue', () => {
  beforeEach(() => {
    prepare();
  });

  it('un lot sans reasonCode résout le motif système dont le code égale outcome', async () => {
    await apply({ outcome: CallOutcome.REFUSED });

    expect(tx.callOutcomeReason.findUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { code: CallOutcome.REFUSED },
    });
    expect(writtenRow().reasonId).toBe('reason-REFUSED');
  });

  it('un référentiel vide ne met PAS en échec un lot sans reasonCode', async () => {
    tx.callOutcomeReason.findUnique.mockResolvedValue(null);
    await apply();

    expect(writtenRow().reasonId).toBeNull();
    expect(writtenRow().outcome).toBe(CallOutcome.UNREACHABLE);
  });

  it.each(SYSTEM_OUTCOME_REASONS)(
    '$code explicite écrit la MÊME ligne que l’issue seule',
    async (system) => {
      const saisie = {
        outcome: system.code,
        ...(system.effect === 'CLOSE_METHOD' ? { method: EnrollmentMethod.PLATFORM } : {}),
        ...(system.requiresComment ? { comment: 'motif' } : {}),
      };

      prepare();
      await apply(saisie);
      const implicite = writtenRow();

      prepare();
      await apply({ ...saisie, reasonCode: system.code });
      expect(writtenRow()).toEqual(implicite);
    },
  );

  it('un code inconnu refuse la tentative, sans toucher au prospect', async () => {
    expect(await codeOf(apply({ reasonCode: 'BOITE_VOCALE' }))).toBe('PHASE2_REASON_UNKNOWN');
    expect(tx.callAttempt.createMany).not.toHaveBeenCalled();
    expect(tx.prospect.updateMany).not.toHaveBeenCalled();
  });

  it('un motif retiré du référentiel est refusé', async () => {
    tx.callOutcomeReason.findUnique.mockResolvedValue({
      ...seededReason(CallOutcome.UNREACHABLE),
      code: 'BOITE_VOCALE',
      label: 'Boîte vocale',
      isActive: false,
    });

    expect(await codeOf(apply({ reasonCode: 'BOITE_VOCALE' }))).toBe('PHASE2_REASON_INACTIVE');
  });

  it('un motif dont l’effet contredit l’issue est refusé', async () => {
    tx.callOutcomeReason.findUnique.mockResolvedValue({
      ...seededReason(CallOutcome.REFUSED),
      code: 'REFUS_SEC',
      label: 'Refus sec',
    });

    expect(await codeOf(apply({ outcome: CallOutcome.UNREACHABLE, reasonCode: 'REFUS_SEC' }))).toBe(
      'PHASE2_REASON_OUTCOME_MISMATCH',
    );
  });

  it('un motif qui exige un commentaire le fait respecter jusqu’à l’écriture', async () => {
    tx.callOutcomeReason.findUnique.mockResolvedValue({
      ...seededReason(CallOutcome.UNREACHABLE),
      id: 'reason-BOITE_VOCALE',
      code: 'BOITE_VOCALE',
      label: 'Boîte vocale',
      requiresComment: true,
    });

    expect(await codeOf(apply({ reasonCode: 'BOITE_VOCALE' }))).toBe('PHASE2_COMMENT_REQUIRED');

    prepare();
    tx.callOutcomeReason.findUnique.mockResolvedValue({
      ...seededReason(CallOutcome.UNREACHABLE),
      id: 'reason-BOITE_VOCALE',
      code: 'BOITE_VOCALE',
      label: 'Boîte vocale',
      requiresComment: true,
    });
    await apply({ reasonCode: 'BOITE_VOCALE', comment: 'boîte saturée' });
    expect(writtenRow().reasonId).toBe('reason-BOITE_VOCALE');
  });

  it('un motif ajouté clôt le dossier quand son effet le dit', async () => {
    tx.callOutcomeReason.findUnique.mockResolvedValue({
      ...seededReason(CallOutcome.REFUSED),
      id: 'reason-REFUS_SEC',
      code: 'REFUS_SEC',
      label: 'Refus sec',
    });

    await apply({ outcome: CallOutcome.REFUSED, reasonCode: 'REFUS_SEC' });

    const [args] = tx.prospect.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data.phase2Status).toBe(Phase2Status.REFUSED);
    expect(writtenRow().reasonId).toBe('reason-REFUS_SEC');
  });
});

describe('la phase 2 est un état du PARCOURS, pas de la fiche', () => {
  it('c’est le PARCOURS qui arbitre « la première transition terminale gagne »', async () => {
    prepare();
    tx.prospectJourney.updateMany.mockResolvedValue({ count: 0 });

    await expect(apply({ outcome: CallOutcome.REFUSED })).rejects.toMatchObject({
      response: { code: 'PHASE2_ALREADY_COMPLETED' },
    });
  });

  it('un parcours déjà soldé refuse la tentative', async () => {
    prepare();
    tx.prospectJourney.upsert.mockResolvedValue({
      id: 'j-1',
      phase2Status: Phase2Status.REFUSED,
      enrollmentMethod: null,
      enrollmentCapturedById: null,
      enrollmentCapturedAt: null,
    });

    await expect(apply()).rejects.toMatchObject({ response: { code: 'PHASE2_ALREADY_COMPLETED' } });
  });
});
