import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Role } from '@crm/database';
import { Phase2Status } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BankCasesService } from './bank-cases.service.js';
import { BankCaseError } from './errors.js';
import {
  ADMIN,
  AGENT,
  AGENT_BIS,
  FakePrisma,
  REASON_AUTRE,
  REASON_INCOMPLET,
  REASON_RETIRE,
  STAGE_A_TRAITER,
  STAGE_ENCAISSE,
  STAGE_EN_TRAITEMENT,
  STAGE_REJETE,
} from './fake-prisma.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const user = (fake: { id: string; fullName: string; role: Role }): AuthenticatedUser => ({
  id: fake.id,
  email: `${fake.id}@cpi.sn`,
  username: fake.id,
  fullName: fake.fullName,
  role: fake.role,
});

const agent = user(AGENT);
const agentBis = user(AGENT_BIS);
const admin = user(ADMIN);

/** Corps typé d'une exception métier Nest. */
interface ErrorBody {
  code?: string;
  banqueId?: string;
  existing?: { id: string; reference: string; referenceKey: string };
  current?: { rev: number; currentStage: { code: string } };
  currentRev?: number;
  phase2Status?: string;
}

const bodyOf = (error: unknown): ErrorBody => (error as { response?: unknown }).response ?? {};

/** Exécute et rend l'erreur levée. Échoue explicitement si l'appel réussit. */
async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

let db: FakePrisma;
let service: BankCasesService;

