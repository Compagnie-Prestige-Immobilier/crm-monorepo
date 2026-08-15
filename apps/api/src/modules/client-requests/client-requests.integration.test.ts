/**
 * L'arbitrage des demandes de création, contre un VRAI PostgreSQL.
 *
 * Les épreuves unitaires du module montent une doublure de Prisma. Elles ne
 * peuvent donc rien dire de trois choses, qui sont précisément celles qui
 * coûteraient cher :
 *
 *  1. l'ATOMICITÉ de l'approbation. Elle crée un prospect PUIS revendique la
 *     demande. Si la seconde écriture échoue, la première doit disparaître avec
 *     elle. Une doublure de `$transaction` qui se contente d'exécuter le rappel
 *     ne défait rien, et laisserait passer un prospect orphelin ;
 *  2. la contrainte CHECK `client_creation_requests_approved_has_prospect`. Elle
 *     vit dans une migration SQL, pas dans le schéma Prisma : aucun test qui ne
 *     parle pas à la base ne l'exerce ;
 *  3. l'index unique PARTIEL sur la file d'attente. Le pré-contrôle applicatif
 *     lit puis écrit ; c'est l'index qui arbitre réellement deux dépôts
 *     simultanés, et lui seul sait qu'un numéro REFUSÉ redevient déposable.
 *
 * Lancée par `pnpm test:integration`.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { ClientRequestStatus, PrismaClient, PrismaPg, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Préfixe unique : la base est partagée, on ne touche QU'À nos propres lignes. */
const TAG = 'ITCR';

/** Numéros réservés à cette suite, hors de portée de tout autre jeu de données. */
const PHONE_A = '+221770990001';
const PHONE_B = '+221770990002';

let banqueId: string;
let syndicatId: string;
let departementId: string;
let requesterId: string;
let adminId: string;
let representantId: string;

/**
 * Efface ce qu'UN test a produit, et rien de plus.
 *
 * Le représentant et les comptes sont montés une fois pour toute la suite : les
 * emporter entre deux tests ferait échouer la création de prospect suivante sur
 * `prospects_representantId_fkey`, ce qui n'aurait rien à voir avec ce qui est
 * éprouvé ici.
 */
async function cleanup(): Promise<void> {
  await prisma.clientCreationRequest.deleteMany({ where: { nom: { startsWith: TAG } } });
  await prisma.prospect.deleteMany({ where: { phoneE164: { in: [PHONE_A, PHONE_B] } } });
  await prisma.prospect.deleteMany({ where: { nom: { startsWith: TAG } } });
}

