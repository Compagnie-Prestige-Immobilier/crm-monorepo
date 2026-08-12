/**
 * Le jeu de démonstration est semé DEVANT UN AUDITOIRE. Une clé de référentiel
 * inexistante, un montant nul sur un encaissement ou un doublon de téléphone ne
 * se découvrent pas à ce moment-là : ces tests sont le filet.
 *
 * Ils vérifient deux familles de propriétés :
 *   · l'INTÉGRITÉ — chaque clé naturelle citée existe vraiment dans
 *     `seed-data/`, chaque clé locale pointe sur une entité du jeu ;
 *   · la COHÉRENCE MÉTIER — les invariants que la base pose en CHECK, plus la
 *     répartition annoncée en commentaire, recalculée ici pour que le
 *     commentaire ne puisse pas mentir.
 */
import type { BddSegment } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { BANK_REJECTION_REASONS, BANK_STAGES } from '../seed-data/bank-workflow.js';
import { BANQUES_SENEGAL } from '../seed-data/banques.js';
import { REGIONS_SENEGAL } from '../seed-data/geo.js';
import { SYNDICATS_SENEGAL } from '../seed-data/syndicats.js';
import { classifySegment } from '../segment.js';
import {
  DEMO_BANK_CASES,
  DEMO_CAMPAIGNS,
  DEMO_DATASET,
  DEMO_PASSWORD,
  DEMO_PROSPECTS,
  DEMO_REPRESENTANTS,
  DEMO_USERS,
} from './index.js';

const DEPARTEMENT_CODES = new Set(
  REGIONS_SENEGAL.flatMap((region) => region.departements.map((departement) => departement.code)),
);
const BANQUE_SHORT_NAMES = new Set(BANQUES_SENEGAL.map((banque) => banque.shortName));
const SYNDICAT_SIGLES = new Set(SYNDICATS_SENEGAL.map((syndicat) => syndicat.sigle));
const STAGE_CODES = new Set(BANK_STAGES.map((stage) => stage.code));
const REJECTION_CODES = new Set(BANK_REJECTION_REASONS.map((reason) => reason.code));

const USER_KEYS = new Set(DEMO_USERS.map((user) => user.key));
const REPRESENTANT_KEYS = new Set(DEMO_REPRESENTANTS.map((representant) => representant.key));
const PROSPECTS_BY_KEY = new Map(DEMO_PROSPECTS.map((prospect) => [prospect.key, prospect]));

const ALL_TASKS = DEMO_CAMPAIGNS.flatMap((campaign) => campaign.tasks);
const ALL_ATTEMPTS = ALL_TASKS.flatMap((task) => task.attempts);

describe('volumétrie', () => {
  it('expose les cinq collections du contrat', () => {
    expect(Object.keys(DEMO_DATASET).sort()).toEqual([
      'bankCases',
      'campaigns',
      'prospects',
      'representants',
      'users',
    ]);
  });

  it('tient dans les ordres de grandeur annoncés', () => {
    expect(DEMO_USERS).toHaveLength(6);
    expect(DEMO_REPRESENTANTS).toHaveLength(15);
    expect(DEMO_PROSPECTS).toHaveLength(120);
    expect(DEMO_CAMPAIGNS).toHaveLength(2);
    expect(DEMO_BANK_CASES).toHaveLength(20);
  });

  it('compose une équipe de 4 commerciaux, 1 banque-finance et 1 admin', () => {
    const byRole = new Map<string, number>();
    for (const user of DEMO_USERS) {
      byRole.set(user.role, (byRole.get(user.role) ?? 0) + 1);
    }
    expect(byRole.get('COMMERCIAL')).toBe(4);
    expect(byRole.get('BANQUE_FINANCE')).toBe(1);
    expect(byRole.get('ADMIN')).toBe(1);
  });
});

