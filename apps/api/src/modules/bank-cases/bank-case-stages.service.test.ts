import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BankStageType } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import { BankCaseStagesService } from './bank-case-stages.service.js';
import { BankCaseError } from './errors.js';
import { UpdateBankCaseStageDto } from './dto.js';
import {
  AGENT,
  FakePrisma,
  STAGE_A_TRAITER,
  STAGE_ENCAISSE,
  STAGE_EN_TRAITEMENT,
  STAGE_REJETE,
} from './fake-prisma.js';

interface ErrorBody {
  code?: string;
  caseCount?: number;
  stageId?: string;
  missing?: string[];
  unknown?: string[];
}

const bodyOf = (error: unknown): ErrorBody => (error as { response?: unknown }).response ?? {};

async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

let db: FakePrisma;
let service: BankCaseStagesService;

beforeEach(() => {
  db = new FakePrisma();
  service = new BankCaseStagesService(db.asService());
});

describe('lecture', () => {
  it('rend les étapes dans l’ordre du flux, actives seulement par défaut', async () => {
    const gele = db.stages.find((row) => row.id === STAGE_EN_TRAITEMENT.id);
    if (!gele) throw new Error('fixture absente');
    gele.isActive = false;

    const actives = await service.list(false);
    expect(actives.items.map((item) => item.code)).toEqual(['A_TRAITER', 'ENCAISSE', 'REJETE']);

    const toutes = await service.list(true);
    expect(toutes.items.map((item) => item.code)).toEqual([
      'A_TRAITER',
      'EN_TRAITEMENT_BANQUE',
      'ENCAISSE',
      'REJETE',
    ]);
  });
});

describe('création', () => {
  it('crée une étape OUVERTE en fin de flux ouvert, jamais système', async () => {
    const created = await service.create({
      code: 'validation_dg',
      label: '  Validation DG  ',
      color: '  warning  ',
    });

    expect(created.code).toBe('VALIDATION_DG');
    expect(created.label).toBe('Validation DG');
    expect(created.color).toBe('warning');
    expect(created.type).toBe(BankStageType.OPEN);
    expect(created.isSystem).toBe(false);
    expect(created.isInitial).toBe(false);
    // Après la dernière étape OUVERTE (position 2), pas après REJETE (101).
    expect(created.position).toBe(3);
  });

  /**
   * Insérer au milieu DÉCALE les suivantes plutôt que de laisser deux étapes
   * partager une position : « l'étape suivante » deviendrait non déterministe.
   */
  it('insérer au milieu décale les étapes ouvertes suivantes', async () => {
    const created = await service.create({
      code: 'CONTROLE',
      label: 'Contrôle',
      color: 'info',
      position: 2,
    });

    expect(created.position).toBe(2);
    const apres = db.stages.find((row) => row.id === STAGE_EN_TRAITEMENT.id);
    expect(apres?.position).toBe(3);
    // Les étapes système ne sont pas décalées : elles ne sont pas de type OPEN.
    expect(db.stages.find((row) => row.id === STAGE_ENCAISSE.id)?.position).toBe(100);
  });

  it('un code déjà pris est un 409 typé qui nomme l’étape titulaire', async () => {
    const error = await refusal(() =>
      service.create({ code: 'A_TRAITER', label: 'Doublon', color: 'info' }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_CODE_CONFLICT);
  });

  it('la position est bornée à 99 : 100 et 101 sont réservées au système', async () => {
    const created = await service.create({
      code: 'TARDIVE',
      label: 'Tardive',
      color: 'info',
      position: 99,
    });
    expect(created.position).toBe(99);
  });
});

describe('modification', () => {
  it('renomme et recolorie', async () => {
    const updated = await service.update(STAGE_EN_TRAITEMENT.id, {
      label: 'Chez la banque',
      color: 'warning',
    });
    expect(updated.label).toBe('Chez la banque');
    expect(updated.color).toBe('warning');
    expect(updated.code).toBe('EN_TRAITEMENT_BANQUE');
  });

  /**
   * La NATURE d'une étape n'est pas modifiable, et ce n'est pas une garde
   * d'exécution : le DTO ne porte tout simplement ni `code`, ni `type`, ni
   * `isInitial`, et `forbidNonWhitelisted` rejette tout champ inconnu. Une étape
   * déjà inscrite dans l'historique d'un dossier clos ne peut donc pas changer
   * de sens rétroactivement.
   */
  it('le contrat d’écriture n’expose NI code, NI type, NI isInitial', () => {
    const champs = Object.getOwnPropertyNames(new UpdateBankCaseStageDto());
    expect(champs).not.toContain('code');
    expect(champs).not.toContain('type');
    expect(champs).not.toContain('isInitial');
    expect(champs).not.toContain('isSystem');
  });

  it('une étape inconnue est un 404 typé', async () => {
    const error = await refusal(() => service.update('stg-fantome', { label: 'X' }));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_NOT_FOUND);
  });
});

