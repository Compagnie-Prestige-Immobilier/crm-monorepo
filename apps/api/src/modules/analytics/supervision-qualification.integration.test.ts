process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { PrismaClient, PrismaPg, Projet, RepCallOutcome, Role, type Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SupervisionActivityRowDto } from './supervision.dto.js';
import { SupervisionActivityService } from './supervision.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';

const FENETRE = { actFrom: '2026-03-01', actTo: '2026-03-31' };
const JOUR = '2026-03-02';
const heure = (h: number): Date => new Date(`${JOUR}T${String(h).padStart(2, '0')}:00:00.000Z`);

interface Decor {
  service: SupervisionActivityService;
  /** Pour tordre le jeu de données DANS la même transaction annulée. */
  tx: Prisma.TransactionClient;
  alice: string;
  bineta: string;
}

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

async function teleconseiller(tx: Prisma.TransactionClient, nom: string): Promise<string> {
  const row = await tx.user.create({
    data: {
      id: uuidv7(),
      email: `${nom}.qualif@test.local`,
      username: `${nom}-qualif`,
      passwordHash: 'x',
      fullName: nom,
      role: Role.COMMERCIAL,
    },
    select: { id: true },
  });
  return row.id;
}

async function fiche(
  tx: Prisma.TransactionClient,
  createdById: string,
  projet: Projet,
  rang: number,
): Promise<void> {
  const id = uuidv7();
  await tx.prospect.create({
    data: {
      id,
      nom: `Qualif-${projet}`,
      prenom: 'Test',
      phoneE164: `+22177099410${String(rang)}`,
      projet,
      createdById,
      clientCreatedAt: heure(9),
    },
  });
  await tx.prospectJourney.create({ data: { id: uuidv7(), prospectId: id, projet } });
}

/**
 * Alice appelle trois représentants ; Bineta rappelle le deuxième APRÈS elle et
 * obtient la réponse finale. Le WRONG_NUMBER est de l'héritage.
 */
async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const alice = await teleconseiller(tx, 'alice');
  const bineta = await teleconseiller(tx, 'bineta');

  const representants: string[] = [];
  for (const rang of [1, 2, 3]) {
    const row = await tx.representant.create({
      data: {
        id: uuidv7(),
        fullName: `Qualif Rep ${String(rang)}`,
        phoneE164: `+22177099420${String(rang)}`,
        departementId: departement.id,
        createdById: alice,
        clientCreatedAt: heure(8),
      },
      select: { id: true },
    });
    representants.push(row.id);
  }
  const [rep1, rep2, rep3] = representants as [string, string, string];

  const tentatives: [string, string, RepCallOutcome, number][] = [
    [alice, rep1, RepCallOutcome.REFUSED, 9],
    [alice, rep2, RepCallOutcome.REFUSED, 9],
    [alice, rep2, RepCallOutcome.CALLBACK, 10],
    [alice, rep3, RepCallOutcome.UNREACHABLE, 10],
    [alice, rep3, RepCallOutcome.WRONG_NUMBER, 11],
    [bineta, rep2, RepCallOutcome.REACHED, 12],
  ];

  for (const [performedById, representantId, outcome, h] of tentatives) {
    await tx.repCallAttempt.create({
      data: {
        id: uuidv7(),
        representantId,
        performedById,
        outcome,
        clientCreatedAt: heure(h),
        ...(outcome === RepCallOutcome.CALLBACK ? { callbackAt: heure(14) } : {}),
      },
    });
  }

  await fiche(tx, alice, Projet.CHUES, 1);
  await fiche(tx, alice, Projet.GRAND_PUBLIC, 2);

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return { service: new SupervisionActivityService(client), tx, alice, bineta };
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

afterAll(async () => {
  await prisma.$disconnect();
});

const de = (
  items: SupervisionActivityRowDto[],
  id: string,
): SupervisionActivityRowDto | undefined => items.find((ligne) => ligne.teleconseillerId === id);

