/**
 * La purge complète, exécutée pour de vrai contre PostgreSQL.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI L'ÉPREUVE UNITAIRE NE POUVAIT PAS SUFFIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `purge.service.test.ts` monte une doublure de Prisma. Elle exécute donc les
 * étapes dans l'ordre déclaré et les compte, ce qui vérifie le PLAN, jamais son
 * exécution : une doublure n'a pas de clé étrangère. Or ce qui a réellement
 * cassé, c'est exactement cela. Les tables des campagnes de représentants et
 * des demandes de création pointent vers `users`, `prospects` et `banques` en
 * `Restrict`. Tant qu'aucune étape ne les vidait AVANT leurs parents, la
 * transaction avortait sur une violation de contrainte, et la purge ne
 * supprimait rien du tout. Le test unitaire restait vert, parce qu'il
 * s'éprouvait lui-même.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMENT ON PURGE UNE BASE PARTAGÉE SANS LA DÉTRUIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La purge est par nature irréversible, et cette base sert aux autres suites.
 * On l'exécute donc À L'INTÉRIEUR d'une transaction que l'on fait AVORTER à la
 * fin. `PurgeService` reçoit un client dont `$transaction` se contente de
 * passer le client de la transaction ENGLOBANTE : toutes ses suppressions
 * partent vraiment vers PostgreSQL, les clés étrangères sont vraiment
 * vérifiées, et rien ne survit au `ROLLBACK`.
 *
 * Ce n'est pas une simplification : c'est même la seule façon d'exercer la
 * purge sur une base RÉELLEMENT peuplée, jeu de démonstration compris.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  CallTaskStatus,
  CampaignStatus,
  ClientRequestStatus,
  PrismaClient,
  PrismaPg,
  RepCallOutcome,
  Role,
  type Prisma,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PURGE_DOMAIN_KEYS, type PurgeDomainKey } from './purge-plan.js';
import { PurgeService } from './purge.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITPG';

/** Marqueur d'avortement : il ne doit jamais remonter comme une vraie erreur. */
const ROLLBACK = 'ROLLBACK_VOLONTAIRE';

let firstAdmin: { id: string; username: string; email: string };
let actor: AuthenticatedUser;

/**
 * Exécute `run` dans une transaction TOUJOURS annulée.
 *
 * Le client remis à `PurgeService` est un mandataire : son `$transaction`
 * n'ouvre rien, il rend la transaction déjà ouverte. Le service croit donc
 * travailler en transaction (c'est le cas), et nous gardons la main sur le
 * `ROLLBACK`.
 */
async function dansUneTransactionAnnulee<T>(
  run: (service: PurgeService, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  // Boîte plutôt que variable nue : le compilateur ne sait pas que le `throw`
  // qui provoque le ROLLBACK vient forcément APRÈS l'affectation.
  const boite: { valeur?: T } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
        const mandataire = new Proxy(tx, {
          get(cible, propriete, recepteur) {
            if (propriete === '$transaction') {
              return (rappel: (inner: Prisma.TransactionClient) => Promise<unknown>) => rappel(tx);
            }
            return Reflect.get(cible, propriete, recepteur) as unknown;
          },
        }) as unknown as PrismaService;

        boite.valeur = await run(new PurgeService(mandataire), tx);
        throw new Error(ROLLBACK);
      },
      { timeout: 60_000 },
    )
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);

  if (erreur !== ROLLBACK) throw new Error(`purge interrompue : ${String(erreur)}`);
  if (!('valeur' in boite)) throw new Error('la purge n’a rien rendu');
  return boite.valeur;
}

/**
 * Sème une ligne dans CHACUNE des tables arrivées avec les deux derniers lots.
 *
 * C'est le point de l'épreuve. Une base vide de campagnes de représentants et
 * de demandes de création se purge sans difficulté, et c'est très exactement
 * pourquoi le défaut a pu vivre : il ne se manifestait que sur une base qui
 * s'était servie des fonctionnalités récentes.
 */
