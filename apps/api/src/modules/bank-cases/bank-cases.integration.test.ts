/**
 * Banque & Finance contre un VRAI PostgreSQL.
 *
 * Les suites unitaires du module éprouvent les règles ; celle-ci éprouve ce
 * qu'aucune doublure ne peut démontrer :
 *
 *  - que la liste, les agrégats et l'export décrivent RÉELLEMENT le même
 *    ensemble, puisque c'est le SQL lui-même qui est en jeu ;
 *  - que la contrainte d'unicité arbitre bien deux créations simultanées, et
 *    que le P2002 qui en résulte ressort en 409 typé ;
 *  - que la recherche de prospects retrouve un nom accentué et un numéro écrit
 *    de quatre façons, ce qui dépend de `unaccent` et de la normalisation
 *    téléphonique, non du code applicatif seul.
 *
 * Lancée par `pnpm test:integration`, jamais par `pnpm test` : elle exige la
 * base de développement sur localhost:5434.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { EnrollmentMethod, PrismaClient, PrismaPg, Phase2Status, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BankCasesService } from './bank-cases.service.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BankCaseStagesService } from './bank-case-stages.service.js';
import { BankCaseError } from './errors.js';
import { BankCaseSortField } from './dto.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const service = new BankCasesService(prisma as unknown as PrismaService, fakeDemoVisibility());
const analytics = new BankCaseAnalyticsService(
  prisma as unknown as PrismaService,
  fakeDemoVisibility(),
);
const stages = new BankCaseStagesService(prisma as unknown as PrismaService);

/** Préfixe unique : la base est partagée, on ne touche QUE nos propres lignes. */
const TAG = 'ITBC';