describe('activation', () => {
  /**
   * Les étapes système portent les règles financières du module — point
   * d'entrée, encaissement, rejet. Les désactiver rendrait le workflow
   * inexploitable sans le moindre message d'erreur.
   */
  it('une étape SYSTÈME n’est jamais désactivable', async () => {
    for (const systeme of [STAGE_A_TRAITER, STAGE_ENCAISSE, STAGE_REJETE]) {
      const error = await refusal(() => service.setActive(systeme.id, { isActive: false }));
      expect(error).toBeInstanceOf(ConflictException);
      expect(bodyOf(error).code).toBe(BankCaseError.STAGE_SYSTEM_IMMUTABLE);
    }
  });

  it('une étape système n’est pas davantage RÉ-activable : son activation ne se configure pas', async () => {
    const error = await refusal(() => service.setActive(STAGE_ENCAISSE.id, { isActive: true }));
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_SYSTEM_IMMUTABLE);
  });

  /**
   * Les dossiers qui stationnent sur l'étape deviendraient invisibles du flux,
   * sans que personne ne soit averti qu'ils existent toujours.
   */
  it('une étape qui porte encore des dossiers n’est pas désactivable, et le refus les COMPTE', async () => {
    db.addCase({
      id: 'case-1',
      reference: 'R1',
      referenceKey: 'R1',
      currentStageId: STAGE_EN_TRAITEMENT.id,
    });
    db.addCase({
      id: 'case-2',
      reference: 'R2',
      referenceKey: 'R2',
      currentStageId: STAGE_EN_TRAITEMENT.id,
    });

    const error = await refusal(() =>
      service.setActive(STAGE_EN_TRAITEMENT.id, { isActive: false }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_HAS_OPEN_CASES);
    expect(bodyOf(error).caseCount).toBe(2);
    expect(db.stages.find((row) => row.id === STAGE_EN_TRAITEMENT.id)?.isActive).toBe(true);
  });

  it('un dossier supprimé ne bloque plus la désactivation', async () => {
    db.addCase({
      id: 'case-efface',
      reference: 'R3',
      referenceKey: 'R3',
      currentStageId: STAGE_EN_TRAITEMENT.id,
      deletedAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const updated = await service.setActive(STAGE_EN_TRAITEMENT.id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });

  it('une étape vide se désactive puis se réactive', async () => {
    expect((await service.setActive(STAGE_EN_TRAITEMENT.id, { isActive: false })).isActive).toBe(
      false,
    );
    expect((await service.setActive(STAGE_EN_TRAITEMENT.id, { isActive: true })).isActive).toBe(
      true,
    );
  });
});

describe('réordonnancement', () => {
  const ouvertes = (): string[] =>
    db.stages
      .filter((row) => row.type === BankStageType.OPEN)
      .sort((left, right) => left.position - right.position)
      .map((row) => row.code);

  it('réordonne les étapes ouvertes et renvoie le flux complet', async () => {
    const troisieme = await service.create({
      code: 'VALIDATION',
      label: 'Validation',
      color: 'info',
    });

    await service.reorder({
      stageIds: [STAGE_A_TRAITER.id, troisieme.id, STAGE_EN_TRAITEMENT.id],
    });

    expect(ouvertes()).toEqual(['A_TRAITER', 'VALIDATION', 'EN_TRAITEMENT_BANQUE']);
  });

  /**
   * Le réordonnancement n'affecte QUE les transitions futures. Les positions ne
   * sont lues qu'au moment de calculer l'étape suivante ; l'historique référence
   * des étapes par IDENTIFIANT et reste lisible des années après un remaniement.
   */
  it('ne touche pas aux transitions déjà écrites', async () => {
    const troisieme = await service.create({
      code: 'VALIDATION',
      label: 'Validation',
      color: 'info',
    });
    db.addCase({ id: 'case-h', reference: 'RH', referenceKey: 'RH' });
    db.transitions.push({
      id: 'trs-h',
      caseId: 'case-h',
      fromStageId: STAGE_A_TRAITER.id,
      toStageId: STAGE_EN_TRAITEMENT.id,
      performedById: AGENT.id,
      amountXof: null,
      rejectionReasonId: null,
      rejectionDetail: null,
      comment: null,
      correctionReason: null,
      createdAt: new Date('2026-08-02T09:00:00.000Z'),
    });
    const avant = { ...db.transitions[0] };

    await service.reorder({
      stageIds: [STAGE_A_TRAITER.id, troisieme.id, STAGE_EN_TRAITEMENT.id],
    });

    expect(db.transitions[0]).toEqual(avant);
    // L'étape référencée existe toujours et n'a changé QUE de position.
    const cible = db.stages.find((row) => row.id === STAGE_EN_TRAITEMENT.id);
    expect(cible?.code).toBe('EN_TRAITEMENT_BANQUE');
    expect(cible?.position).toBe(3);
  });

  it('la liste doit être EXHAUSTIVE : un oubli est refusé et nommé', async () => {
    await service.create({ code: 'VALIDATION', label: 'Validation', color: 'info' });

    const error = await refusal(() =>
      service.reorder({ stageIds: [STAGE_A_TRAITER.id, STAGE_EN_TRAITEMENT.id] }),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_REORDER_INCOMPLETE);
    expect(bodyOf(error).missing).toHaveLength(1);
  });

  it('une étape inconnue — ou système — dans la liste est refusée', async () => {
    const error = await refusal(() =>
      service.reorder({
        stageIds: [STAGE_A_TRAITER.id, STAGE_EN_TRAITEMENT.id, STAGE_ENCAISSE.id],
      }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_REORDER_INCOMPLETE);
    expect(bodyOf(error).unknown).toEqual([STAGE_ENCAISSE.id]);
  });

  /**
   * Un dossier NAÎT sur l'étape initiale : la placer au milieu du flux rendrait
   * inaccessibles les étapes qui la précèdent.
   */
  it('l’étape initiale doit rester en première position', async () => {
    const error = await refusal(() =>
      service.reorder({ stageIds: [STAGE_EN_TRAITEMENT.id, STAGE_A_TRAITER.id] }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_INITIAL_MUST_BE_FIRST);
    // Rien n'a bougé.
    expect(ouvertes()).toEqual(['A_TRAITER', 'EN_TRAITEMENT_BANQUE']);
  });
});