/** Bornes de la SUITE seulement : le décor partagé part avec elle. */
async function cleanupAll(): Promise<void> {
  await cleanup();
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanupAll();

  const banque = await prisma.banque.findFirstOrThrow({ select: { id: true } });
  const syndicat = await prisma.syndicat.findFirstOrThrow({ select: { id: true } });
  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  banqueId = banque.id;
  syndicatId = syndicat.id;
  departementId = departement.id;

  const [requester, admin] = await Promise.all([
    prisma.user.create({
      data: {
        id: uuidv7(),
        username: `${TAG.toLowerCase()}-banque`,
        email: `${TAG.toLowerCase()}-banque@cpi.sn`,
        fullName: `${TAG} Agent Banque`,
        passwordHash: 'x',
        role: Role.BANQUE_FINANCE,
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        id: uuidv7(),
        username: `${TAG.toLowerCase()}-admin`,
        email: `${TAG.toLowerCase()}-admin@cpi.sn`,
        fullName: `${TAG} Admin`,
        passwordHash: 'x',
        role: Role.ADMIN,
      },
      select: { id: true },
    }),
  ]);
  requesterId = requester.id;
  adminId = admin.id;

  const representant = await prisma.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Représentant`,
      phoneE164: '+221770990099',
      departementId,
      createdById: adminId,
      clientCreatedAt: new Date('2026-01-05T09:00:00.000Z'),
    },
    select: { id: true },
  });
  representantId = representant.id;
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanup();
});

/** Dépose une demande EN ATTENTE, telle que l'écrirait le service. */
const depose = async (
  phone: string,
  // Type ÉLARGI à l'énumération entière : inféré depuis la valeur par défaut,
  // il vaudrait le seul littéral `'PENDING'` et la suite ne compilerait plus.
  status: ClientRequestStatus = ClientRequestStatus.PENDING,
): Promise<string> => {
  const row = await prisma.clientCreationRequest.create({
    data: {
      id: uuidv7(),
      nom: `${TAG}-Ndiaye`,
      prenom: 'Fatou',
      phoneE164: phone,
      banqueId,
      requestedById: requesterId,
      status,
      ...(status === ClientRequestStatus.REJECTED ? { rejectionNote: 'Doublon' } : {}),
    },
    select: { id: true },
  });
  return row.id;
};

/** Le prospect qu'une approbation crée, écrit tel quel par le service. */
const donneesProspect = (id: string, phone: string): Record<string, unknown> => ({
  id,
  nom: `${TAG}-Ndiaye`,
  prenom: 'Fatou',
  phoneE164: phone,
  banqueId,
  syndicatId,
  representantId,
  createdById: adminId,
  origin: 'BANQUE',
  clientCreatedAt: new Date('2026-02-10T08:00:00.000Z'),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. L'atomicité de l'approbation
// ─────────────────────────────────────────────────────────────────────────────

describe('approbation : la transaction est TOUT OU RIEN', () => {
  /**
   * On reproduit exactement la séquence du service, puis on fait échouer la
   * SECONDE écriture. Ce qui doit rester après coup : rien. Pas de prospect
   * orphelin, pas de demande à moitié arbitrée.
   *
   * L'échec est provoqué par la revendication conditionnelle elle-même, telle
   * qu'elle se produit en vrai : un second administrateur a déjà arbitré la
   * demande, `updateMany` ne met donc rien à jour et le service lève.
   */
  it('une revendication perdue ne laisse AUCUN prospect orphelin', async () => {
    const requestId = await depose(PHONE_A);
    const prospectId = uuidv7();

    const perdu = await prisma
      .$transaction(async (tx) => {
        await tx.prospect.create({ data: donneesProspect(prospectId, PHONE_A) as never });

        // Le concurrent gagne pendant que nous écrivons : hors transaction,
        // donc visible immédiatement pour la clause ci-dessous.
        await prisma.clientCreationRequest.updateMany({
          where: { id: requestId, status: ClientRequestStatus.PENDING },
          data: {
            status: ClientRequestStatus.REJECTED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            rejectionNote: 'Arbitré ailleurs',
          },
        });

        const claimed = await tx.clientCreationRequest.updateMany({
          where: { id: requestId, status: ClientRequestStatus.PENDING },
          data: {
            status: ClientRequestStatus.APPROVED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            createdProspectId: prospectId,
          },
        });
        if (claimed.count === 0) throw new Error('CLIENT_REQUEST_ALREADY_REVIEWED');
        return 'gagné';
      })
      .catch((error: unknown) => (error as Error).message);

    expect(perdu).toBe('CLIENT_REQUEST_ALREADY_REVIEWED');

    // LE POINT DE TOUTE L'ÉPREUVE : le prospect a bien été créé à l'intérieur
    // de la transaction, et il a disparu avec elle. Un `$transaction` mal
    // employé (chaque écriture sur sa propre connexion) le laisserait derrière,
    // rattaché à personne, et il ressortirait dans l'annuaire commercial.
    expect(await prisma.prospect.findUnique({ where: { id: prospectId } })).toBeNull();
    expect(await prisma.prospect.count({ where: { phoneE164: PHONE_A } })).toBe(0);

    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, createdProspectId: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.REJECTED);
    expect(apres.createdProspectId).toBeNull();
  });

  it('l’approbation qui aboutit laisse la demande ET son prospect', async () => {
    // Le témoin positif : sans lui, une transaction qui échouerait TOUJOURS
    // satisferait l'épreuve ci-dessus sans rien prouver.
    const requestId = await depose(PHONE_B);
    const prospectId = uuidv7();

    await prisma.$transaction(async (tx) => {
      await tx.prospect.create({ data: donneesProspect(prospectId, PHONE_B) as never });
      const claimed = await tx.clientCreationRequest.updateMany({
        where: { id: requestId, status: ClientRequestStatus.PENDING },
        data: {
          status: ClientRequestStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          createdProspectId: prospectId,
        },
      });
      expect(claimed.count).toBe(1);
    });

    expect(await prisma.prospect.count({ where: { id: prospectId } })).toBe(1);
    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, createdProspectId: true },
    });
    expect(apres).toEqual({
      status: ClientRequestStatus.APPROVED,
      createdProspectId: prospectId,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. La contrainte CHECK, exercée directement
// ─────────────────────────────────────────────────────────────────────────────

describe('contrainte client_creation_requests_approved_has_prospect', () => {
  /**
   * La contrainte vit dans une migration SQL et NON dans le schéma Prisma :
   * `prisma migrate diff` ne la régénère pas, et une remise à plat du schéma
   * peut la faire disparaître sans qu'aucun test unitaire ne bronche. Elle est
   * le dernier rempart contre une demande « approuvée » que l'écran d'arbitrage
   * propose d'ouvrir alors qu'elle ne désigne aucun client.
   */
  it('REFUSE une demande approuvée sans prospect', async () => {
    const requestId = await depose(PHONE_A);

    const erreur =
      await prisma.$executeRaw`UPDATE "client_creation_requests" SET "status" = 'APPROVED' WHERE "id" = ${requestId}`
        .then(() => null)
        .catch((error: unknown) => (error as Error).message);

    expect(erreur).not.toBeNull();
    expect(erreur).toContain('client_creation_requests_approved_has_prospect');

    // La ligne n'a pas bougé.
    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.PENDING);
  });

  it('REFUSE une demande refusée sans motif', async () => {
    const requestId = await depose(PHONE_A);

    const erreur =
      await prisma.$executeRaw`UPDATE "client_creation_requests" SET "status" = 'REJECTED' WHERE "id" = ${requestId}`
        .then(() => null)
        .catch((error: unknown) => (error as Error).message);

    expect(erreur).toContain('client_creation_requests_rejected_has_note');
  });

  it('ACCEPTE une demande approuvée qui porte son prospect', async () => {
    // Témoin : sans lui, une contrainte qui refuserait TOUT satisferait les
    // deux épreuves ci-dessus.
    const requestId = await depose(PHONE_A);
    const prospectId = uuidv7();
    await prisma.prospect.create({ data: donneesProspect(prospectId, PHONE_A) as never });

    await prisma.clientCreationRequest.update({
      where: { id: requestId },
      data: {
        status: ClientRequestStatus.APPROVED,
        createdProspectId: prospectId,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    const apres = await prisma.clientCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true },
    });
    expect(apres.status).toBe(ClientRequestStatus.APPROVED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. L'index unique PARTIEL sur la file d'attente
// ─────────────────────────────────────────────────────────────────────────────

describe('index client_creation_requests_pending_phone_key', () => {
  /**
   * Le pré-contrôle applicatif LIT puis ÉCRIT : deux agents qui déposent le
   * même numéro à la même seconde le franchissent tous les deux. C'est l'index
   * qui arbitre, et c'est donc lui qu'il faut éprouver, pas le pré-contrôle.
   */
  it('REFUSE un second dépôt EN ATTENTE sur le même numéro', async () => {
    await depose(PHONE_A);

    const erreur = await depose(PHONE_A)
      .then(() => null)
      .catch((error: unknown) => (error as { code?: string }).code ?? String(error));

    // P2002 : c'est ce code que le filtre global traduit en 409 typé.
    expect(erreur).toBe('P2002');
    expect(
      await prisma.clientCreationRequest.count({
        where: { phoneE164: PHONE_A, status: ClientRequestStatus.PENDING },
      }),
    ).toBe(1);
  });

  /**
   * L'index est PARTIEL, et c'est tout son intérêt : un numéro refusé doit
   * pouvoir être redéposé. Un index total interdirait à la banque de corriger
   * une demande rejetée pour une pièce manquante, ce qui est le cas d'usage le
   * plus courant du refus.
   */
  it('AUTORISE un nouveau dépôt après un refus sur le même numéro', async () => {
    const premier = await depose(PHONE_A, ClientRequestStatus.REJECTED);

    const second = await depose(PHONE_A);

    expect(second).not.toBe(premier);
    expect(await prisma.clientCreationRequest.count({ where: { phoneE164: PHONE_A } })).toBe(2);
    expect(
      await prisma.clientCreationRequest.count({
        where: { phoneE164: PHONE_A, status: ClientRequestStatus.PENDING },
      }),
    ).toBe(1);
  });

  it('AUTORISE deux demandes EN ATTENTE sur deux numéros différents', async () => {
    await depose(PHONE_A);
    await depose(PHONE_B);

    expect(
      await prisma.clientCreationRequest.count({
        where: { status: ClientRequestStatus.PENDING, nom: { startsWith: TAG } },
      }),
    ).toBe(2);
  });
});