describe('clés naturelles — toutes présentes dans seed-data', () => {
  it('les départements des utilisateurs et des représentants existent', () => {
    for (const user of DEMO_USERS) {
      if (user.departementCode !== null) {
        expect(DEPARTEMENT_CODES, user.email).toContain(user.departementCode);
      }
    }
    for (const representant of DEMO_REPRESENTANTS) {
      expect(DEPARTEMENT_CODES, representant.fullName).toContain(representant.departementCode);
    }
  });

  it('les banques et syndicats des prospects existent', () => {
    for (const prospect of DEMO_PROSPECTS) {
      expect(BANQUE_SHORT_NAMES, prospect.key).toContain(prospect.banqueShortName);
      expect(SYNDICAT_SIGLES, prospect.key).toContain(prospect.syndicatSigle);
    }
  });

  it('les banques, étapes et motifs de rejet des dossiers existent', () => {
    for (const bankCase of DEMO_BANK_CASES) {
      expect(BANQUE_SHORT_NAMES, bankCase.key).toContain(bankCase.processingBankShortName);
      expect(STAGE_CODES, bankCase.key).toContain(bankCase.currentStageCode);

      if (bankCase.rejectionReasonCode !== null) {
        expect(REJECTION_CODES, bankCase.key).toContain(bankCase.rejectionReasonCode);
      }

      for (const step of bankCase.transitions) {
        expect(STAGE_CODES, bankCase.key).toContain(step.toStageCode);
        if (step.fromStageCode !== null) {
          expect(STAGE_CODES, bankCase.key).toContain(step.fromStageCode);
        }
        if (step.rejectionReasonCode !== null) {
          expect(REJECTION_CODES, bankCase.key).toContain(step.rejectionReasonCode);
        }
      }
    }
  });
});

describe('clés locales — aucune référence pendante', () => {
  it('les représentants pointent sur un commercial du jeu', () => {
    for (const representant of DEMO_REPRESENTANTS) {
      expect(USER_KEYS, representant.key).toContain(representant.createdByKey);
    }
  });

  it('les prospects pointent sur un représentant et un utilisateur du jeu', () => {
    for (const prospect of DEMO_PROSPECTS) {
      expect(REPRESENTANT_KEYS, prospect.key).toContain(prospect.representantKey);
      expect(USER_KEYS, prospect.key).toContain(prospect.createdByKey);
    }
  });

  it('les campagnes, tâches et tentatives pointent sur des entités du jeu', () => {
    for (const campaign of DEMO_CAMPAIGNS) {
      expect(USER_KEYS).toContain(campaign.createdByKey);
      for (const key of campaign.commerciauxKeys) {
        expect(USER_KEYS).toContain(key);
      }
      for (const task of campaign.tasks) {
        expect(PROSPECTS_BY_KEY.has(task.prospectKey), task.key).toBe(true);
        expect(campaign.commerciauxKeys, task.key).toContain(task.assignedToKey);
        for (const one of task.attempts) {
          expect(one.prospectKey).toBe(task.prospectKey);
          expect(USER_KEYS, one.key).toContain(one.performedByKey);
        }
      }
    }
  });

  it('les dossiers bancaires pointent sur un prospect et des utilisateurs du jeu', () => {
    for (const bankCase of DEMO_BANK_CASES) {
      expect(PROSPECTS_BY_KEY.has(bankCase.prospectKey), bankCase.key).toBe(true);
      expect(USER_KEYS, bankCase.key).toContain(bankCase.createdByKey);
      if (bankCase.updatedByKey !== null) {
        expect(USER_KEYS, bankCase.key).toContain(bankCase.updatedByKey);
      }
      for (const step of bankCase.transitions) {
        expect(USER_KEYS, bankCase.key).toContain(step.performedByKey);
      }
    }
  });
});