interface ErrorBody {
  code?: string;
  existing?: { id: string };
  currentRev?: number;
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

let agent: AuthenticatedUser;
let admin: AuthenticatedUser;
let stageATraiter: string;
let stageEnTraitement: string;
let stageEncaisse: string;
let stageRejete: string;
let reasonId: string;
let reasonAutreId: string;
let banqueA: string;
let banqueB: string;
let prospects: string[] = [];

/**
 * Efface les données d'un test, et rien d'autre : la base est partagée avec le
 * reste du dépôt et tout est préfixé par `TAG`.
 *
 * L'ORDRE suit les clés étrangères en `Restrict` — transitions, dossiers,
 * prospects, étapes. Un `deleteMany` dans le désordre échouerait sur une
 * contrainte au lieu de nettoyer.
 */
async function cleanupData(): Promise<void> {
  await prisma.bankCaseTransition.deleteMany({
    where: { case: { referenceKey: { startsWith: TAG } } },
  });
  await prisma.bankCase.deleteMany({ where: { referenceKey: { startsWith: TAG } } });
  await prisma.prospect.deleteMany({ where: { nom: { startsWith: TAG } } });
  await prisma.bankCaseStage.deleteMany({ where: { code: { startsWith: TAG } } });
}

/**
 * Nettoyage complet, l'agent compris. Réservé aux bornes de la SUITE : appelé
 * entre deux tests, il supprimerait l'utilisateur créé par `beforeAll` et toute
 * création ultérieure échouerait sur `bank_cases_createdById_fkey`.
 */
async function cleanupAll(): Promise<void> {
  await cleanupData();
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanupAll();

  const [a, b] = await prisma.banque.findMany({ orderBy: { shortName: 'asc' }, take: 2 });
  if (!a || !b) throw new Error('référentiel banques vide : lancer pnpm db:seed');
  banqueA = a.id;
  banqueB = b.id;

  const found = await prisma.bankCaseStage.findMany();
  const byCode = new Map(found.map((row) => [row.code, row.id]));
  stageATraiter = byCode.get('A_TRAITER') ?? '';
  stageEnTraitement = byCode.get('EN_TRAITEMENT_BANQUE') ?? '';
  stageEncaisse = byCode.get('ENCAISSE') ?? '';
  stageRejete = byCode.get('REJETE') ?? '';
  if (!stageATraiter || !stageEncaisse) throw new Error('workflow bancaire non semé');

  const reasons = await prisma.bankRejectionReason.findMany({ orderBy: { sortOrder: 'asc' } });
  reasonId = reasons.find((row) => row.code !== 'AUTRE')?.id ?? '';
  reasonAutreId = reasons.find((row) => row.code === 'AUTRE')?.id ?? '';

  // L'agent Banque & Finance n'existe pas dans le jeu de départ : on le crée.
  const agentRow = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}.agent@cpi.sn`,
      username: `${TAG.toLowerCase()}_agent`,
      fullName: 'Agent Banque Intégration',
      passwordHash: 'x'.repeat(20),
      role: Role.BANQUE_FINANCE,
    },
  });
  const adminRow = await prisma.user.findFirstOrThrow({ where: { role: Role.ADMIN } });

  agent = {
    id: agentRow.id,
    email: agentRow.email,
    username: agentRow.username,
    fullName: agentRow.fullName,
    role: Role.BANQUE_FINANCE,
  };
  admin = {
    id: adminRow.id,
    email: adminRow.email,
    username: adminRow.username,
    fullName: adminRow.fullName,
    role: Role.ADMIN,
  };
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

/**
 * Quatre prospects enrôlés, dont deux dont l'identité sert aux tests
 * d'autocomplétion (accents, et un numéro écrit de plusieurs manières).
 */
beforeEach(async () => {
  await cleanupData();

  const representant = await prisma.representant.findFirst({ where: { deletedAt: null } });
  const modele = await prisma.prospect.findFirstOrThrow({ where: { deletedAt: null } });

  // La base impose `enrollmentMethod IS NOT NULL` exactement quand
  // `phase2Status = METHOD_OBTAINED` : la contrainte `prospects_enrollment_
  // method_matches_status` refuse toute autre combinaison.
  const base = {
    banqueId: banqueA,
    syndicatId: modele.syndicatId,
    representantId: representant?.id ?? modele.representantId,
    createdById: admin.id,
    phase2Status: Phase2Status.METHOD_OBTAINED,
    enrollmentMethod: EnrollmentMethod.PLATFORM,
    enrollmentCapturedAt: new Date('2026-07-15T10:00:00.000Z'),
    enrollmentCapturedById: admin.id,
    clientCreatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  // L'identifiant d'un prospect est produit par le CLIENT (saisie hors ligne),
  // jamais par la base : il faut donc le fournir explicitement.
  const created = await Promise.all([
    prisma.prospect.create({
      data: {
        ...base,
        id: uuidv7(),
        nom: `${TAG}Ndiaye`,
        prenom: 'Aïssatou',
        phoneE164: '+221771234567',
      },
    }),
    prisma.prospect.create({
      data: {
        ...base,
        id: uuidv7(),
        nom: `${TAG}Sarr`,
        prenom: 'Modou',
        phoneE164: '+221770000002',
      },
    }),
    prisma.prospect.create({
      data: {
        ...base,
        id: uuidv7(),
        nom: `${TAG}Ba`,
        prenom: 'Fatou',
        phoneE164: '+221770000003',
        banqueId: banqueB,
      },
    }),
    prisma.prospect.create({
      data: {
        ...base,
        id: uuidv7(),
        nom: `${TAG}Fall`,
        prenom: 'Ibrahima',
        phoneE164: '+221770000004',
        phase2Status: Phase2Status.PENDING,
        enrollmentMethod: null,
        enrollmentCapturedAt: null,
        enrollmentCapturedById: null,
      },
    }),
  ]);
  prospects = created.map((row) => row.id);
});