async function semer(tx: Prisma.TransactionClient): Promise<void> {
  const departement = await tx.departement.findFirstOrThrow({ select: { id: true } });
  const ief = await tx.ief.findFirstOrThrow({ select: { id: true } });
  const banque = await tx.banque.findFirstOrThrow({ select: { id: true } });
  const syndicat = await tx.syndicat.findFirstOrThrow({ select: { id: true } });

  const commercial = await tx.user.create({
    data: {
      id: uuidv7(),
      username: `${TAG.toLowerCase()}-com`,
      email: `${TAG.toLowerCase()}-com@cpi.sn`,
      fullName: `${TAG} Commercial`,
      passwordHash: 'x',
      role: Role.COMMERCIAL,
      departementId: departement.id,
    },
    select: { id: true },
  });

  const banquier = await tx.user.create({
    data: {
      id: uuidv7(),
      username: `${TAG.toLowerCase()}-bq`,
      email: `${TAG.toLowerCase()}-bq@cpi.sn`,
      fullName: `${TAG} Banque`,
      passwordHash: 'x',
      role: Role.BANQUE_FINANCE,
    },
    select: { id: true },
  });

  const representant = await tx.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Représentant`,
      phoneE164: '+221770991001',
      departementId: departement.id,
      iefId: ief.id,
      createdById: commercial.id,
      clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
    },
    select: { id: true },
  });

  const prospect = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Diallo`,
      prenom: 'Awa',
      phoneE164: '+221770991002',
      banqueId: banque.id,
      syndicatId: syndicat.id,
      representantId: representant.id,
      createdById: commercial.id,
      clientCreatedAt: new Date('2026-01-03T09:00:00.000Z'),
    },
    select: { id: true },
  });

  // ── Campagne de représentants : les quatre tables du lot ──────────────────
  const campagne = await tx.repCallCampaign.create({
    data: {
      id: uuidv7(),
      name: `${TAG} Relance`,
      seed: 'a'.repeat(32),
      spreadDays: 2,
      status: CampaignStatus.ACTIVE,
      createdById: firstAdmin.id,
      departementId: departement.id,
      iefId: ief.id,
    },
    select: { id: true },
  });

  await tx.repCallCampaignCommercial.create({
    data: { campaignId: campagne.id, userId: commercial.id, position: 0 },
  });

  const tache = await tx.repCallTask.create({
    data: {
      id: uuidv7(),
      campaignId: campagne.id,
      representantId: representant.id,
      assignedToId: commercial.id,
      position: 1,
      dayIndex: 0,
      status: CallTaskStatus.OPEN,
      isActive: true,
    },
    select: { id: true },
  });

  await tx.repCallAttempt.create({
    data: {
      id: uuidv7(),
      campaignId: campagne.id,
      taskId: tache.id,
      representantId: representant.id,
      performedById: commercial.id,
      outcome: RepCallOutcome.CALLBACK,
      clientCreatedAt: new Date('2026-01-04T09:00:00.000Z'),
    },
  });

  // ── Demande de création de client, APPROUVÉE : elle pointe en Restrict vers
  //    le prospect, la banque et deux comptes à la fois.
  await tx.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Sow`,
      prenom: 'Moussa',
      phoneE164: '+221770991003',
      banqueId: banque.id,
      requestedById: banquier.id,
      reviewedById: firstAdmin.id,
      reviewedAt: new Date(),
      status: ClientRequestStatus.APPROVED,
      createdProspectId: prospect.id,
    },
  });

  // ── Une demande EN ATTENTE aussi : le statut change la ligne, pas la clé,
  //    mais l'index partiel de la file d'attente ne doit pas gêner la purge.
  await tx.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Ba`,
      prenom: 'Ndeye',
      phoneE164: '+221770991004',
      banqueId: banque.id,
      requestedById: banquier.id,
      status: ClientRequestStatus.PENDING,
    },
  });
}

