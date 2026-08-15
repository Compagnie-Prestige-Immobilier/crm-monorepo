/**
 * Les huit agrégats du tableau de bord, sur un jeu de données CONNU.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE `lot-j.integration.test.ts` NE PEUT PAS DIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La suite voisine exécute les huit requêtes contre PostgreSQL et vérifie
 * qu'elles rendent une charge utile bien formée. C'est un contrôle de SYNTAXE,
 * et elle le dit elle-même : « aucune assertion ne porte sur une VALEUR ».
 * Elle se termine d'ailleurs sur huit `resolves.toBeDefined()`, qui sont vrais
 * de toute fonction qui rend un objet, y compris d'une fonction qui rendrait
 * systématiquement des zéros.
 *
 * Les épreuves unitaires, elles, comparent des SOUS-CHAÎNES de SQL
 * (`expect(sql()).toContain('ct."isDemo" = FALSE')`). C'est de l'implémentation,
 * pas du comportement : réécrire la même condition autrement les met au rouge
 * sans qu'aucun chiffre n'ait bougé, et inverser un `FILTER` les laisse vertes.
 *
 * Entre les deux, personne ne vérifie les FORMULES. C'est ce que fait ce
 * fichier : un jeu minuscule, calculé à la main, et UNE valeur numérique exacte
 * par agrégat.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ISOLATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces agrégats lisent TOUTE la base. Un chiffre absolu n'a donc de sens que si
 * la base ne contient rien d'autre. Tout se passe ici dans une transaction
 * ANNULÉE : on y efface les données métier, on sème le jeu, on interroge les
 * services à travers le client de cette transaction, et le `ROLLBACK` final
 * rend la base intacte aux autres suites.
 */
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
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';

/** Lundi. `date_trunc('week')` de PostgreSQL cale sur le lundi ISO. */
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

/**
 * Efface les données métier, dans l'ordre des clés étrangères.
 *
 * Les référentiels (départements, banques, syndicats, étapes) sont CONSERVÉS :
 * le jeu s'appuie dessus, et les recréer n'apporterait rien.
 */
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

/**
 * LE JEU, écrit une fois et calculé à la main.
 *
 * Cinq prospects, tous saisis la même semaine ISO (lundi 2026-03-02) :
 *
 *   fiche  représentant  méthode obtenue  dossier      encaissé  montant
 *   ─────  ────────────  ───────────────  ───────────  ────────  ─────────
 *   P1     R1            oui              oui          OUI       1 000 000
 *   P2     R1            oui              oui (ouvert) non       ...
 *   P3     R1            non              non          non       ...
 *   P4     R2            oui              oui          OUI         500 000
 *   P5     R2            non              non          non       ...
 *
 * D'où, pour la semaine : 5 prospects, 3 méthodes, 3 dossiers, 2 encaissés,
 * 1 500 000 XOF.
 *
 * Campagne d'appels sur P1 à P4 : quatre tâches, deux d'entre elles ayant reçu
 * une tentative. Trois tentatives au total, dont UNE injoignable.
 */
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

  /**
   * `enrollmentCapturedAt` porte le premier tronçon des délais : saisie ➜
   * méthode obtenue. Les écarts valent 2, 4 et 6 jours, dont la MÉDIANE vaut
   * exactement 4.
   */
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
        // Mardi 3 mars : dans la MÊME semaine ISO que le lundi 2 mars.
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

  // ── Dossiers bancaires : deux encaissés, un ouvert ────────────────────────
  const dossiers: { fiche: string; etape: string; montant: number | null }[] = [
    { fiche: 'P1', etape: etapeEncaissee.id, montant: 1_000_000 },
    // Le dossier OUVERT porte lui aussi un montant, et c'est délibéré : s'il
    // était nul, une somme qui oublierait de filtrer sur l'étape encaissée
    // rendrait quand même le bon total, et l'assertion ne prouverait rien.
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

  // ── Campagne d'appels : 4 tâches, 2 contactées, 3 tentatives dont 1 injoignable
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

  // Deux tâches touchées (P1 deux fois, P2 une fois), deux jamais appelées.
  // `call_attempts_method_matches_outcome` exige une méthode SUR l'issue
  // METHOD_OBTAINED, et l'interdit ailleurs : la contrainte fait partie du jeu.
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
    pilotage: new PilotageService(client, fakeDemoVisibility()),
    portfolio: new PortfolioService(client, fakeDemoVisibility()),
    quality: new QualityService(client, fakeDemoVisibility()),
    campaignId: campagne.id,
    departementId: departement.id,
    representantIds: [rep1, rep2],
  };
}