/** Ouvre un dossier et le mène jusqu'à l'étape demandée. */
async function scenario(
  reference: string,
  prospectIndex: number,
  target: 'open' | 'processing' | 'cashed' | 'rejected',
  options: { amountXof?: string; bankId?: string } = {},
): Promise<string> {
  const created = await service.create(agent, {
    prospectId: prospects[prospectIndex] ?? '',
    reference,
    ...(options.bankId === undefined ? {} : { processingBankId: options.bankId }),
  });
  if (target === 'open') return created.id;

  const enCours = await service.transition(agent, created.id, {
    targetStageId: stageEnTraitement,
    expectedRev: created.rev,
  });
  if (target === 'processing') return created.id;

  if (target === 'cashed') {
    await service.transition(agent, created.id, {
      targetStageId: stageEncaisse,
      expectedRev: enCours.bankCase.rev,
      amountXof: options.amountXof ?? '1000000',
    });
    return created.id;
  }

  await service.transition(agent, created.id, {
    targetStageId: stageRejete,
    expectedRev: enCours.bankCase.rev,
    rejectionReasonId: reasonId,
  });
  return created.id;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('unicité de la référence, arbitrée par la base', () => {
  it('la contrainte tranche deux créations SIMULTANÉES, et le perdant reçoit un 409 typé', async () => {
    // Lancées ensemble : le pré-contrôle des deux appels s'exécute avant que
    // l'un ou l'autre n'ait inséré. Seule la contrainte PostgreSQL peut
    // départager, et c'est exactement la course que le rattrapage P2002 existe
    // pour rendre lisible.
    const resultats = await Promise.allSettled([
      service.create(agent, { prospectId: prospects[0] ?? '', reference: `${TAG}-RACE-1` }),
      service.create(agent, { prospectId: prospects[1] ?? '', reference: `${TAG}-race-1` }),
    ]);

    const gagnants = resultats.filter((row) => row.status === 'fulfilled');
    const perdants = resultats.filter((row) => row.status === 'rejected');
    expect(gagnants).toHaveLength(1);
    expect(perdants).toHaveLength(1);

    const erreur = (perdants[0] as PromiseRejectedResult).reason as unknown;
    expect(bodyOf(erreur).code).toBe(BankCaseError.REFERENCE_CONFLICT);
    // Le corps DÉSIGNE le dossier gagnant, jamais un message nu.
    expect(bodyOf(erreur).existing?.id).toBeDefined();

    const enBase = await prisma.bankCase.count({ where: { referenceKey: `${TAG}-RACE-1` } });
    expect(enBase).toBe(1);
  });

  it('la casse ne crée pas deux dossiers, même en passant par la base', async () => {
    await service.create(agent, { prospectId: prospects[0] ?? '', reference: `${TAG}-Case-A` });
    const erreur = await refusal(() =>
      service.create(agent, { prospectId: prospects[1] ?? '', reference: `${TAG}-CASE-a` }),
    );
    expect(bodyOf(erreur).code).toBe(BankCaseError.REFERENCE_CONFLICT);
  });
});

describe('immuabilité de l’identité, vérifiée après relecture en base', () => {
  it('modifier le prospect ne réécrit pas ce qui a été transmis à la banque', async () => {
    const id = await scenario(`${TAG}-IMM`, 0, 'open');

    await prisma.prospect.update({
      where: { id: prospects[0] ?? '' },
      data: { nom: `${TAG}Corrige`, prenom: 'Aissatou', phoneE164: '+221778889900' },
    });

    const relu = await service.get(id);
    expect(relu.bankCase.customerName).toBe(`Aïssatou ${TAG}Ndiaye`);
    expect(relu.bankCase.customerPhoneE164).toBe('+221771234567');
  });
});

describe('liste et filtres, en SQL', () => {
  beforeEach(async () => {
    await scenario(`${TAG}-L1`, 0, 'open');
    await scenario(`${TAG}-L2`, 1, 'processing');
    await scenario(`${TAG}-L3`, 2, 'cashed', { amountXof: '1500000', bankId: banqueB });
    await scenario(`${TAG}-L4`, 0, 'rejected');
  });

  const mine = { search: TAG };

  it('rend les dossiers du filtre, paginés', async () => {
    const page = await service.list({ ...mine, pageSize: 2 });
    expect(page.meta.total).toBe(4);
    expect(page.meta.pageCount).toBe(2);
    expect(page.items).toHaveLength(2);
  });

  it('la recherche libre porte sur la référence, le nom et le téléphone', async () => {
    expect((await service.list({ search: `${TAG}-L3` })).meta.total).toBe(1);
    // Nom du client, accents et casse indifférents.
    expect((await service.list({ search: 'aissatou' })).meta.total).toBeGreaterThanOrEqual(2);
    // Téléphone en saisie partielle.
    expect((await service.list({ search: '770000003' })).meta.total).toBe(1);
    expect((await service.list({ search: '77 123 45 67' })).meta.total).toBe(2);
  });

  /**
   * NON-RÉGRESSION. Une référence alphanumérique laisse un résidu de chiffres :
   * « ITBC-L3 » se réduit à « 3 ». Tant que le seuil du filtre téléphonique
   * était d'un seul chiffre, cette recherche joignait TOUS les numéros contenant
   * un 3 et rendait trois dossiers là où l'agent en cherchait un.
   */
  it('un chiffre isolé dans une référence ne devient PAS un joker sur les téléphones', async () => {
    const page = await service.list({ search: `${TAG}-L3` });
    expect(page.meta.total).toBe(1);
    expect(page.items[0]?.reference).toBe(`${TAG}-L3`);

    // Contrôle : les numéros du jeu contiennent bien un « 3 », donc l'ancien
    // comportement aurait effectivement ramené plusieurs lignes.
    const avecUn3 = await prisma.bankCase.count({
      where: { referenceKey: { startsWith: TAG }, customerPhoneE164: { contains: '3' } },
    });
    expect(avecUn3).toBeGreaterThan(1);
  });

  it('filtre par étape, par type d’étape et par banque', async () => {
    expect((await service.list({ ...mine, stageId: stageEncaisse })).meta.total).toBe(1);
    expect((await service.list({ ...mine, stageType: 'CASHED' })).meta.total).toBe(1);
    expect((await service.list({ ...mine, stageType: 'OPEN' })).meta.total).toBe(2);
    expect((await service.list({ ...mine, bankId: banqueB })).meta.total).toBe(1);
  });

  it('filtre par agent, créateur OU dernier intervenant', async () => {
    expect((await service.list({ ...mine, agentId: agent.id })).meta.total).toBe(4);
    expect((await service.list({ ...mine, agentId: admin.id })).meta.total).toBe(0);
  });

  /**
   * Un dossier ouvert a un montant NULL, et NULL n'est ni supérieur ni
   * inférieur à une borne : le filtre de montant ne peut donc jamais le retenir.
   */
  it('le filtre de montant exclut les dossiers sans montant', async () => {
    const page = await service.list({ ...mine, amountMin: '1' });
    expect(page.meta.total).toBe(1);
    expect(page.items[0]?.reference).toBe(`${TAG}-L3`);

    expect((await service.list({ ...mine, amountMin: '2000000' })).meta.total).toBe(0);
    expect((await service.list({ ...mine, amountMax: '1500000' })).meta.total).toBe(2);
  });

  it('trie sur les colonnes annoncées', async () => {
    const parReference = await service.list({
      ...mine,
      sortBy: BankCaseSortField.REFERENCE,
      sortOrder: SortOrder.ASC,
    });
    expect(parReference.items.map((row) => row.reference)).toEqual([
      `${TAG}-L1`,
      `${TAG}-L2`,
      `${TAG}-L3`,
      `${TAG}-L4`,
    ]);
  });

  it('un dossier supprimé logiquement disparaît de la liste', async () => {
    const cible = await prisma.bankCase.findFirstOrThrow({ where: { reference: `${TAG}-L1` } });
    await prisma.bankCase.update({ where: { id: cible.id }, data: { deletedAt: new Date() } });
    expect((await service.list(mine)).meta.total).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('les KPI sont les agrégats de la MÊME liste filtrée', () => {
  beforeEach(async () => {
    await scenario(`${TAG}-K1`, 0, 'open');
    await scenario(`${TAG}-K2`, 1, 'processing');
    await scenario(`${TAG}-K3`, 2, 'cashed', { amountXof: '1500000', bankId: banqueB });
    await scenario(`${TAG}-K4`, 0, 'cashed', { amountXof: '2500000' });
    await scenario(`${TAG}-K5`, 1, 'rejected');
  });

  /**
   * LA propriété qui justifie que le filtre n'ait qu'une seule définition : un
   * compteur affiché doit être exactement le décompte du tableau en dessous.
   * On la vérifie en RECOMPTANT depuis la liste, sans jamais réutiliser le SQL
   * des agrégats.
   */
  it('total, répartition et somme encaissée coïncident avec la liste', async () => {
    const filtre = { search: TAG };
    const liste = await service.list({ ...filtre, pageSize: 200 });
    const totaux = await analytics.totals(filtre);

    expect(totaux.total).toBe(liste.meta.total);
    expect(totaux.total).toBe(liste.items.length);

    const compte = (predicat: (row: (typeof liste.items)[number]) => boolean): number =>
      liste.items.filter(predicat).length;

    expect(totaux.aTraiter).toBe(compte((row) => row.currentStage.isInitial));
    expect(totaux.enTraitement).toBe(
      compte((row) => row.currentStage.type === 'OPEN' && !row.currentStage.isInitial),
    );
    expect(totaux.encaisses).toBe(compte((row) => row.currentStage.type === 'CASHED'));
    expect(totaux.rejetes).toBe(compte((row) => row.currentStage.type === 'REJECTED'));

    const somme = liste.items
      .filter((row) => row.currentStage.type === 'CASHED')
      .reduce((total, row) => total + BigInt(row.amountXof ?? '0'), 0n);
    expect(totaux.totalAmountCashed).toBe(somme.toString());

    // Le taux de rejet se rapporte aux dossiers CLOS, pas au total : rapporté au
    // total, il baisserait à chaque nouveau dossier ouvert.
    expect(totaux.rejectionRate).toBeCloseTo(
      (totaux.rejetes / (totaux.encaisses + totaux.rejetes)) * 100,
      1,
    );
  });

  it('la répartition par étape recompose exactement la liste', async () => {
    const filtre = { search: TAG };
    const liste = await service.list({ ...filtre, pageSize: 200 });
    const parEtape = await analytics.byStage(filtre);

    const attendu = new Map<string, number>();
    for (const row of liste.items) {
      attendu.set(row.currentStage.id, (attendu.get(row.currentStage.id) ?? 0) + 1);
    }

    expect(parEtape.reduce((total, row) => total + row.cases, 0)).toBe(liste.meta.total);
    for (const row of parEtape) expect(row.cases).toBe(attendu.get(row.stageId));
    expect(parEtape.reduce((total, row) => total + row.share, 0)).toBeCloseTo(100, 0);
  });

  it('la répartition par banque recompose exactement la liste, montants compris', async () => {
    const filtre = { search: TAG };
    const liste = await service.list({ ...filtre, pageSize: 200 });
    const parBanque = await analytics.byBank(filtre);

    expect(parBanque.reduce((total, row) => total + row.cases, 0)).toBe(liste.meta.total);
    for (const banque of parBanque) {
      const siennes = liste.items.filter((row) => row.processingBankId === banque.bankId);
      expect(banque.cases).toBe(siennes.length);
      const somme = siennes
        .filter((row) => row.currentStage.type === 'CASHED')
        .reduce((total, row) => total + BigInt(row.amountXof ?? '0'), 0n);
      expect(banque.amountXof).toBe(somme.toString());
    }
  });

  it('un filtre RESTREINT restreint les KPI de la même façon', async () => {
    const filtre = { search: TAG, stageType: 'CASHED' as const };
    const liste = await service.list({ ...filtre, pageSize: 200 });
    const totaux = await analytics.totals(filtre);

    expect(totaux.total).toBe(liste.meta.total);
    expect(totaux.total).toBe(2);
    expect(totaux.encaisses).toBe(2);
    expect(totaux.rejetes).toBe(0);
    expect(totaux.totalAmountCashed).toBe('4000000');
  });

  it('l’activité par agent distingue ce qui est ouvert de ce qui est fait avancer', async () => {
    const parAgent = await analytics.byAgent({ search: TAG });
    const ligne = parAgent.find((row) => row.agentId === agent.id);

    expect(ligne?.created).toBe(5);
    expect(ligne?.cashed).toBe(2);
    expect(ligne?.amountXof).toBe('4000000');
    expect(ligne?.transitions).toBeGreaterThan(ligne?.created ?? 0);
  });

  it('les encaissements datés dans le temps somment au total encaissé', async () => {
    const filtre = { search: TAG };
    const seaux = await analytics.cashingsOverTime(filtre);
    const totaux = await analytics.totals(filtre);

    const somme = seaux.reduce((total, row) => total + BigInt(row.amountXof), 0n);
    expect(somme.toString()).toBe(totaux.totalAmountCashed);
    expect(seaux.reduce((total, row) => total + row.cases, 0)).toBe(totaux.encaisses);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('autocomplétion des prospects', () => {
  it('retrouve un nom accentué écrit SANS accents, et l’inverse', async () => {
    expect((await service.prospectSearch({ q: 'Aissatou' })).items).toHaveLength(1);
    expect((await service.prospectSearch({ q: 'aïssatou' })).items).toHaveLength(1);
    expect((await service.prospectSearch({ q: 'AISSATOU' })).items).toHaveLength(1);
    // Nom de famille seul, et ordre prénom/nom indifférent.
    expect((await service.prospectSearch({ q: `${TAG}Ndiaye` })).items).toHaveLength(1);
    expect((await service.prospectSearch({ q: `Aissatou ${TAG}Ndiaye` })).items).toHaveLength(1);
  });

  it('retrouve le MÊME abonné sous quatre écritures du numéro', async () => {
    for (const saisie of ['+221771234567', '221771234567', '77 123 45 67', '77-123-45-67']) {
      const trouve = await service.prospectSearch({ q: saisie });
      expect(
        trouve.items.map((row) => row.phoneE164),
        saisie,
      ).toContain('+221771234567');
    }
  });

  it('ne propose QUE des prospects enrôlés : un dossier ne s’ouvre pas ailleurs', async () => {
    const tous = await service.prospectSearch({ q: TAG, pageSize: 50 });
    expect(tous.items).toHaveLength(3);
    expect(tous.items.map((row) => row.nom)).not.toContain(`${TAG}Fall`);
  });

  /** La projection EST la mesure de confidentialité : rien d'autre n'est lu. */
  it('ne renvoie que l’identité, le téléphone et la banque courante', async () => {
    const item = (await service.prospectSearch({ q: `${TAG}Ndiaye` })).items[0];
    expect(Object.keys(item ?? {}).sort()).toEqual([
      'banqueId',
      'banqueName',
      'fullName',
      'id',
      'nom',
      'phoneE164',
      'prenom',
    ]);
  });

  it('un prospect supprimé disparaît de l’autocomplétion', async () => {
    await prisma.prospect.update({
      where: { id: prospects[0] ?? '' },
      data: { deletedAt: new Date() },
    });
    expect((await service.prospectSearch({ q: `${TAG}Ndiaye` })).items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('concurrence et verrou terminal, en base', () => {
  it('deux transitions simultanées : une seule passe, l’autre reçoit REV_CONFLICT', async () => {
    const created = await service.create(agent, {
      prospectId: prospects[0] ?? '',
      reference: `${TAG}-CC`,
    });

    const resultats = await Promise.allSettled([
      service.transition(agent, created.id, {
        targetStageId: stageEnTraitement,
        expectedRev: created.rev,
      }),
      service.transition(admin, created.id, {
        targetStageId: stageRejete,
        expectedRev: created.rev,
        rejectionReasonId: reasonId,
      }),
    ]);

    expect(resultats.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const perdu = resultats.find((row) => row.status === 'rejected') as PromiseRejectedResult;
    expect(bodyOf(perdu.reason).code).toBe(BankCaseError.REV_CONFLICT);
    expect(bodyOf(perdu.reason).currentRev).toBe(2);

    // Une transition écrite, une seule : le dossier n'a pas avancé deux fois.
    const historique = await prisma.bankCaseTransition.count({ where: { caseId: created.id } });
    expect(historique).toBe(2);
  });

  it('un dossier terminal est verrouillé, et la correction ADMIN écrit une trace auditée', async () => {
    const id = await scenario(`${TAG}-TERM`, 0, 'cashed', { amountXof: '900000' });
    const courant = await service.get(id);

    const erreur = await refusal(() =>
      service.transition(agent, id, {
        targetStageId: stageEnTraitement,
        expectedRev: courant.bankCase.rev,
      }),
    );
    expect(bodyOf(erreur).code).toBe(BankCaseError.TERMINAL);

    const corrige = await service.correct(admin, id, {
      targetStageId: stageRejete,
      expectedRev: courant.bankCase.rev,
      rejectionReasonId: reasonAutreId,
      rejectionDetail: 'Encaissement imputé au mauvais dossier',
      reason: 'Erreur de rapprochement bancaire',
    });

    expect(corrige.bankCase.currentStage.code).toBe('REJETE');
    expect(corrige.bankCase.amountXof).toBe('0');

    const enBase = await prisma.bankCaseTransition.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(enBase).toHaveLength(4);
    expect(enBase.at(-1)?.correctionReason).toBe('Erreur de rapprochement bancaire');
    expect(enBase.at(-1)?.performedById).toBe(admin.id);
    // L'encaissement corrigé reste inscrit : l'historique est append-only.
    expect(enBase.at(-2)?.amountXof?.toFixed(0)).toBe('900000');
  });

  it('le montant encaissé traverse la base en Decimal sans perte', async () => {
    const enorme = '123456789012345678';
    const id = await scenario(`${TAG}-BIG`, 0, 'cashed', { amountXof: enorme });
    const relu = await service.get(id);

    expect(relu.bankCase.amountXof).toBe(enorme);
    const totaux = await analytics.totals({ search: `${TAG}-BIG` });
    expect(totaux.totalAmountCashed).toBe(enorme);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sûreté du workflow, en base', () => {
  it('une étape qui porte des dossiers n’est pas désactivable', async () => {
    const nouvelle = await stages.create({
      code: `${TAG}_CONTROLE`,
      label: 'Contrôle intégration',
      color: 'info',
    });
    // On y place un dossier par correction ADMIN, seul moyen d'y arriver
    // directement depuis l'étape initiale.
    const created = await service.create(agent, {
      prospectId: prospects[0] ?? '',
      reference: `${TAG}-STG`,
    });
    await service.correct(admin, created.id, {
      targetStageId: nouvelle.id,
      expectedRev: created.rev,
      reason: 'Placement pour test de sûreté',
    });

    const erreur = await refusal(() => stages.setActive(nouvelle.id, { isActive: false }));
    expect(bodyOf(erreur).code).toBe(BankCaseError.STAGE_HAS_OPEN_CASES);

    // Une fois le dossier reparti, la désactivation passe.
    const courant = await service.get(created.id);
    await service.correct(admin, created.id, {
      targetStageId: stageATraiter,
      expectedRev: courant.bankCase.rev,
      reason: 'Retour à l’étape initiale',
    });
    expect((await stages.setActive(nouvelle.id, { isActive: false })).isActive).toBe(false);
  });

  it('les étapes système restent intouchables', async () => {
    for (const id of [stageATraiter, stageEncaisse, stageRejete]) {
      const erreur = await refusal(() => stages.setActive(id, { isActive: false }));
      expect(bodyOf(erreur).code).toBe(BankCaseError.STAGE_SYSTEM_IMMUTABLE);
    }
  });

  /**
   * Réordonner ne réécrit RIEN de l'historique : les transitions référencent les
   * étapes par identifiant. On le vérifie en comparant l'historique octet pour
   * octet avant et après un réordonnancement réel.
   */
  it('réordonner n’affecte que les transitions futures', async () => {
    const nouvelle = await stages.create({
      code: `${TAG}_VALIDATION`,
      label: 'Validation intégration',
      color: 'info',
    });
    const id = await scenario(`${TAG}-RO`, 0, 'processing');

    const avant = await prisma.bankCaseTransition.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
    });

    const ouvertes = await prisma.bankCaseStage.findMany({
      where: { type: 'OPEN' },
      orderBy: { position: 'asc' },
    });
    const initiale = ouvertes.find((row) => row.isInitial);
    const autres = ouvertes.filter((row) => !row.isInitial).map((row) => row.id);
    await stages.reorder({ stageIds: [initiale?.id ?? '', ...autres.toReversed()] });

    const apres = await prisma.bankCaseTransition.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(apres).toEqual(avant);

    // …mais l'étape suivante d'un NOUVEAU dossier a bien changé.
    const suivante = await prisma.bankCaseStage.findFirstOrThrow({
      where: { type: 'OPEN', isActive: true, position: { gt: initiale?.position ?? 1 } },
      orderBy: { position: 'asc' },
    });
    expect(suivante.id).toBe(nouvelle.id);

    // On remet le flux dans son ordre d'origine pour ne pas laisser la base
    // altérée pour les autres suites.
    await stages.reorder({ stageIds: [initiale?.id ?? '', ...autres] });
  });
});
