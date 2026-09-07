process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';

import { PrismaClient, PrismaPg, Role, type Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { OuverturesService } from './ouvertures.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLLBACK = 'ROLLBACK_VOLONTAIRE';
const TAG = 'it-chrono';

const jour = new Date();
const heure = (h: number, min = 0): Date =>
  new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate(), h, min));

interface Decor {
  service: OuverturesService;
  tx: Prisma.TransactionClient;
  awa: AuthenticatedUser;
  prospectId: string;
}

async function semer(tx: Prisma.TransactionClient): Promise<Decor> {
  const compte = await tx.user.create({
    data: {
      id: uuidv7(),
      email: `awa.${TAG}@test.local`,
      username: `awa-${TAG}`,
      passwordHash: 'x',
      fullName: `Awa ${TAG}`,
      role: Role.COMMERCIAL,
    },
    select: { id: true, email: true, username: true, fullName: true, role: true },
  });

  const prospect = await tx.prospect.create({
    data: {
      id: uuidv7(),
      nom: 'Chrono',
      prenom: 'Test',
      phoneE164: '+221770991234',
      createdById: compte.id,
      clientCreatedAt: heure(7),
    },
    select: { id: true },
  });

  const client = new Proxy(tx, {
    get: (cible, propriete, recepteur) => Reflect.get(cible, propriete, recepteur) as unknown,
  }) as unknown as PrismaService;

  return { service: new OuverturesService(client), tx, awa: compte, prospectId: prospect.id };
}

async function surLeJeu<T>(run: (decor: Decor) => Promise<T>): Promise<T> {
  const boite: { valeur?: T } = {};

  const erreur = await prisma
    .$transaction(
      async (tx) => {
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

async function ouverture(
  decor: Decor,
  data: { openedAt: Date; firstInputAt?: Date; closedAt?: Date; liberee?: boolean },
): Promise<string> {
  const row = await decor.tx.ouvertureFiche.create({
    data: {
      id: uuidv7(),
      openedById: decor.awa.id,
      prospectId: decor.prospectId,
      openedAt: data.openedAt,
      firstInputAt: data.firstInputAt ?? null,
      closedAt: data.closedAt ?? null,
      closingAttemptId: data.closedAt && !data.liberee ? uuidv7() : null,
      releasedById: data.liberee ? decor.awa.id : null,
      releasedAt: data.liberee ? (data.closedAt ?? null) : null,
    },
    select: { id: true },
  });
  return row.id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('le chronomètre démarre à la première saisie', () => {
  it('retient la première heure envoyée et ignore celles des frappes suivantes', async () => {
    const rendu = await surLeJeu(async (decor) => {
      const id = await ouverture(decor, { openedAt: heure(9) });

      const premier = await decor.service.enregistrerBrouillon(decor.awa, id, {
        draft: { syndicat: 'SAES' },
        firstInputAt: heure(9, 2).toISOString(),
      });
      const second = await decor.service.enregistrerBrouillon(decor.awa, id, {
        draft: { syndicat: 'SUDES' },
        firstInputAt: heure(9, 8).toISOString(),
      });
      const relu = await decor.tx.ouvertureFiche.findUniqueOrThrow({
        where: { id },
        select: { firstInputAt: true, draft: true },
      });
      return { premier, second, relu };
    });

    expect(rendu.premier.firstInputAt).toBe(heure(9, 2).toISOString());
    expect(rendu.second.firstInputAt).toBe(heure(9, 2).toISOString());
    expect(rendu.relu.firstInputAt).toEqual(heure(9, 2));
    expect(rendu.relu.draft).toEqual({ syndicat: 'SUDES' });
  });

  it('laisse hors de la DMT une fiche fermée sans qu’on y ait rien saisi', async () => {
    const ligne = await surLeJeu(async (decor) => {
      await ouverture(decor, {
        openedAt: heure(9),
        firstInputAt: heure(9, 2),
        closedAt: heure(9, 7),
      });
      await ouverture(decor, { openedAt: heure(11), closedAt: heure(11, 0.5) });
      await ouverture(decor, { openedAt: heure(12), closedAt: heure(13), liberee: true });

      const { items } = await decor.service.comptage(decor.awa, {});
      return items[0];
    });

    expect(ligne?.ouvertures).toBe(3);
    expect(ligne?.qualifiees).toBe(2);
    expect(ligne?.liberees).toBe(1);
    expect(ligne?.dureeMoyenneSecondes).toBe(300);
  });
});

// La contrainte CHECK est le dernier rempart derrière le serveur : elle seule
// tient encore si un jour une écriture contourne `enregistrerBrouillon`.
describe('la base refuse une borne dans le désordre', () => {
  it('rejette une première saisie antérieure à l’ouverture', async () => {
    const message = await surLeJeu(async (decor) => {
      const id = await ouverture(decor, { openedAt: heure(9) });
      return decor.tx.ouvertureFiche
        .update({ where: { id }, data: { firstInputAt: heure(8) } })
        .then(() => 'acceptée')
        .catch((error: unknown) => (error as Error).message);
    });

    expect(message).toContain('ouvertures_fiche_premiere_saisie_check');
  });
});