describe('segments BDD — la répartition annoncée est la répartition réelle', () => {
  const counts: Record<BddSegment, number> = { BDD1: 0, BDD2: 0, BDD3: 0, BDD4: 0 };
  for (const prospect of DEMO_PROSPECTS) {
    counts[
      classifySegment({
        syndicatSigle: prospect.syndicatSigle,
        banqueShortName: prospect.banqueShortName,
      })
    ] += 1;
  }

  it('recalcule 42 / 24 / 30 / 24, soit 35 % / 20 % / 25 % / 20 %', () => {
    expect(counts).toEqual({ BDD1: 42, BDD2: 24, BDD3: 30, BDD4: 24 });
    expect(counts.BDD1 + counts.BDD2 + counts.BDD3 + counts.BDD4).toBe(DEMO_PROSPECTS.length);
  });

  it('reste dans un point de pourcentage des proportions documentées', () => {
    const share = (n: number): number => Math.round((n / DEMO_PROSPECTS.length) * 100);
    expect(share(counts.BDD1)).toBe(35);
    expect(share(counts.BDD2)).toBe(20);
    expect(share(counts.BDD3)).toBe(25);
    expect(share(counts.BDD4)).toBe(20);
  });

  it('la campagne de scope BDD1 ne cible que des prospects de BDD1', () => {
    for (const campaign of DEMO_CAMPAIGNS) {
      if (campaign.scope === 'ALL') continue;
      for (const task of campaign.tasks) {
        const prospect = PROSPECTS_BY_KEY.get(task.prospectKey);
        expect(prospect, task.prospectKey).toBeDefined();
        if (!prospect) continue;
        expect(
          classifySegment({
            syndicatSigle: prospect.syndicatSigle,
            banqueShortName: prospect.banqueShortName,
          }),
          task.key,
        ).toBe(campaign.scope);
      }
    }
  });
});

describe('phase 2 — méthode et statut ne peuvent pas se contredire', () => {
  it('la méthode est présente si et seulement si le statut est METHOD_OBTAINED', () => {
    for (const prospect of DEMO_PROSPECTS) {
      if (prospect.phase2Status === 'METHOD_OBTAINED') {
        expect(prospect.enrollmentMethod, prospect.key).not.toBeNull();
        expect(prospect.enrollmentDaysAgo, prospect.key).not.toBeNull();
      } else {
        expect(prospect.enrollmentMethod, prospect.key).toBeNull();
        expect(prospect.enrollmentDaysAgo, prospect.key).toBeNull();
      }
    }
  });

  it('la capture de méthode est postérieure à la saisie du prospect', () => {
    for (const prospect of DEMO_PROSPECTS) {
      if (prospect.enrollmentDaysAgo === null) continue;
      expect(prospect.enrollmentDaysAgo, prospect.key).toBeGreaterThan(0);
      expect(prospect.enrollmentDaysAgo, prospect.key).toBeLessThanOrEqual(prospect.daysAgo);
    }
  });

  it('respecte la répartition documentée des statuts et des trois méthodes', () => {
    const byStatus = new Map<string, number>();
    const byMethod = new Map<string, number>();
    for (const prospect of DEMO_PROSPECTS) {
      byStatus.set(prospect.phase2Status, (byStatus.get(prospect.phase2Status) ?? 0) + 1);
      if (prospect.enrollmentMethod !== null) {
        byMethod.set(prospect.enrollmentMethod, (byMethod.get(prospect.enrollmentMethod) ?? 0) + 1);
      }
    }

    expect(byStatus.get('PENDING')).toBe(60);
    expect(byStatus.get('METHOD_OBTAINED')).toBe(40);
    expect(byStatus.get('REFUSED')).toBe(12);
    expect(byStatus.get('WRONG_NUMBER')).toBe(8);

    expect(byMethod.get('PLATFORM')).toBe(18);
    expect(byMethod.get('PHYSICAL')).toBe(14);
    expect(byMethod.get('VOICE_OR_ELECTRONIC_MESSAGING')).toBe(8);
  });

  it('le prospect est saisi après son représentant', () => {
    const representantDays = new Map(
      DEMO_REPRESENTANTS.map((representant) => [representant.key, representant.daysAgo]),
    );
    for (const prospect of DEMO_PROSPECTS) {
      const introduced = representantDays.get(prospect.representantKey) ?? 0;
      expect(prospect.daysAgo, prospect.key).toBeLessThan(introduced);
    }
  });
});