describe('qualifier un représentant : les chiffres d’Alice', () => {
  it('4 appels retenus, 2 réponses, 50 % de contact, 25 % de rappel, 1 hérité', async () => {
    const ligne = await surLeJeu(async ({ service, alice }) => {
      const resultat = await service.activite(FENETRE);
      return de(resultat.items, alice);
    });

    expect(ligne?.bucket).toBe(JOUR);
    expect(ligne?.repCalls).toBe(4);
    expect(ligne?.repReached).toBe(2);
    expect(ligne?.repCallback).toBe(1);
    expect(ligne?.repUnreachable).toBe(1);
    expect(ligne?.repOther).toBe(1);
    expect(ligne?.repContactRate).toBe(50);
    expect(ligne?.repCallbackRate).toBe(25);
    expect(ligne?.representantsContacted).toBe(3);
  });

  it('le représentant revient à qui a obtenu la DERNIÈRE réponse', async () => {
    const [pourAlice, pourBineta] = await surLeJeu(async ({ service, alice, bineta }) => {
      const resultat = await service.activite(FENETRE);
      return [de(resultat.items, alice), de(resultat.items, bineta)];
    });

    expect(pourAlice?.repQuestioned).toBe(1);
    expect(pourAlice?.repQualified).toBe(0);
    expect(pourAlice?.repQualificationRate).toBe(0);

    expect(pourBineta?.repQuestioned).toBe(1);
    expect(pourBineta?.repQualified).toBe(1);
    expect(pourBineta?.repQualificationRate).toBe(100);
  });

  it('Grand Public : les colonnes représentants tombent à 0 et les taux à null', async () => {
    const ligne = await surLeJeu(async ({ service, alice }) => {
      const resultat = await service.activite({ ...FENETRE, projet: Projet.GRAND_PUBLIC });
      return de(resultat.items, alice);
    });

    expect(ligne?.prospectsCreated).toBe(1);
    expect(ligne?.repCalls).toBe(0);
    expect(ligne?.repReached).toBe(0);
    expect(ligne?.repOther).toBe(0);
    expect(ligne?.representantsContacted).toBe(0);
    expect(ligne?.repQuestioned).toBe(0);
    expect(ligne?.repContactRate).toBeNull();
    expect(ligne?.repCallbackRate).toBeNull();
    expect(ligne?.repQualificationRate).toBeNull();
  });

  it('CHUES : les représentants restent comptés, les fiches sont filtrées', async () => {
    const ligne = await surLeJeu(async ({ service, alice }) => {
      const resultat = await service.activite({ ...FENETRE, projet: Projet.CHUES });
      return de(resultat.items, alice);
    });

    expect(ligne?.prospectsCreated).toBe(1);
    expect(ligne?.repCalls).toBe(4);
    expect(ligne?.repQuestioned).toBe(1);
  });

  it('un seul téléconseiller demandé : l’autre disparaît des lignes', async () => {
    const resultat = await surLeJeu(({ service, alice }) =>
      service.activite({ ...FENETRE, commercialId: alice }),
    );

    expect(resultat.items).toHaveLength(1);
    expect(resultat.items[0]?.repCalls).toBe(4);
  });

  it('le total d’équipe compte le représentant UNE fois, pas une par agent', async () => {
    const { totals, lignes } = await surLeJeu(async ({ service }) => {
      const resultat = await service.activite(FENETRE);
      return { totals: resultat.totals, lignes: resultat.items };
    });

    const somme = (champ: 'repQuestioned' | 'repQualified'): number =>
      lignes.reduce((cumul, ligne) => cumul + ligne[champ], 0);

    expect(somme('repQuestioned')).toBe(2);
    expect(totals.repQuestioned).toBe(2);
    expect(totals.repQualified).toBe(1);
    expect(totals.repQualificationRate).toBe(50);

    expect(totals.repCalls).toBe(5);
    expect(totals.repReached).toBe(3);
    expect(totals.repOther).toBe(1);
    expect(totals.repContactRate).toBe(60);
    expect(totals.representantsContacted).toBe(3);
    expect(totals.prospectsCreated).toBe(2);
  });

  it('A refuse puis B décroche : le représentant ne compte que chez B', async () => {
    const { totals, pourAlice, pourBineta } = await surLeJeu(
      async ({ service, tx, alice, bineta }) => {
        await tx.repCallAttempt.deleteMany({});
        const rep = await tx.representant.findFirstOrThrow({ select: { id: true } });
        const duo: [string, RepCallOutcome, number][] = [
          [alice, RepCallOutcome.REFUSED, 9],
          [bineta, RepCallOutcome.REACHED, 12],
        ];
        for (const [performedById, outcome, h] of duo) {
          await tx.repCallAttempt.create({
            data: {
              id: uuidv7(),
              representantId: rep.id,
              performedById,
              outcome,
              clientCreatedAt: heure(h),
            },
          });
        }
        const resultat = await service.activite(FENETRE);
        return {
          totals: resultat.totals,
          pourAlice: de(resultat.items, alice),
          pourBineta: de(resultat.items, bineta),
        };
      },
    );

    expect(pourAlice?.repQuestioned).toBe(0);
    expect(pourBineta?.repQuestioned).toBe(1);
    expect(totals.repQuestioned).toBe(1);
    expect(totals.repQualified).toBe(1);
    expect(totals.repQualificationRate).toBe(100);
    expect(totals.representantsContacted).toBe(1);
  });

  /**
   * `representantsContacted` est distinct DANS un bucket : c'est là que la somme
   * des lignes diverge du total, et c'est pour ça que le total vient du serveur.
   */
  it('rappelé un autre jour : les lignes cumulent 2, le total dit 1', async () => {
    const { totals, lignes } = await surLeJeu(async ({ service, tx, alice }) => {
      await tx.repCallAttempt.deleteMany({});
      const rep = await tx.representant.findFirstOrThrow({ select: { id: true } });
      for (const jour of ['2026-03-02', '2026-03-03']) {
        await tx.repCallAttempt.create({
          data: {
            id: uuidv7(),
            representantId: rep.id,
            performedById: alice,
            outcome: RepCallOutcome.REACHED,
            clientCreatedAt: new Date(`${jour}T09:00:00.000Z`),
          },
        });
      }
      const resultat = await service.activite(FENETRE);
      return { totals: resultat.totals, lignes: resultat.items };
    });

    expect(lignes).toHaveLength(2);
    expect(lignes.reduce((cumul, ligne) => cumul + ligne.representantsContacted, 0)).toBe(2);
    expect(totals.representantsContacted).toBe(1);

    // La dernière réponse est celle du 3 : une seule qualification, pas deux.
    expect(lignes.reduce((cumul, ligne) => cumul + ligne.repQuestioned, 0)).toBe(1);
    expect(totals.repQuestioned).toBe(1);
    expect(totals.repCalls).toBe(2);
  });

  it('les taux d’équipe se recalculent sur les sommes, sans moyenner les lignes', async () => {
    const totals = await surLeJeu(async ({ service }) => (await service.activite(FENETRE)).totals);

    // 3 réponses sur 5 appels retenus : 60 %, et non la moyenne de 50 % et 100 %.
    expect(totals.repContactRate).toBe(60);
    expect(totals.repCallbackRate).toBe(20);
  });

  it('un seul téléconseiller demandé : le total ne retient que le sien', async () => {
    const totals = await surLeJeu(
      async ({ service, alice }) =>
        (await service.activite({ ...FENETRE, commercialId: alice })).totals,
    );

    expect(totals.repCalls).toBe(4);
    expect(totals.repQuestioned).toBe(1);
    expect(totals.repQualified).toBe(0);
  });

  it('fenêtre vide : le total existe et reste à zéro, taux à null', async () => {
    const totals = await surLeJeu(
      async ({ service }) =>
        (await service.activite({ actFrom: '2026-04-01', actTo: '2026-04-30' })).totals,
    );

    expect(totals.repCalls).toBe(0);
    expect(totals.repQuestioned).toBe(0);
    expect(totals.representantsContacted).toBe(0);
    expect(totals.repContactRate).toBeNull();
    expect(totals.repQualificationRate).toBeNull();
    expect(totals.reachRate).toBeNull();
  });

  it('hors fenêtre, rien n’est compté', async () => {
    const items = await surLeJeu(async ({ service }) => {
      const resultat = await service.activite({ actFrom: '2026-04-01', actTo: '2026-04-30' });
      return resultat.items;
    });

    expect(items).toEqual([]);
  });
});