beforeAll(async () => {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, username: true, email: true },
  });
  if (!admin) throw new Error('aucun administrateur : lancer pnpm db:seed');
  firstAdmin = admin;
  actor = {
    id: admin.id,
    email: admin.email,
    username: admin.username,
    fullName: admin.username,
    role: Role.ADMIN,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('purge complète sur une base qui utilise TOUTES les tables', () => {
  /**
   * L'épreuve centrale. Elle sème une ligne dans chacune des tables des deux
   * derniers lots, coche TOUS les domaines, et exige simplement que la purge
   * ARRIVE AU BOUT. C'est la seule chose qu'il fallait démontrer : la version
   * précédente avortait sur `rep_call_tasks_assignedToId_fkey` avant d'avoir
   * supprimé quoi que ce soit.
   */
  it('va jusqu’au bout, IEF et campagnes de représentants comprises', async () => {
    const resultat = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      return service.purge(actor, {
        domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
        confirmation: firstAdmin.username,
      });
    });

    // Elle a supprimé, et pas qu'un peu : les référentiels seuls comptent
    // plusieurs dizaines de lignes.
    expect(resultat.total).toBeGreaterThan(0);
    expect(resultat.deleted.length).toBeGreaterThan(0);
    expect(new Date(resultat.purgedAt).getTime()).toBeGreaterThan(0);
  });

  /**
   * Le domaine « téléconseillers » à lui seul entraîne, par fermeture
   * transitive, les prospects, les représentants et les DEUX familles de
   * campagnes. C'est la sélection qui a le plus de chances d'être cochée
   * seule dans l'écran, et celle qui traverse le plus de clés `Restrict`.
   */
  it('le domaine des téléconseillers emporte ses dépendances sans avorter', async () => {
    const resultat = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      return service.purge(actor, {
        domains: ['teleconseillers'],
        confirmation: firstAdmin.email,
      });
    });

    const parDomaine = new Map(resultat.deleted.map((row) => [row.key, row.rows]));
    // Les référentiels ne portent aucune clé vers un compte : ils RESTENT.
    expect(parDomaine.has('referentiels')).toBe(false);
    expect(resultat.total).toBeGreaterThan(0);
  });

  /**
   * Un décompte qui ment est pire qu'un décompte absent : l'écran annonce le
   * nombre de lignes AVANT que l'administrateur ne valide une action
   * irréversible. Le catalogue et la purge doivent donc porter la même clause,
   * ce que seule une vraie base peut établir.
   */
  it('le catalogue annonce ce que la purge supprime réellement', async () => {
    const { annonce, supprime } = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      const catalogue = await service.catalog(actor);
      const resultat = await service.purge(actor, {
        domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
        confirmation: firstAdmin.username,
      });
      return {
        annonce: catalogue.domains.reduce((somme, domaine) => somme + domaine.rows, 0),
        supprime: resultat.total,
      };
    });

    // Le compte du catalogue exclut l'administrateur qui agit, la suppression
    // aussi : les deux nombres portent sur le MÊME ensemble.
    expect(supprime).toBe(annonce);
  });

  it('refuse une confirmation qui ne correspond pas, sans rien supprimer', async () => {
    const code = await dansUneTransactionAnnulee(async (service, tx) => {
      await semer(tx);
      const erreur = await service
        .purge(actor, {
          domains: [...PURGE_DOMAIN_KEYS] as PurgeDomainKey[],
          confirmation: 'quelqu-un-d-autre',
        })
        .then(() => null)
        .catch((caught: unknown) => (caught as { response?: { code?: string } }).response?.code);

      // Rien n'a bougé : le représentant semé est toujours là.
      expect(
        await tx.representant.count({
          where: { fullName: { startsWith: TAG } },
        }),
      ).toBe(1);
      return erreur;
    });

    expect(code).toBe('PURGE_CONFIRMATION_MISMATCH');
  });
});
