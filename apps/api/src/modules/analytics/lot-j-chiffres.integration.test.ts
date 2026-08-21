process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  BankStageType,
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Phase2Status,
  PrismaClient,
  PrismaPg,
  Role,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';

const SEMAINE = '2026-03-02';
const jour = (numero: number, heure = 9): Date =>
  new Date(`2026-03-0${String(numero)}T0${String(heure)}:00:00.000Z`);

interface Decor {
  pilotage: PilotageService;
  portfolio: PortfolioService;
  quality: QualityService;
  campaignId: string;
  departementId: string;
  representantIds: [string, string];
}

let admin: AuthenticatedUser;

async function tableRase(tx: Prisma.TransactionClient): Promise<void> {
  await tx.repCallAttempt.deleteMany({});
  await tx.repCallTask.deleteMany({});
  await tx.repCallCampaignCommercial.deleteMany({});
  await tx.repCallCampaign.deleteMany({});
  await tx.callAttempt.deleteMany({});
  await tx.callTask.deleteMany({});
  await tx.callCampaignCommercial.deleteMany({});
  await tx.callCampaign.deleteMany({});
  await tx.clientCreationRequest.deleteMany({});
  await tx.bankCaseTransition.deleteMany({});
  await tx.bankCase.deleteMany({});
  await tx.prospect.deleteMany({});
  await tx.representant.deleteMany({});
}

async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const banque = await tx.banque.findFirstOrThrow({ select: { id: true } });
  const syndicat = await tx.syndicat.findFirstOrThrow({ select: { id: true } });

  const etapeOuverte = await tx.bankCaseStage.findFirstOrThrow({
    where: { type: BankStageType.OPEN },
    select: { id: true },
  });
  const etapeEncaissee = await tx.bankCaseStage.findFirstOrThrow({
    where: { type: BankStageType.CASHED },
    select: { id: true },
  });

  const commercial = await tx.user.findFirstOrThrow({
    where: { role: Role.ADMIN },
    select: { id: true },
  });

  const representants: string[] = [];
  for (const index of [1, 2]) {
    const row = await tx.representant.create({
      data: {
        id: uuidv7(),
        fullName: `Chiffres Rep ${String(index)}`,
        phoneE164: `+22177099300${String(index)}`,
        departementId: departement.id,
        createdById: commercial.id,
        clientCreatedAt: jour(1),
      },
      select: { id: true },
    });
    representants.push(row.id);
  }
  const [rep1, rep2] = representants as [string, string];

  const fiches: {
    nom: string;
    representantId: string;
    methode: boolean;
    ecartJours: number;
    origine: string | null;
  }[] = [
    { nom: 'P1', representantId: rep1, methode: true, ecartJours: 2, origine: 'BANQUE' },
    { nom: 'P2', representantId: rep1, methode: true, ecartJours: 4, origine: null },
    { nom: 'P3', representantId: rep1, methode: false, ecartJours: 0, origine: null },
    { nom: 'P4', representantId: rep2, methode: true, ecartJours: 6, origine: null },
    { nom: 'P5', representantId: rep2, methode: false, ecartJours: 0, origine: null },
  ];

  const prospectIds = new Map<string, string>();
  for (const [index, fiche] of fiches.entries()) {
    const id = uuidv7();
    await tx.prospect.create({
      data: {
        id,
        nom: `Chiffres-${fiche.nom}`,
        prenom: 'Test',
        phoneE164: `+2217709931${String(index).padStart(2, '0')}`,
        banqueId: banque.id,
        syndicatId: syndicat.id,
        representantId: fiche.representantId,
        createdById: commercial.id,
        clientCreatedAt: jour(3),
        ...(fiche.methode
          ? {
              phase2Status: Phase2Status.METHOD_OBTAINED,
              enrollmentMethod: EnrollmentMethod.PLATFORM,
              enrollmentCapturedAt: new Date(
                jour(3).getTime() + fiche.ecartJours * 24 * 3600 * 1000,
              ),
            }
          : {}),
        ...(fiche.origine === null
          ? {}
          : { origin: fiche.origine, originLabel: 'Banque partenaire' }),
      },
    });
    prospectIds.set(fiche.nom, id);
  }

  const dossiers: { fiche: string; etape: string; montant: number | null }[] = [
    { fiche: 'P1', etape: etapeEncaissee.id, montant: 1_000_000 },
    { fiche: 'P2', etape: etapeOuverte.id, montant: 750_000 },
    { fiche: 'P4', etape: etapeEncaissee.id, montant: 500_000 },
  ];

  for (const [index, dossier] of dossiers.entries()) {
    await tx.bankCase.create({
      data: {
        id: uuidv7(),
        reference: `CHIFFRES-${String(index)}`,
        referenceKey: `chiffres-${String(index)}`,
        prospectId: prospectIds.get(dossier.fiche) ?? '',
        customerName: `Client ${dossier.fiche}`,
        customerPhoneE164: '+221770993999',
        processingBankId: banque.id,
        currentStageId: dossier.etape,
        ...(dossier.montant === null ? {} : { amountXof: dossier.montant }),
        createdById: commercial.id,
      },
    });
  }

  const campagne = await tx.callCampaign.create({
    data: {
      id: uuidv7(),
      name: 'Chiffres',
      scope: CampaignScope.ALL,
      seed: 'c'.repeat(32),
      spreadDays: 1,
      status: CampaignStatus.ACTIVE,
      createdById: commercial.id,
    },
    select: { id: true },
  });

  const taches = new Map<string, string>();
  for (const [index, nom] of ['P1', 'P2', 'P3', 'P4'].entries()) {
    const id = uuidv7();
    await tx.callTask.create({
      data: {
        id,
        campaignId: campagne.id,
        prospectId: prospectIds.get(nom) ?? '',
        assignedToId: commercial.id,
        position: index + 1,
        dayIndex: 0,
        status: CallTaskStatus.OPEN,
      },
    });
    taches.set(nom, id);
  }

  const tentatives: { fiche: string; issue: CallOutcome; methode?: EnrollmentMethod }[] = [
    { fiche: 'P1', issue: CallOutcome.METHOD_OBTAINED, methode: EnrollmentMethod.PLATFORM },
    { fiche: 'P1', issue: CallOutcome.UNREACHABLE },
    { fiche: 'P2', issue: CallOutcome.CALLBACK },
  ];

  for (const tentative of tentatives) {
    await tx.callAttempt.create({
      data: {
        id: uuidv7(),
        prospectId: prospectIds.get(tentative.fiche) ?? '',
        taskId: taches.get(tentative.fiche) ?? null,
        campaignId: campagne.id,
        performedById: commercial.id,
        outcome: tentative.issue,
        ...(tentative.methode === undefined ? {} : { method: tentative.methode }),
        clientCreatedAt: jour(4),
      },
    });
  }

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return {
    pilotage: new PilotageService(client),
    portfolio: new PortfolioService(client),
    quality: new QualityService(client),
    campaignId: campagne.id,
    departementId: departement.id,
    representantIds: [rep1, rep2],
  };
}