/** Sème le jeu, exécute `run`, puis ANNULE tout. */
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
  /**
   * 1. Pilotage de campagne. Quatre tâches, deux touchées : 50 %.
   *
   * `contactRate` compte les TÂCHES touchées, pas les tentatives. P1 en a reçu
   * deux : la compter deux fois donnerait 75 %, ce qu'un `COUNT(*)` sur les
   * tentatives produirait naturellement.
   */
  it('campaign-pilotage : 4 tâches, 2 touchées, 50 % de contact', async () => {
    const resultat = await surLeJeu(({ pilotage, campaignId }) =>
      pilotage.campaignPilotage(admin, { campaignId }),
    );

    expect(resultat.tasks).toBe(4);
    expect(resultat.tasksContacted).toBe(2);
    expect(resultat.contactRate).toBe(50);

    // Trois tentatives, une injoignable : deux joignables, soit 66,7 %.
    expect(resultat.attempts).toBe(3);
    expect(resultat.reachableAttempts).toBe(2);
    expect(resultat.reachRate).toBe(66.7);
  });

  /**
   * 2. Délais. Trois fiches franchissent le tronçon saisie ➜ méthode, avec des
   * écarts de 2, 4 et 6 jours. La médiane vaut 4, et l'échantillon 3 : les deux
   * fiches sans méthode ne comptent pas, elles n'ont pas franchi le tronçon.
   */
  it('delays : médiane de 4 jours sur un échantillon de 3', async () => {
    const resultat = await surLeJeu(({ pilotage }) => pilotage.delays(admin, {}));

    const saisieVersMethode = resultat.legs[0];
    expect(saisieVersMethode?.sample).toBe(3);
    expect(saisieVersMethode?.medianDays).toBe(4);

    // Le dernier tronçon (ouverture ➜ encaissement) n'a AUCUNE transition :
    // il rend null, et surtout pas 0.
    expect(resultat.legs[2]?.sample).toBe(0);
    expect(resultat.legs[2]?.medianDays).toBeNull();
  });

  /**
   * 3. Vieillissement bancaire. Seuls les dossiers stationnant à une étape NON
   * TERMINALE entrent : les deux encaissés sont sortis du portefeuille, il
   * reste le seul dossier ouvert.
   */
  it('bank-aging : 1 seul dossier en cours, les encaissés sont sortis', async () => {
    const resultat = await surLeJeu(({ portfolio }) => portfolio.bankAging(admin, {}));

    expect(resultat.total).toBe(1);
    // Ouvert à l'instant : première tranche, « 0 à 7 jours ».
    expect(resultat.buckets[0]?.label).toBe('0 à 7 jours');
    expect(resultat.buckets[0]?.dossiers).toBe(1);
    // Le dossier est compté UNE fois, dans UNE seule tranche.
    expect(resultat.buckets.reduce((somme, tranche) => somme + tranche.dossiers, 0)).toBe(1);
    // Et il stationne à l'étape ouverte, la seule qui doit paraître.
    expect(resultat.stages).toHaveLength(1);
    expect(resultat.stages[0]?.dossiers).toBe(1);
  });

  /**
   * 4. Cohortes hebdomadaires. Les cinq fiches sont saisies le même mardi,
   * donc dans la même semaine ISO. Le montant est une CHAÎNE : 1 000 000 et
   * 500 000 font 1 500 000.
   */
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
    // 2 encaissés sur 5 fiches.
    expect(semaine?.conversionRate).toBe(40);
    expect(resultat.total).toBe(5);
  });

  /**
   * 5. Rendement par département. Les deux représentants sont rattachés au même
   * département : une seule ligne, qui porte les cinq fiches.
   *
   * Le point de contrôle : P1 et P2 sont TOUS DEUX porteurs d'un dossier, et P1
   * en a un encaissé. Compter les dossiers par jointure ferait peser une fiche
   * autant de fois qu'elle a de dossiers.
   */
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

  /**
   * 6. Productivité des représentants. R1 apporte 3 fiches dont 2 avec méthode
   * (66,7 %), R2 en apporte 2 dont 1 (50 %).
   *
   * Un dénominateur pris sur la population entière donnerait 40 % et 20 %, ce
   * qui se lit comme deux représentants médiocres au lieu d'un bon et d'un
   * moyen.
   */
  it('representant-productivity : 66,7 % pour R1, 50 % pour R2', async () => {
    const resultat = await surLeJeu(({ quality }) =>
      quality.representantProductivity(admin, { limit: 10 }),
    );

    // Les identifiants sont engendrés à chaque exécution : les deux lignes se
    // distinguent par leur VOLUME, qui est précisément ce que l'épreuve porte.
    expect(resultat.items).toHaveLength(2);
    const troisFiches = resultat.items.find((ligne) => ligne.prospects === 3);
    const deuxFiches = resultat.items.find((ligne) => ligne.prospects === 2);

    expect(troisFiches?.methodObtained).toBe(2);
    expect(troisFiches?.conversionRate).toBe(66.7);
    expect(deuxFiches?.methodObtained).toBe(1);
    expect(deuxFiches?.conversionRate).toBe(50);
    // Le total porte sur TOUTE la population, pas sur le haut de classement.
    expect(resultat.total).toBe(5);
  });

  /**
   * 7. Qualité de la donnée. Trois tentatives, une injoignable, aucun faux
   * numéro : 33,3 % de tentatives perdues.
   */
  it('data-quality : 3 tentatives, 1 injoignable, 33,3 %', async () => {
    const resultat = await surLeJeu(({ quality }) => quality.dataQuality(admin, {}));

    expect(resultat.attempts).toBe(3);
    const parDepartement = resultat.departements[0];
    expect(parDepartement?.attempts).toBe(3);
    expect(parDepartement?.unreachable).toBe(1);
    expect(parDepartement?.wrongNumber).toBe(0);
    expect(parDepartement?.badRate).toBe(33.3);

    // Les deux axes partitionnent la MÊME population de tentatives.
    expect(resultat.representants.reduce((somme, ligne) => somme + ligne.attempts, 0)).toBe(3);
  });

  /**
   * 8. Répartition par provenance. Une seule fiche vient d'une banque, les
   * quatre autres sont des saisies terrain sans provenance.
   */
  it('origin-breakdown : 1 fiche BANQUE, 4 sans provenance', async () => {
    const resultat = await surLeJeu(({ quality }) => quality.originBreakdown(admin, {}));

    expect(resultat.total).toBe(5);

    const parOrigine = new Map(resultat.items.map((ligne) => [ligne.origin, ligne.prospects]));
    expect(parOrigine.get('BANQUE')).toBe(1);
    expect(parOrigine.get(null)).toBe(4);

    // Le second niveau partitionne EXACTEMENT le premier.
    expect(resultat.byLabel.reduce((somme, ligne) => somme + ligne.prospects, 0)).toBe(5);
  });
});