describe('téléphones', () => {
  const SENEGAL_MOBILE = /^\+2217[0678]\d{7}$/;

  it('sont tous au format mobile sénégalais', () => {
    for (const user of DEMO_USERS) {
      expect(user.phoneE164, user.email).toMatch(SENEGAL_MOBILE);
    }
    for (const representant of DEMO_REPRESENTANTS) {
      expect(representant.phoneE164, representant.fullName).toMatch(SENEGAL_MOBILE);
    }
    for (const prospect of DEMO_PROSPECTS) {
      expect(prospect.phoneE164, prospect.key).toMatch(SENEGAL_MOBILE);
    }
  });

  it('sont uniques toutes entités confondues — le numéro est la clé de dédoublonnage', () => {
    const phones = [
      ...DEMO_USERS.map((user) => user.phoneE164),
      ...DEMO_REPRESENTANTS.map((representant) => representant.phoneE164),
      ...DEMO_PROSPECTS.map((prospect) => prospect.phoneE164),
    ];
    expect(new Set(phones).size).toBe(phones.length);
  });
});

describe('identités et clés locales uniques', () => {
  it('les clés, e-mails et identifiants de connexion ne se répètent pas', () => {
    const keys = [
      ...DEMO_USERS.map((user) => user.key),
      ...DEMO_REPRESENTANTS.map((representant) => representant.key),
      ...DEMO_PROSPECTS.map((prospect) => prospect.key),
      ...DEMO_CAMPAIGNS.map((campaign) => campaign.key),
      ...DEMO_BANK_CASES.map((bankCase) => bankCase.key),
      ...ALL_TASKS.map((task) => task.key),
      ...ALL_ATTEMPTS.map((one) => one.key),
    ];
    expect(new Set(keys).size).toBe(keys.length);

    const emails = DEMO_USERS.map((user) => user.email);
    expect(new Set(emails).size).toBe(emails.length);
    const usernames = DEMO_USERS.map((user) => user.username);
    expect(new Set(usernames).size).toBe(usernames.length);
  });

  it('les comptes sont visiblement des comptes de démonstration', () => {
    for (const user of DEMO_USERS) {
      expect(user.email).toMatch(/^demo\.[a-z]+@cpi\.sn$/);
      expect(user.password).toBe(DEMO_PASSWORD);
    }
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(12);
  });

  it('les références bancaires sont uniques une fois normalisées', () => {
    const keys = DEMO_BANK_CASES.map((bankCase) => bankCase.reference.trim().toUpperCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('campagnes et tentatives', () => {
  it('une seule tâche ACTIVE par prospect', () => {
    const active = ALL_TASKS.filter((task) => task.isActive).map((task) => task.prospectKey);
    expect(new Set(active).size).toBe(active.length);
  });

  it('isActive suit le statut, et une tâche terminée porte sa date', () => {
    for (const task of ALL_TASKS) {
      expect(task.isActive, task.key).toBe(task.status === 'OPEN');
      if (task.status === 'DONE') {
        expect(task.completedDaysAgo, task.key).not.toBeNull();
        expect(task.attempts.length, task.key).toBeGreaterThan(0);
      } else {
        expect(task.completedDaysAgo, task.key).toBeNull();
      }
    }
  });

  it('la position est unique par (campagne, commercial) et démarre à 1', () => {
    for (const campaign of DEMO_CAMPAIGNS) {
      const seen = new Set<string>();
      const prospects = new Set<string>();
      for (const task of campaign.tasks) {
        expect(task.position, task.key).toBeGreaterThanOrEqual(1);
        const slot = `${task.assignedToKey}#${String(task.position)}`;
        expect(seen.has(slot), slot).toBe(false);
        seen.add(slot);
        expect(prospects.has(task.prospectKey), task.prospectKey).toBe(false);
        prospects.add(task.prospectKey);
      }
    }
  });

  it('une tentative OTHER porte toujours un commentaire non vide', () => {
    const others = ALL_ATTEMPTS.filter((one) => one.outcome === 'OTHER');
    expect(others.length).toBeGreaterThan(0);
    for (const one of others) {
      expect(one.comment, one.key).not.toBeNull();
      expect((one.comment ?? '').trim().length, one.key).toBeGreaterThan(0);
    }
  });

  it('la méthode accompagne METHOD_OBTAINED et rien d’autre', () => {
    for (const one of ALL_ATTEMPTS) {
      if (one.outcome === 'METHOD_OBTAINED') {
        expect(one.method, one.key).not.toBeNull();
      } else {
        expect(one.method, one.key).toBeNull();
      }
    }
  });

  it('couvre les six issues possibles', () => {
    const outcomes = new Set(ALL_ATTEMPTS.map((one) => one.outcome));
    expect([...outcomes].sort()).toEqual([
      'CALLBACK',
      'METHOD_OBTAINED',
      'OTHER',
      'REFUSED',
      'UNREACHABLE',
      'WRONG_NUMBER',
    ]);
  });

  it('une issue terminale correspond au statut du prospect', () => {
    for (const one of ALL_ATTEMPTS) {
      const prospect = PROSPECTS_BY_KEY.get(one.prospectKey);
      expect(prospect, one.prospectKey).toBeDefined();
      if (!prospect) continue;

      if (one.outcome === 'METHOD_OBTAINED') {
        expect(prospect.phase2Status, one.key).toBe('METHOD_OBTAINED');
        expect(prospect.enrollmentMethod, one.key).toBe(one.method);
        expect(prospect.enrollmentDaysAgo, one.key).toBe(one.daysAgo);
      } else if (one.outcome === 'REFUSED') {
        expect(prospect.phase2Status, one.key).toBe('REFUSED');
      } else if (one.outcome === 'WRONG_NUMBER') {
        expect(prospect.phase2Status, one.key).toBe('WRONG_NUMBER');
      }
    }
  });

  it('les tentatives tombent entre la création et la clôture de leur campagne', () => {
    for (const campaign of DEMO_CAMPAIGNS) {
      for (const task of campaign.tasks) {
        for (const one of task.attempts) {
          expect(one.daysAgo, one.key).toBeLessThan(campaign.daysAgo);
          if (campaign.closedDaysAgo !== null) {
            expect(one.daysAgo, one.key).toBeGreaterThanOrEqual(campaign.closedDaysAgo);
          }
        }
      }
    }
  });

  it('propose une campagne ACTIVE avec des tâches ouvertes et une CLOSED entièrement traitée', () => {
    const active = DEMO_CAMPAIGNS.find((campaign) => campaign.status === 'ACTIVE');
    const closed = DEMO_CAMPAIGNS.find((campaign) => campaign.status === 'CLOSED');
    expect(active).toBeDefined();
    expect(closed).toBeDefined();
    expect(active?.closedDaysAgo).toBeNull();
    expect(closed?.closedDaysAgo).not.toBeNull();
    expect(active?.tasks.some((task) => task.status === 'OPEN')).toBe(true);
    expect(closed?.tasks.every((task) => task.status === 'DONE')).toBe(true);
  });
});

describe('dossiers bancaires', () => {
  it("n'existent que pour des prospects METHOD_OBTAINED, et après la capture", () => {
    for (const bankCase of DEMO_BANK_CASES) {
      const prospect = PROSPECTS_BY_KEY.get(bankCase.prospectKey);
      expect(prospect, bankCase.key).toBeDefined();
      if (!prospect) continue;
      expect(prospect.phase2Status, bankCase.key).toBe('METHOD_OBTAINED');
      expect(bankCase.daysAgo, bankCase.key).toBeLessThan(prospect.enrollmentDaysAgo ?? 0);
    }
  });

  it('couvrent les quatre étapes du workflow', () => {
    const byStage = new Map<string, number>();
    for (const bankCase of DEMO_BANK_CASES) {
      byStage.set(bankCase.currentStageCode, (byStage.get(bankCase.currentStageCode) ?? 0) + 1);
    }
    expect(byStage.get('A_TRAITER')).toBe(4);
    expect(byStage.get('EN_TRAITEMENT_BANQUE')).toBe(5);
    expect(byStage.get('ENCAISSE')).toBe(7);
    expect(byStage.get('REJETE')).toBe(4);
  });

  it('encaissé ⇒ montant strictement positif et aucun motif', () => {
    const cashed = DEMO_BANK_CASES.filter((one) => one.currentStageCode === 'ENCAISSE');
    expect(cashed.length).toBeGreaterThan(0);
    for (const bankCase of cashed) {
      expect(bankCase.amountXof, bankCase.key).toMatch(/^[1-9]\d*$/);
      expect(Number(bankCase.amountXof), bankCase.key).toBeGreaterThan(0);
      expect(bankCase.rejectionReasonCode, bankCase.key).toBeNull();
    }
  });

  it('rejeté ⇒ montant à zéro et motif obligatoire', () => {
    const rejected = DEMO_BANK_CASES.filter((one) => one.currentStageCode === 'REJETE');
    expect(rejected.length).toBeGreaterThan(0);
    for (const bankCase of rejected) {
      expect(bankCase.amountXof, bankCase.key).toBe('0');
      expect(bankCase.rejectionReasonCode, bankCase.key).not.toBeNull();
      if (bankCase.rejectionReasonCode === 'AUTRE') {
        expect(bankCase.rejectionDetail, bankCase.key).not.toBeNull();
      }
    }
  });

  it('ouvert ⇒ ni montant ni motif', () => {
    for (const bankCase of DEMO_BANK_CASES) {
      if (bankCase.currentStageCode === 'ENCAISSE' || bankCase.currentStageCode === 'REJETE') {
        continue;
      }
      expect(bankCase.amountXof, bankCase.key).toBeNull();
      expect(bankCase.rejectionReasonCode, bankCase.key).toBeNull();
    }
  });

  it('ont un historique chaîné qui aboutit à leur étape courante', () => {
    for (const bankCase of DEMO_BANK_CASES) {
      const [first, ...rest] = bankCase.transitions;
      expect(first, bankCase.key).toBeDefined();
      if (!first) continue;

      expect(first.fromStageCode, bankCase.key).toBeNull();
      expect(first.daysAgo, bankCase.key).toBe(bankCase.daysAgo);

      let previous = first;
      for (const step of rest) {
        expect(step.fromStageCode, bankCase.key).toBe(previous.toStageCode);
        // Les jours DÉCROISSENT : une transition plus récente est plus proche
        // d'aujourd'hui.
        expect(step.daysAgo, bankCase.key).toBeLessThan(previous.daysAgo);
        previous = step;
      }

      expect(previous.toStageCode, bankCase.key).toBe(bankCase.currentStageCode);
      expect(previous.amountXof, bankCase.key).toBe(bankCase.amountXof);
      expect(previous.rejectionReasonCode, bankCase.key).toBe(bankCase.rejectionReasonCode);
    }
  });

  it('les montants encaissés racontent la domination de la CBAO', () => {
    const total = (shortName: string | null): number =>
      DEMO_BANK_CASES.filter(
        (one) =>
          one.currentStageCode === 'ENCAISSE' &&
          (shortName === null || one.processingBankShortName === shortName),
      ).reduce((sum, one) => sum + Number(one.amountXof), 0);

    expect(total(null)).toBe(22_000_000);
    expect(total('CBAO')).toBe(12_000_000);
    expect(total('CBAO') * 2).toBeGreaterThan(total(null));
  });

  it('le motif « Document manquant » domine les rejets', () => {
    const byReason = new Map<string, number>();
    for (const bankCase of DEMO_BANK_CASES) {
      if (bankCase.rejectionReasonCode === null) continue;
      byReason.set(
        bankCase.rejectionReasonCode,
        (byReason.get(bankCase.rejectionReasonCode) ?? 0) + 1,
      );
    }
    const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(top?.[0]).toBe('DOCUMENT_MANQUANT');
  });
});