async function surLeJeu<T>(run: (decor: Decor) => Promise<T>): Promise<T> {
  const boite: { valeur?: T } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
        await tableRase(tx);
        boite.valeur = await run(await semer(tx));
        throw new Error(ROLLBACK);
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);

  if (erreur !== ROLLBACK) throw new Error(`jeu interrompu : ${String(erreur)}`);
  if (!('valeur' in boite)) throw new Error('aucun résultat');
  return boite.valeur;
}

beforeAll(async () => {
  const compte = await prisma.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null },
    select: { id: true, email: true, username: true },
  });
  if (!compte) throw new Error('aucun administrateur : lancer pnpm db:seed');
  admin = {
    id: compte.id,
    email: compte.email,
    username: compte.username,
    fullName: compte.username,
    role: Role.ADMIN,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('les huit agrégats rendent LE BON CHIFFRE', () => {
  it('campaign-pilotage : 4 tâches, 2 touchées, 50 % de contact', async () => {
    const resultat = await surLeJeu(({ pilotage, campaignId }) =>
      pilotage.campaignPilotage(admin, { campaignId }),
    );

    expect(resultat.tasks).toBe(4);
    expect(resultat.tasksContacted).toBe(2);
    expect(resultat.contactRate).toBe(50);

    expect(resultat.attempts).toBe(3);
    expect(resultat.reachableAttempts).toBe(2);
    expect(resultat.reachRate).toBe(66.7);
  });

  it('delays : médiane de 4 jours sur un échantillon de 3', async () => {
    const resultat = await surLeJeu(({ pilotage }) => pilotage.delays(admin, {}));

    const saisieVersMethode = resultat.legs[0];
    expect(saisieVersMethode?.sample).toBe(3);
    expect(saisieVersMethode?.medianDays).toBe(4);

    expect(resultat.legs[2]?.sample).toBe(0);
    expect(resultat.legs[2]?.medianDays).toBeNull();
  });

  it('bank-aging : 1 seul dossier en cours, les encaissés sont sortis', async () => {
    const resultat = await surLeJeu(({ portfolio }) => portfolio.bankAging(admin, {}));

    expect(resultat.total).toBe(1);
    expect(resultat.buckets[0]?.label).toBe('0 à 7 jours');
    expect(resultat.buckets[0]?.dossiers).toBe(1);
    expect(resultat.buckets.reduce((somme, tranche) => somme + tranche.dossiers, 0)).toBe(1);
    expect(resultat.stages).toHaveLength(1);
    expect(resultat.stages[0]?.dossiers).toBe(1);
  });

  it('weekly-cohorts : une semaine, 5 fiches, 1 500 000 XOF encaissés', async () => {
    const resultat = await surLeJeu(({ portfolio }) => portfolio.weeklyCohorts(admin, {}));

    expect(resultat.items).toHaveLength(1);
    const semaine = resultat.items[0];
    expect(semaine?.week).toBe(SEMAINE);
    expect(semaine?.prospects).toBe(5);
    expect(semaine?.methodObtained).toBe(3);
    expect(semaine?.cases).toBe(3);
    expect(semaine?.cashed).toBe(2);
    expect(semaine?.cashedAmountXof).toBe('1500000');
    expect(semaine?.conversionRate).toBe(40);
    expect(resultat.total).toBe(5);
  });

  it('departement-yield : 5 fiches, 3 méthodes, 60 % de taux de méthode', async () => {
    const resultat = await surLeJeu(({ portfolio }) => portfolio.departementYield(admin, {}));

    expect(resultat.items).toHaveLength(1);
    const ligne = resultat.items[0];
    expect(ligne?.prospects).toBe(5);
    expect(ligne?.methodObtained).toBe(3);
    expect(ligne?.cases).toBe(3);
    expect(ligne?.cashed).toBe(2);
    expect(ligne?.cashedAmountXof).toBe('1500000');
    expect(ligne?.methodRate).toBe(60);
    expect(resultat.total).toBe(5);
  });

  it('representant-productivity : 66,7 % pour R1, 50 % pour R2', async () => {
    const resultat = await surLeJeu(({ quality }) =>
      quality.representantProductivity(admin, { limit: 10 }),
    );

    expect(resultat.items).toHaveLength(2);
    const troisFiches = resultat.items.find((ligne) => ligne.prospects === 3);
    const deuxFiches = resultat.items.find((ligne) => ligne.prospects === 2);

    expect(troisFiches?.methodObtained).toBe(2);
    expect(troisFiches?.conversionRate).toBe(66.7);
    expect(deuxFiches?.methodObtained).toBe(1);
    expect(deuxFiches?.conversionRate).toBe(50);
    expect(resultat.total).toBe(5);
  });

  it('data-quality : 3 tentatives, 1 injoignable, 33,3 %', async () => {
    const resultat = await surLeJeu(({ quality }) => quality.dataQuality(admin, {}));

    expect(resultat.attempts).toBe(3);
    const parDepartement = resultat.departements[0];
    expect(parDepartement?.attempts).toBe(3);
    expect(parDepartement?.unreachable).toBe(1);
    expect(parDepartement?.wrongNumber).toBe(0);
    expect(parDepartement?.badRate).toBe(33.3);

    expect(resultat.representants.reduce((somme, ligne) => somme + ligne.attempts, 0)).toBe(3);
  });

  it('origin-breakdown : 1 fiche BANQUE, 4 sans provenance', async () => {
    const resultat = await surLeJeu(({ quality }) => quality.originBreakdown(admin, {}));

    expect(resultat.total).toBe(5);

    const parOrigine = new Map(resultat.items.map((ligne) => [ligne.origin, ligne.prospects]));
    expect(parOrigine.get('BANQUE')).toBe(1);
    expect(parOrigine.get(null)).toBe(4);

    expect(resultat.byLabel.reduce((somme, ligne) => somme + ligne.prospects, 0)).toBe(5);
  });
});
