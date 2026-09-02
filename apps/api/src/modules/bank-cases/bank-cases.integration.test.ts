process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  EnrollmentMethod,
  PrismaClient,
  PrismaPg,
  Phase2Status,
  Projet,
  Role,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BankCasesService, sansAccents } from './bank-cases.service.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BankCaseStagesService } from './bank-case-stages.service.js';
import { BankCaseError } from './errors.js';
import { BankCaseSortField } from './dto.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const service = new BankCasesService(prisma);
const analytics = new BankCaseAnalyticsService(prisma);
const stages = new BankCaseStagesService(prisma);

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

async function cleanupData(): Promise<void> {
  await prisma.bankCaseTransition.deleteMany({
    where: { case: { referenceKey: { startsWith: TAG } } },
  });
  await prisma.bankCase.deleteMany({ where: { referenceKey: { startsWith: TAG } } });
  await prisma.prospect.deleteMany({ where: { nom: { startsWith: TAG } } });
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.bankCaseStage.deleteMany({ where: { code: { startsWith: TAG } } });
}

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

beforeEach(async () => {
  await cleanupData();

  let representant = await prisma.representant.findFirst({ where: { deletedAt: null } });
  if (!representant) {
    const departement = await prisma.departement.findFirstOrThrow();
    representant = await prisma.representant.create({
      data: {
        id: uuidv7(),
        fullName: `${TAG} Représentant fixture`,
        phoneE164: '+221770000001',
        departementId: departement.id,
        createdById: admin.id,
        clientCreatedAt: new Date('2026-07-01T08:00:00.000Z'),
      },
    });
  }
  const syndicat = await prisma.syndicat.findFirstOrThrow();
  const modele = await prisma.prospect.create({
    data: {
      id: uuidv7(),
      nom: `${TAG} Modèle`,
      prenom: 'Fixture',
      phoneE164: '+221770000000',
      banqueId: banqueA,
      syndicatId: syndicat.id,
      representantId: representant.id,
      createdById: admin.id,
      clientCreatedAt: new Date('2026-07-01T08:00:00.000Z'),
    },
  });

  const base = {
    banqueId: banqueA,
    syndicatId: modele.syndicatId,
    representantId: representant.id,
    createdById: admin.id,
    phase2Status: Phase2Status.METHOD_OBTAINED,
    enrollmentMethod: EnrollmentMethod.PLATFORM,
    enrollmentCapturedAt: new Date('2026-07-15T10:00:00.000Z'),
    enrollmentCapturedById: admin.id,
    clientCreatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

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

describe('unicité de la référence, arbitrée par la base', () => {
  it('la contrainte tranche deux créations SIMULTANÉES, et le perdant reçoit un 409 typé', async () => {
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
    expect((await service.list({ search: 'aissatou' })).meta.total).toBeGreaterThanOrEqual(2);
    expect((await service.list({ search: '770000003' })).meta.total).toBe(1);
    expect((await service.list({ search: '77 123 45 67' })).meta.total).toBe(2);
  });

  it('un chiffre isolé dans une référence ne devient PAS un joker sur les téléphones', async () => {
    const page = await service.list({ search: `${TAG}-L3` });
    expect(page.meta.total).toBe(1);
    expect(page.items[0]?.reference).toBe(`${TAG}-L3`);

    const avecUn3 = await prisma.bankCase.count({
      where: { referenceKey: { startsWith: TAG }, customerPhoneE164: { contains: '3' } },
    });
    expect(avecUn3).toBeGreaterThan(1);
  });

  it('filtre par étape, par type d’étape et par banque', async () => {
    expect((await service.list({ ...mine, stageId: stageEncaisse })).meta.total).toBe(1);
    expect((await service.list({ ...mine, stageType: 'CASHED' })).meta.total).toBe(1);
    expect((await service.list({ ...mine, stageType: 'OPEN' })).meta.total).toBe(2);
    expect((await service.list({ ...mine, banqueId: banqueB })).meta.total).toBe(1);
  });

  it('filtre par agent, créateur OU dernier intervenant', async () => {
    expect((await service.list({ ...mine, agentId: agent.id })).meta.total).toBe(4);
    expect((await service.list({ ...mine, agentId: admin.id })).meta.total).toBe(0);
  });

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

describe('les KPI sont les agrégats de la MÊME liste filtrée', () => {
  beforeEach(async () => {
    await scenario(`${TAG}-K1`, 0, 'open');
    await scenario(`${TAG}-K2`, 1, 'processing');
    await scenario(`${TAG}-K3`, 2, 'cashed', { amountXof: '1500000', bankId: banqueB });
    await scenario(`${TAG}-K4`, 0, 'cashed', { amountXof: '2500000' });
    await scenario(`${TAG}-K5`, 1, 'rejected');
  });

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
      const siennes = liste.items.filter((row) => row.processingBankId === banque.banqueId);
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

describe('autocomplétion des prospects', () => {
  it('retrouve un nom accentué écrit SANS accents, et l’inverse', async () => {
    expect((await service.prospectSearch({ search: 'Aissatou' })).items).toHaveLength(1);
    expect((await service.prospectSearch({ search: 'aïssatou' })).items).toHaveLength(1);
    expect((await service.prospectSearch({ search: 'AISSATOU' })).items).toHaveLength(1);
    expect((await service.prospectSearch({ search: `${TAG}Ndiaye` })).items).toHaveLength(1);
    expect((await service.prospectSearch({ search: `Aissatou ${TAG}Ndiaye` })).items).toHaveLength(
      1,
    );
  });

  it('ne propose que les fiches du projet demandé', async () => {
    expect(
      (await service.prospectSearch({ search: 'Aissatou', projet: Projet.CHUES })).items,
    ).toHaveLength(1);
    expect(
      (await service.prospectSearch({ search: 'Aissatou', projet: Projet.GRAND_PUBLIC })).items,
    ).toHaveLength(0);
  });

  it('retrouve le MÊME abonné sous quatre écritures du numéro', async () => {
    for (const saisie of ['+221771234567', '221771234567', '77 123 45 67', '77-123-45-67']) {
      const trouve = await service.prospectSearch({ search: saisie });
      expect(
        trouve.items.map((row) => row.phoneE164),
        saisie,
      ).toContain('+221771234567');
    }
  });

  it('ne propose QUE des prospects enrôlés : un dossier ne s’ouvre pas ailleurs', async () => {
    const tous = await service.prospectSearch({ search: TAG, pageSize: 50 });
    expect(tous.items).toHaveLength(3);
    expect(tous.items.map((row) => row.nom)).not.toContain(`${TAG}Fall`);
  });

  it('ne renvoie que l’identité, le téléphone et la banque courante', async () => {
    const item = (await service.prospectSearch({ search: `${TAG}Ndiaye` })).items[0];
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
    expect((await service.prospectSearch({ search: `${TAG}Ndiaye` })).items).toHaveLength(0);
  });
});

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

describe('sûreté du workflow, en base', () => {
  it('une étape qui porte des dossiers n’est pas désactivable', async () => {
    const nouvelle = await stages.create({
      code: `${TAG}_CONTROLE`,
      label: 'Contrôle intégration',
      color: 'info',
    });
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

    const suivante = await prisma.bankCaseStage.findFirstOrThrow({
      where: { type: 'OPEN', isActive: true, position: { gt: initiale?.position ?? 1 } },
      orderBy: { position: 'asc' },
    });
    expect(suivante.id).toBe(nouvelle.id);

    await stages.reorder({ stageIds: [initiale?.id ?? '', ...autres] });
  });
});

describe('le désaccentuage de l’application suit celui de PostgreSQL', () => {
  /// Le motif est désaccentué en JavaScript pour que le tableau reste une
  /// CONSTANTE : passé par une sous-requête SQL, le planificateur perd l'index
  /// et retombe en balayage séquentiel. Les deux dictionnaires doivent donc
  /// s'accorder sur les accents que portent réellement les noms d'ici.
  it('rend le même résultat que `immutable_unaccent` sur les accents du terrain', async () => {
    const echantillon = [
      'Aïssatou',
      'Ndèye',
      'Fatoumata Binta Diallo',
      'Émile',
      'Gaëlle',
      'Cheikhoù',
      'François',
      'Maïmouna',
      'Sénégal',
      'Thiès',
      'Kaolack',
      'Ôsmane',
      'Ûmar',
    ];

    for (const mot of echantillon) {
      const lignes = await prisma.$queryRaw<{ attendu: string }[]>`
        SELECT immutable_unaccent(lower(${mot})) AS attendu
      `;
      expect(sansAccents(mot.toLowerCase())).toBe(lignes[0]?.attendu);
    }
  });
});
