import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { BankStageType } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { BankCaseError } from './errors.js';
import {
  activeOpenStages,
  assertReachable,
  lastOpenStage,
  nextOpenStage,
  planTransitionEffect,
} from './workflow.js';
import type { WorkflowStage } from './workflow.js';

const stage = (over: Partial<WorkflowStage> & { id: string }): WorkflowStage => ({
  code: over.id.toUpperCase(),
  label: over.id,
  position: 1,
  type: BankStageType.OPEN,
  isActive: true,
  isInitial: false,
  isSystem: false,
  ...over,
});

const aTraiter = stage({ id: 'a-traiter', position: 1, isInitial: true, isSystem: true });
const enTraitement = stage({ id: 'en-traitement', position: 2 });
const encaisse = stage({
  id: 'encaisse',
  position: 100,
  type: BankStageType.CASHED,
  isSystem: true,
});
const rejete = stage({ id: 'rejete', position: 101, type: BankStageType.REJECTED, isSystem: true });
const STAGES = [aTraiter, enTraitement, encaisse, rejete];

const codeOf = (error: unknown): unknown =>
  (((error as { response?: unknown }).response ?? {}) as { code?: unknown }).code;

function refusalCode(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return codeOf(error);
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

describe('atteignabilité', () => {
  it('l’étape ouverte suivante est celle de position immédiatement supérieure', () => {
    expect(nextOpenStage(STAGES, aTraiter)?.id).toBe('en-traitement');
    expect(nextOpenStage(STAGES, enTraitement)).toBeUndefined();
    expect(lastOpenStage(STAGES)?.id).toBe('en-traitement');
  });

  it('une étape désactivée est SAUTÉE, pas bloquante', () => {
    const gele = stage({ id: 'gele', position: 2, isActive: false });
    const suite = stage({ id: 'suite', position: 3 });
    const stages = [aTraiter, gele, suite, encaisse, rejete];

    expect(activeOpenStages(stages).map((item) => item.id)).toEqual(['a-traiter', 'suite']);
    expect(nextOpenStage(stages, aTraiter)?.id).toBe('suite');
  });

  it('on ne saute pas une étape ouverte', () => {
    const troisieme = stage({ id: 'troisieme', position: 3 });
    const stages = [aTraiter, enTraitement, troisieme, encaisse, rejete];

    expect(
      refusalCode(() => {
        assertReachable(stages, aTraiter, troisieme);
      }),
    ).toBe(BankCaseError.STAGE_NOT_NEXT);
  });

  it('le rejet est atteignable depuis N’IMPORTE QUELLE étape ouverte', () => {
    expect(() => {
      assertReachable(STAGES, aTraiter, rejete);
    }).not.toThrow();
    expect(() => {
      assertReachable(STAGES, enTraitement, rejete);
    }).not.toThrow();
  });

  it('l’encaissement ne se déclare qu’à la DERNIÈRE étape ouverte', () => {
    expect(
      refusalCode(() => {
        assertReachable(STAGES, aTraiter, encaisse);
      }),
    ).toBe(BankCaseError.CASHED_NOT_LAST);
    expect(() => {
      assertReachable(STAGES, enTraitement, encaisse);
    }).not.toThrow();
  });

  it('une étape désactivée n’accueille aucun dossier', () => {
    const gele = stage({ id: 'gele', position: 2, isActive: false });
    expect(
      refusalCode(() => {
        assertReachable([aTraiter, gele], aTraiter, gele);
      }),
    ).toBe(BankCaseError.STAGE_INACTIVE);
    expect(() => {
      assertReachable([aTraiter, gele], aTraiter, gele);
    }).toThrow(ConflictException);
  });

  it('rester sur place n’est pas une transition', () => {
    expect(
      refusalCode(() => {
        assertReachable(STAGES, enTraitement, enTraitement);
      }),
    ).toBe(BankCaseError.STAGE_NOT_NEXT);
  });

  it('réordonner change l’étape suivante SANS toucher aux transitions déjà écrites', () => {
    const instruction = stage({ id: 'instruction', position: 2 });
    const validation = stage({ id: 'validation', position: 3 });
    const avant = [aTraiter, instruction, validation, encaisse, rejete];
    expect(nextOpenStage(avant, aTraiter)?.id).toBe('instruction');

    const apres = [
      aTraiter,
      { ...validation, position: 2 },
      { ...instruction, position: 3 },
      encaisse,
      rejete,
    ];
    expect(nextOpenStage(apres, aTraiter)?.id).toBe('validation');

    const historique = { fromStageId: aTraiter.id, toStageId: instruction.id };
    expect(apres.find((item) => item.id === historique.toStageId)?.label).toBe('instruction');
  });
});

describe('règles financières', () => {
  it('ENCAISSE exige un montant', () => {
    expect(refusalCode(() => planTransitionEffect(encaisse, {}, undefined))).toBe(
      BankCaseError.AMOUNT_REQUIRED,
    );
  });

  it('ENCAISSE refuse un montant nul : « encaissé pour 0 FCFA » n’existe pas', () => {
    expect(refusalCode(() => planTransitionEffect(encaisse, { amountXof: '0' }, undefined))).toBe(
      BankCaseError.AMOUNT_REQUIRED,
    );
    expect(refusalCode(() => planTransitionEffect(encaisse, { amountXof: '000' }, undefined))).toBe(
      BankCaseError.AMOUNT_REQUIRED,
    );
  });

  it('ENCAISSE accepte un montant strictement positif et n’écrit aucun motif', () => {
    expect(planTransitionEffect(encaisse, { amountXof: '1200000' }, undefined)).toEqual({
      amountXof: '1200000',
      rejectionReasonId: null,
      rejectionDetail: null,
    });
  });

  it('ENCAISSE refuse un motif de rejet', () => {
    expect(
      refusalCode(() =>
        planTransitionEffect(encaisse, { amountXof: '5000', rejectionReasonId: 'r-1' }, 'DOSSIER'),
      ),
    ).toBe(BankCaseError.REJECTION_REASON_NOT_ALLOWED);
  });

  it('REJETE exige un motif', () => {
    expect(refusalCode(() => planTransitionEffect(rejete, {}, undefined))).toBe(
      BankCaseError.REJECTION_REASON_REQUIRED,
    );
  });

  it('REJETE force le montant à zéro côté serveur, même si le client en envoie un', () => {
    const effect = planTransitionEffect(
      rejete,
      { amountXof: '1200000', rejectionReasonId: 'r-1' },
      'DOSSIER_INCOMPLET',
    );
    expect(effect.amountXof).toBe('0');
    expect(effect.rejectionReasonId).toBe('r-1');
  });

  it('le motif AUTRE exige une précision libre', () => {
    expect(
      refusalCode(() => planTransitionEffect(rejete, { rejectionReasonId: 'r-autre' }, 'AUTRE')),
    ).toBe(BankCaseError.REJECTION_DETAIL_REQUIRED);

    expect(
      refusalCode(() =>
        planTransitionEffect(
          rejete,
          { rejectionReasonId: 'r-autre', rejectionDetail: '   ' },
          'AUTRE',
        ),
      ),
    ).toBe(BankCaseError.REJECTION_DETAIL_REQUIRED);

    expect(
      planTransitionEffect(
        rejete,
        { rejectionReasonId: 'r-autre', rejectionDetail: '  Banque injoignable  ' },
        'AUTRE',
      ),
    ).toEqual({
      amountXof: '0',
      rejectionReasonId: 'r-autre',
      rejectionDetail: 'Banque injoignable',
    });
  });

  it('un autre motif que AUTRE se passe de précision', () => {
    expect(
      planTransitionEffect(rejete, { rejectionReasonId: 'r-1' }, 'DOSSIER_INCOMPLET')
        .rejectionDetail,
    ).toBeNull();
  });

  it('une étape OUVERTE ne porte ni montant ni motif', () => {
    expect(planTransitionEffect(enTraitement, {}, undefined)).toEqual({
      amountXof: null,
      rejectionReasonId: null,
      rejectionDetail: null,
    });
    expect(
      refusalCode(() => planTransitionEffect(enTraitement, { amountXof: '5000' }, undefined)),
    ).toBe(BankCaseError.AMOUNT_NOT_ALLOWED);
    expect(
      refusalCode(() => planTransitionEffect(enTraitement, { rejectionReasonId: 'r-1' }, 'X')),
    ).toBe(BankCaseError.REJECTION_REASON_NOT_ALLOWED);
  });

  it('tout refus financier est un 422, jamais un 500', () => {
    expect(() => planTransitionEffect(encaisse, {}, undefined)).toThrow(
      UnprocessableEntityException,
    );
    expect(() => planTransitionEffect(rejete, {}, undefined)).toThrow(UnprocessableEntityException);
  });
});