beforeEach(() => {
  db = new FakePrisma();
  service = new BankCasesService(db.asService(), fakeDemoVisibility());
  db.addProspect({ id: 'psp-enrole', nom: 'Diop', prenom: 'Awa', phoneE164: '+221771234567' });
  db.addProspect({
    id: 'psp-en-cours',
    nom: 'Sarr',
    prenom: 'Modou',
    phoneE164: '+221770000002',
    phase2Status: Phase2Status.PENDING,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ouverture d'un dossier
// ─────────────────────────────────────────────────────────────────────────────

describe('ouverture d’un dossier', () => {
  it('copie l’identité du prospect et démarre sur l’étape initiale', async () => {
    const created = await service.create(agent, {
      prospectId: 'psp-enrole',
      reference: 'BNK 2026-014',
    });

    expect(created.customerName).toBe('Awa Diop');
    expect(created.customerPhoneE164).toBe('+221771234567');
    expect(created.currentStage.code).toBe('A_TRAITER');
    expect(created.rev).toBe(1);
    expect(created.isTerminal).toBe(false);
    expect(created.amountXof).toBeNull();
    expect(created.createdByName).toBe('Fatou Ndiaye');
  });

  // Régression : la recherche de l'étape initiale ne filtrait pas sur
  // `isActive`. Une étape initiale DÉSACTIVÉE continuait donc de recevoir tous
  // les nouveaux dossiers. L'administrateur qui la retire du workflow croit
  // l'avoir sortie du circuit, et les dossiers s'accumulent en silence à une
  // étape qui n'apparaît plus nulle part.
  it('refuse d’ouvrir sur une étape initiale DÉSACTIVÉE', async () => {
    const initial = db.stages.find((item) => item.id === STAGE_A_TRAITER.id);
    if (!initial) throw new Error('étape initiale absente du double');
    initial.isActive = false;

    const error = await refusal(() =>
      service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-INACTIVE' }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.NO_INITIAL_STAGE);
  });

  // Rien n'interdit en base deux étapes initiales actives. Sans `orderBy`,
  // PostgreSQL est libre de rendre l'une ou l'autre selon le plan retenu, et
  // deux dossiers créés à la suite pouvaient démarrer à des étapes différentes.
  it('départage deux étapes initiales actives par la position, jamais au hasard', async () => {
    db.stages.push({
      ...STAGE_A_TRAITER,
      id: 'stg-a-traiter-bis',
      code: 'A_TRAITER_BIS',
      label: 'À traiter (doublon)',
      position: 0,
    });

    const premier = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-X' });
    const second = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-Y' });

    expect(premier.currentStage.code).toBe('A_TRAITER_BIS');
    expect(second.currentStage.code).toBe(premier.currentStage.code);
  });

  it('l’ouverture est elle-même une transition : la timeline commence à la création', async () => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-1' });
    const detail = await service.get(created.id);

    expect(detail.history).toHaveLength(1);
    expect(detail.history[0]?.fromStage).toBeNull();
    expect(detail.history[0]?.toStage.code).toBe('A_TRAITER');
    expect(detail.history[0]?.performedById).toBe(AGENT.id);
  });

  it('la banque par défaut est celle du prospect, et peut être surchargée', async () => {
    const parDefaut = await service.create(agent, {
      prospectId: 'psp-enrole',
      reference: 'REF-DEF',
    });
    expect(parDefaut.processingBankId).toBe('bnq-cbao');

    const choisie = await service.create(agent, {
      prospectId: 'psp-enrole',
      reference: 'REF-ALT',
      processingBankId: 'bnq-bhs',
    });
    expect(choisie.processingBankId).toBe('bnq-bhs');
  });

  /**
   * Hypothèse produit verrouillée : le dossier bancaire suit l'enrôlement. Le
   * refus doit NOMMER le statut rencontré, sans quoi l'agent ne sait pas s'il
   * doit relancer la phase 2 ou s'il s'est trompé de personne.
   */
  it('refuse un prospect qui n’est pas en METHOD_OBTAINED, en nommant son statut', async () => {
    const error = await refusal(() =>
      service.create(agent, { prospectId: 'psp-en-cours', reference: 'REF-KO' }),
    );

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(bodyOf(error).code).toBe(BankCaseError.PROSPECT_NOT_ENROLLED);
    expect(bodyOf(error).phase2Status).toBe(Phase2Status.PENDING);
    expect(db.cases).toHaveLength(0);
  });

  it('refuse un prospect inconnu ou supprimé', async () => {
    db.addProspect({ id: 'psp-efface', deletedAt: new Date('2026-07-01T00:00:00.000Z') });

    expect(
      bodyOf(
        await refusal(() => service.create(agent, { prospectId: 'psp-absent', reference: 'R1' })),
      ).code,
    ).toBe(BankCaseError.PROSPECT_NOT_FOUND);
    expect(
      bodyOf(
        await refusal(() => service.create(agent, { prospectId: 'psp-efface', reference: 'R2' })),
      ).code,
    ).toBe(BankCaseError.PROSPECT_NOT_FOUND);
  });

  // 422 et NON 400 : l'identifiant est un UUID valide, il ne désigne
  // simplement aucune banque. Même classe de faute que
  // `CLIENT_REQUEST_BANQUE_NOT_FOUND`, qui sortait déjà en 422. Le corps
  // nomme la clé `banqueId`, comme partout ailleurs dans le contrat, et non
  // `bankId`.
  it('refuse une banque de traitement inconnue, en 422 et sous le nom banqueId', async () => {
    const error = await refusal(() =>
      service.create(agent, {
        prospectId: 'psp-enrole',
        reference: 'REF-BQ',
        processingBankId: 'bnq-fantome',
      }),
    );

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(bodyOf(error).code).toBe(BankCaseError.BANK_NOT_FOUND);
    expect(bodyOf(error).banqueId).toBe('bnq-fantome');
    expect(bodyOf(error)).not.toHaveProperty('bankId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unicité de la référence
// ─────────────────────────────────────────────────────────────────────────────

describe('unicité de la référence', () => {
  it('la casse ne distingue pas deux références', async () => {
    await service.create(agent, { prospectId: 'psp-enrole', reference: 'ABC-123' });
    const error = await refusal(() =>
      service.create(agent, { prospectId: 'psp-enrole', reference: 'abc-123' }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.REFERENCE_CONFLICT);
    expect(bodyOf(error).existing?.reference).toBe('ABC-123');
    expect(db.cases).toHaveLength(1);
  });

  it('les espaces multiples ne distinguent pas non plus', async () => {
    await service.create(agent, { prospectId: 'psp-enrole', reference: 'abc 123' });
    const error = await refusal(() =>
      service.create(agent, { prospectId: 'psp-enrole', reference: '  ABC   123  ' }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.REFERENCE_CONFLICT);
    expect(bodyOf(error).existing?.referenceKey).toBe('ABC 123');
  });

  /**
   * Contrepartie DÉLIBÉRÉE de la règle ci-dessus, documentée dans
   * `reference-key.ts` : la normalisation ne touche ni aux tirets ni aux barres
   * obliques. « ABC-123 » et « ABC 123 » sont deux références distinctes pour la
   * banque, et les fusionner rejetterait des dossiers légitimes.
   */
  it('en revanche un séparateur différent fait bien DEUX références', async () => {
    await service.create(agent, { prospectId: 'psp-enrole', reference: 'ABC-123' });
    const autre = await service.create(agent, { prospectId: 'psp-enrole', reference: 'abc 123' });

    expect(autre.referenceKey).toBe('ABC 123');
    expect(db.cases).toHaveLength(2);
  });

  it('la saisie de l’agent est conservée telle quelle, la clé est normalisée', async () => {
    const created = await service.create(agent, {
      prospectId: 'psp-enrole',
      reference: '  bnk 2026-014  ',
    });
    expect(created.reference).toBe('bnk 2026-014');
    expect(created.referenceKey).toBe('BNK 2026-014');
  });

  /**
   * LE cas que le pré-contrôle ne peut pas couvrir.
   *
   * Entre la lecture d'`assertReferenceFree` et l'INSERT, un autre agent prend
   * la référence. Sans rattrapage du P2002, le second reçoit un 500 illisible
   * là où le premier recevait un message clair, pour exactement la même
   * erreur. On reproduit la fenêtre en insérant la ligne concurrente juste
   * avant l'écriture.
   */
  it('une création concurrente remonte en 409 typé pointant le dossier existant', async () => {
    let dejaJoue = false;
    db.onBeforeCaseCreate = (): void => {
      if (dejaJoue) return;
      dejaJoue = true;
      db.addCase({
        id: 'case-concurrent',
        reference: 'BNK 2026-014',
        referenceKey: 'BNK 2026-014',
        createdById: AGENT_BIS.id,
      });
    };

    const error = await refusal(() =>
      service.create(agent, { prospectId: 'psp-enrole', reference: 'BNK 2026-014' }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.REFERENCE_CONFLICT);
    // Le corps DÉSIGNE le dossier gagnant : le client peut y renvoyer l'agent.
    expect(bodyOf(error).existing?.id).toBe('case-concurrent');
  });

  it('renommer un dossier vers une référence prise est refusé', async () => {
    const premier = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-A' });
    await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-B' });

    const error = await refusal(() =>
      service.update(agent, premier.id, { expectedRev: premier.rev, reference: 'ref-b' }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.REFERENCE_CONFLICT);
  });

  it('renommer un dossier vers SA PROPRE référence, casse comprise, reste permis', async () => {
    const dossier = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-A' });
    const renomme = await service.update(agent, dossier.id, {
      expectedRev: dossier.rev,
      reference: 'ref-a',
    });
    expect(renomme.reference).toBe('ref-a');
    expect(renomme.referenceKey).toBe('REF-A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Immuabilité de l'identité copiée
// ─────────────────────────────────────────────────────────────────────────────

describe('immuabilité de l’identité transmise à la banque', () => {
  /**
   * Un dossier bancaire est une pièce à valeur historique. Si un administrateur
   * corrige demain l'orthographe du prospect, le dossier doit continuer de
   * refléter ce qui a été transmis à la banque ce jour-là : c'est ce qui le rend
   * opposable.
   */
  it('modifier le prospect APRÈS coup ne réécrit pas le dossier', async () => {
    const created = await service.create(agent, {
      prospectId: 'psp-enrole',
      reference: 'REF-HIST',
    });
    expect(created.customerName).toBe('Awa Diop');

    const prospect = db.prospects.find((row) => row.id === 'psp-enrole');
    if (!prospect) throw new Error('fixture absente');
    prospect.nom = 'DIOP-NDIAYE';
    prospect.prenom = 'Awa Marième';
    prospect.phoneE164 = '+221778889900';

    const relu = await service.get(created.id);
    expect(relu.bankCase.customerName).toBe('Awa Diop');
    expect(relu.bankCase.customerPhoneE164).toBe('+221771234567');
    // Le lien vers le prospect subsiste : c'est la COPIE qui est figée, pas la
    // traçabilité.
    expect(relu.bankCase.prospectId).toBe('psp-enrole');
  });

  it('aucun champ d’identité n’est modifiable par PATCH', async () => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-P' });
    const updated = await service.update(agent, created.id, {
      expectedRev: created.rev,
      processingBankId: 'bnq-bhs',
    });

    expect(updated.customerName).toBe('Awa Diop');
    expect(updated.processingBankId).toBe('bnq-bhs');
    expect(updated.rev).toBe(2);
    expect(updated.updatedById).toBe(AGENT.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('transitions', () => {
  const ouvrir = async (reference = 'REF-T'): Promise<{ id: string; rev: number }> => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference });
    return { id: created.id, rev: created.rev };
  };

  const avancer = async (dossier: {
    id: string;
    rev: number;
  }): Promise<{ id: string; rev: number }> => {
    const detail = await service.transition(agent, dossier.id, {
      targetStageId: STAGE_EN_TRAITEMENT.id,
      expectedRev: dossier.rev,
    });
    return { id: detail.bankCase.id, rev: detail.bankCase.rev };
  };

  it('avance d’une étape ouverte à la suivante, incrémente la révision et trace', async () => {
    const dossier = await ouvrir();
    const detail = await service.transition(agent, dossier.id, {
      targetStageId: STAGE_EN_TRAITEMENT.id,
      expectedRev: dossier.rev,
      comment: '  Transmis au guichet  ',
    });

    expect(detail.bankCase.currentStage.code).toBe('EN_TRAITEMENT_BANQUE');
    expect(detail.bankCase.rev).toBe(2);
    expect(detail.history).toHaveLength(2);
    const derniere = detail.history[1];
    expect(derniere?.fromStage?.code).toBe('A_TRAITER');
    expect(derniere?.toStage.code).toBe('EN_TRAITEMENT_BANQUE');
    expect(derniere?.comment).toBe('Transmis au guichet');
    expect(derniere?.correctionReason).toBeNull();
  });

  it('ENCAISSE écrit le montant sur le dossier ET sur la transition', async () => {
    const dossier = await avancer(await ouvrir());
    const detail = await service.transition(agent, dossier.id, {
      targetStageId: STAGE_ENCAISSE.id,
      expectedRev: dossier.rev,
      amountXof: '1200000',
    });

    // Chaîne, jamais nombre : XOF est un Decimal(18,0).
    expect(detail.bankCase.amountXof).toBe('1200000');
    expect(typeof detail.bankCase.amountXof).toBe('string');
    expect(detail.bankCase.isTerminal).toBe(true);
    expect(detail.history.at(-1)?.amountXof).toBe('1200000');
  });

  it('ENCAISSE refuse un montant nul ou absent', async () => {
    const dossier = await avancer(await ouvrir());

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_ENCAISSE.id,
            expectedRev: dossier.rev,
          }),
        ),
      ).code,
    ).toBe(BankCaseError.AMOUNT_REQUIRED);

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_ENCAISSE.id,
            expectedRev: dossier.rev,
            amountXof: '0',
          }),
        ),
      ).code,
    ).toBe(BankCaseError.AMOUNT_REQUIRED);

    // Rien n'a bougé : ni l'étape, ni la révision, ni l'historique.
    const relu = await service.get(dossier.id);
    expect(relu.bankCase.currentStage.code).toBe('EN_TRAITEMENT_BANQUE');
    expect(relu.bankCase.rev).toBe(dossier.rev);
    expect(relu.history).toHaveLength(2);
  });

  it('REJETE exige un motif et force le montant à zéro', async () => {
    const dossier = await ouvrir();

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_REJETE.id,
            expectedRev: dossier.rev,
          }),
        ),
      ).code,
    ).toBe(BankCaseError.REJECTION_REASON_REQUIRED);

    const detail = await service.transition(agent, dossier.id, {
      targetStageId: STAGE_REJETE.id,
      expectedRev: dossier.rev,
      // Le client tente d'imposer un montant : le serveur l'ignore.
      amountXof: '900000',
      rejectionReasonId: REASON_INCOMPLET.id,
    });

    expect(detail.bankCase.amountXof).toBe('0');
    expect(detail.bankCase.rejectionReason?.code).toBe('DOSSIER_INCOMPLET');
    expect(detail.history.at(-1)?.amountXof).toBe('0');
  });

  it('le motif AUTRE exige en plus une précision', async () => {
    const dossier = await ouvrir();

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_REJETE.id,
            expectedRev: dossier.rev,
            rejectionReasonId: REASON_AUTRE.id,
          }),
        ),
      ).code,
    ).toBe(BankCaseError.REJECTION_DETAIL_REQUIRED);

    const detail = await service.transition(agent, dossier.id, {
      targetStageId: STAGE_REJETE.id,
      expectedRev: dossier.rev,
      rejectionReasonId: REASON_AUTRE.id,
      rejectionDetail: 'Client injoignable depuis trois semaines',
    });
    expect(detail.bankCase.rejectionDetail).toBe('Client injoignable depuis trois semaines');
  });

  it('un motif désactivé ou inconnu est refusé', async () => {
    const dossier = await ouvrir();

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_REJETE.id,
            expectedRev: dossier.rev,
            rejectionReasonId: REASON_RETIRE.id,
          }),
        ),
      ).code,
    ).toBe(BankCaseError.REJECTION_REASON_NOT_FOUND);

    expect(
      bodyOf(
        await refusal(() =>
          service.transition(agent, dossier.id, {
            targetStageId: STAGE_REJETE.id,
            expectedRev: dossier.rev,
            rejectionReasonId: 'rsn-fantome',
          }),
        ),
      ).code,
    ).toBe(BankCaseError.REJECTION_REASON_NOT_FOUND);
  });

  it('on ne saute pas l’instruction pour déclarer un encaissement', async () => {
    const dossier = await ouvrir();
    const error = await refusal(() =>
      service.transition(agent, dossier.id, {
        targetStageId: STAGE_ENCAISSE.id,
        expectedRev: dossier.rev,
        amountXof: '500000',
      }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.CASHED_NOT_LAST);
  });

  it('une étape inconnue est un 404 typé', async () => {
    const dossier = await ouvrir();
    const error = await refusal(() =>
      service.transition(agent, dossier.id, {
        targetStageId: 'stg-fantome',
        expectedRev: dossier.rev,
      }),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_NOT_FOUND);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrence optimiste
// ─────────────────────────────────────────────────────────────────────────────

describe('conflit de révision', () => {
  it('deux agents sur la même révision : le second est refusé avec l’état COURANT', async () => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-CC' });
    expect(created.rev).toBe(1);

    // Fatou avance le dossier.
    await service.transition(agent, created.id, {
      targetStageId: STAGE_EN_TRAITEMENT.id,
      expectedRev: 1,
    });

    // Ibrahima avait chargé l'écran avant : il travaille encore sur rev 1 et
    // veut rejeter le dossier. La cible est atteignable, c'est bien la GARDE DE
    // RÉVISION qui l'arrête, et non un refus d'atteignabilité.
    const error = await refusal(() =>
      service.transition(agentBis, created.id, {
        targetStageId: STAGE_REJETE.id,
        expectedRev: 1,
        rejectionReasonId: REASON_INCOMPLET.id,
      }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    const body = bodyOf(error);
    expect(body.code).toBe(BankCaseError.REV_CONFLICT);
    // Le corps EMBARQUE l'état courant : l'interface montre ce que l'autre agent
    // a fait plutôt que de demander un rechargement à l'aveugle.
    expect(body.currentRev).toBe(2);
    expect(body.current?.rev).toBe(2);
    expect(body.current?.currentStage.code).toBe('EN_TRAITEMENT_BANQUE');
  });

  it('le PATCH est gardé par la même révision', async () => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-CP' });
    await service.update(agent, created.id, { expectedRev: 1, reference: 'REF-CP-V2' });

    const error = await refusal(() =>
      service.update(agentBis, created.id, { expectedRev: 1, reference: 'REF-CP-V3' }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.REV_CONFLICT);
    expect(bodyOf(error).currentRev).toBe(2);

    // La tentative perdante n'a rien écrit.
    const relu = await service.get(created.id);
    expect(relu.bankCase.reference).toBe('REF-CP-V2');
  });

  it('aucune transition n’est écrite quand la révision est refusée', async () => {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference: 'REF-CT' });
    await refusal(() =>
      service.transition(agentBis, created.id, {
        targetStageId: STAGE_EN_TRAITEMENT.id,
        expectedRev: 99,
      }),
    );

    const relu = await service.get(created.id);
    expect(relu.history).toHaveLength(1);
    expect(relu.bankCase.currentStage.code).toBe('A_TRAITER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verrou terminal et correction administrateur
// ─────────────────────────────────────────────────────────────────────────────

describe('verrou terminal et correction ADMIN', () => {
  /** Ouvre puis mène jusqu'à l'encaissement. */
  async function encaisser(reference: string): Promise<{ id: string; rev: number }> {
    const created = await service.create(agent, { prospectId: 'psp-enrole', reference });
    const enCours = await service.transition(agent, created.id, {
      targetStageId: STAGE_EN_TRAITEMENT.id,
      expectedRev: created.rev,
    });
    const encaisse = await service.transition(agent, created.id, {
      targetStageId: STAGE_ENCAISSE.id,
      expectedRev: enCours.bankCase.rev,
      amountXof: '1200000',
    });
    return { id: created.id, rev: encaisse.bankCase.rev };
  }

  it('un dossier encaissé est VERROUILLÉ pour une transition ordinaire', async () => {
    const dossier = await encaisser('REF-VER');
    const error = await refusal(() =>
      service.transition(agent, dossier.id, {
        targetStageId: STAGE_EN_TRAITEMENT.id,
        expectedRev: dossier.rev,
      }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(BankCaseError.TERMINAL);
  });

  it('un dossier terminal n’est pas non plus modifiable par PATCH', async () => {
    const dossier = await encaisser('REF-VER2');
    const error = await refusal(() =>
      service.update(agent, dossier.id, { expectedRev: dossier.rev, reference: 'REF-AUTRE' }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.TERMINAL);
  });

  /**
   * La correction contourne l'atteignabilité et le verrou terminal, c'est sa
   * raison d'être, mais RIEN d'autre.
   */
  it('la correction ADMIN franchit le verrou et écrit une transition auditée', async () => {
    const dossier = await encaisser('REF-COR');

    const detail = await service.correct(admin, dossier.id, {
      targetStageId: STAGE_REJETE.id,
      expectedRev: dossier.rev,
      rejectionReasonId: REASON_INCOMPLET.id,
      reason: '  Encaissement saisi sur le mauvais dossier  ',
    });

    expect(detail.bankCase.currentStage.code).toBe('REJETE');
    // Les règles financières s'appliquent à l'identique : le rejet remet à zéro.
    expect(detail.bankCase.amountXof).toBe('0');

    const derniere = detail.history.at(-1);
    expect(derniere?.correctionReason).toBe('Encaissement saisi sur le mauvais dossier');
    expect(derniere?.performedById).toBe(ADMIN.id);
    // L'historique est APPEND-ONLY : la correction s'ajoute, elle n'efface pas
    // l'encaissement qu'elle corrige.
    expect(detail.history).toHaveLength(4);
    expect(detail.history.map((item) => item.toStage.code)).toEqual([
      'A_TRAITER',
      'EN_TRAITEMENT_BANQUE',
      'ENCAISSE',
      'REJETE',
    ]);
  });

  it('la correction reste soumise aux règles financières de l’étape visée', async () => {
    const dossier = await encaisser('REF-COR2');

    // Rejet sans motif : refusé, correction ou pas.
    expect(
      bodyOf(
        await refusal(() =>
          service.correct(admin, dossier.id, {
            targetStageId: STAGE_REJETE.id,
            expectedRev: dossier.rev,
            reason: 'Erreur de saisie',
          }),
        ),
      ).code,
    ).toBe(BankCaseError.REJECTION_REASON_REQUIRED);

    // Retour en instruction avec un montant : refusé aussi.
    expect(
      bodyOf(
        await refusal(() =>
          service.correct(admin, dossier.id, {
            targetStageId: STAGE_EN_TRAITEMENT.id,
            expectedRev: dossier.rev,
            amountXof: '100',
            reason: 'Erreur de saisie',
          }),
        ),
      ).code,
    ).toBe(BankCaseError.AMOUNT_NOT_ALLOWED);
  });

  it('la correction reste soumise à la garde de révision', async () => {
    const dossier = await encaisser('REF-COR3');
    const error = await refusal(() =>
      service.correct(admin, dossier.id, {
        targetStageId: STAGE_A_TRAITER.id,
        expectedRev: 1,
        reason: 'Réouverture',
      }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.REV_CONFLICT);
  });

  it('la correction peut ramener un dossier terminal en arrière, ce que la transition interdit', async () => {
    const dossier = await encaisser('REF-COR4');
    const detail = await service.correct(admin, dossier.id, {
      targetStageId: STAGE_A_TRAITER.id,
      expectedRev: dossier.rev,
      reason: 'Dossier rouvert à la demande de la banque',
    });

    expect(detail.bankCase.currentStage.code).toBe('A_TRAITER');
    expect(detail.bankCase.isTerminal).toBe(false);
    // Le montant est effacé : une étape ouverte ne porte pas de montant.
    expect(detail.bankCase.amountXof).toBeNull();
  });

  it('la correction refuse une étape désactivée', async () => {
    const dossier = await encaisser('REF-COR5');
    const gele = db.stages.find((row) => row.id === STAGE_EN_TRAITEMENT.id);
    if (!gele) throw new Error('fixture absente');
    gele.isActive = false;

    const error = await refusal(() =>
      service.correct(admin, dossier.id, {
        targetStageId: STAGE_EN_TRAITEMENT.id,
        expectedRev: dossier.rev,
        reason: 'Réouverture',
      }),
    );
    expect(bodyOf(error).code).toBe(BankCaseError.STAGE_INACTIVE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Divers
// ─────────────────────────────────────────────────────────────────────────────

describe('lectures', () => {
  it('un dossier inconnu est un 404 typé', async () => {
    const error = await refusal(() => service.get('case-fantome'));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(bodyOf(error).code).toBe(BankCaseError.NOT_FOUND);
  });

  it('les motifs de rejet désactivés ne sortent que sur demande explicite', async () => {
    const actifs = await service.listRejectionReasons(false);
    expect(actifs.items.map((item) => item.code)).toEqual(['DOSSIER_INCOMPLET', 'AUTRE']);

    const tous = await service.listRejectionReasons(true);
    expect(tous.items.map((item) => item.code)).toContain('RETIRE');
  });
});

/**
 * L'autocomplétion lit son terme dans `search`, comme toutes les autres
 * recherches libres du contrat. Le SQL est vérifié en intégration ; ce qui se
 * joue ici, c'est que le terme reçu arrive bien jusqu'à la requête, un
 * paramètre lu sous un autre nom donnerait une liste vide sans erreur.
 */
describe('autocomplétion prospect', () => {
  it('cherche sur le terme reçu dans « search »', async () => {
    const requetes: unknown[][] = [];
    const prisma = {
      $queryRaw: (...args: unknown[]) => {
        requetes.push(args);
        return Promise.resolve([]);
      },
    } as unknown as ReturnType<FakePrisma['asService']>;

    const isole = new BankCasesService(prisma, fakeDemoVisibility());
    await isole.prospectSearch({ search: 'Ndiaye' });

    const valeurs = requetes.flat().flatMap((sql) => (sql as { values?: unknown[] }).values ?? []);
    expect(valeurs).toContain('%ndiaye%');
  });
});
