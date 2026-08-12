/**
 * Mode démonstration — épreuve d'intégration sur une vraie base.
 *
 * Le test central est `la donnée réelle survit à la désactivation`. Tous les
 * autres décrivent du confort ; celui-là décrit la seule faute irréparable que
 * cette fonctionnalité puisse commettre.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, PrismaPg } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { DemoCountsDto } from './dto.js';
import { DemoService } from './demo.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm?schema=public',
  }),
});

const demo = new DemoService(prisma as unknown as PrismaService);

let adminId: string;
/** Identifiants des lignes créées par le test lui-même, à nettoyer à la fin. */
const leurres: { representantId: string; prospectId: string; commercialId: string } = {
  representantId: '',
  prospectId: '',
  commercialId: '',
};

beforeAll(async () => {
  // Le schéma d'environnement est strict et lu paresseusement par `readEnv()`.
  // Le garde-fou de production l'interroge, il faut donc lui donner de quoi
  // valider — les valeurs elles-mêmes n'importent pas ici.
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  adminId = admin.id;

  // Un jeu de LEURRES : des lignes réelles qui ressemblent trait pour trait à
  // des données de démonstration — même préfixe de nom, créées dans la même
  // minute, rattachées à un commercial créé au même moment. Une suppression
  // par heuristique les emporterait.
  const commercial = await prisma.user.create({
    data: {
      email: 'demo.leurre@cpi.sn',
      username: 'demo.leurre',
      fullName: '[Démo] Leurre Réel',
      passwordHash: 'x',
      role: 'COMMERCIAL',
    },
  });
  leurres.commercialId = commercial.id;

  const departement = await prisma.departement.findFirstOrThrow();
  const banque = await prisma.banque.findFirstOrThrow();
  const syndicat = await prisma.syndicat.findFirstOrThrow();

  const representant = await prisma.representant.create({
    data: {
      id: crypto.randomUUID(),
      fullName: '[Démo] Représentant Réel',
      phoneE164: '+221779999001',
      departementId: departement.id,
      createdById: commercial.id,
      clientCreatedAt: new Date(),
    },
  });
  leurres.representantId = representant.id;

  const prospect = await prisma.prospect.create({
    data: {
      id: crypto.randomUUID(),
      nom: 'Diop',
      prenom: '[Démo] Réel',
      phoneE164: '+221789999001',
      representantId: representant.id,
      banqueId: banque.id,
      syndicatId: syndicat.id,
      createdById: commercial.id,
      clientCreatedAt: new Date(),
    },
  });
  leurres.prospectId = prospect.id;
});

afterAll(async () => {
  await prisma.prospect.deleteMany({ where: { id: leurres.prospectId } });
  await prisma.representant.deleteMany({ where: { id: leurres.representantId } });
  await prisma.user.deleteMany({ where: { id: leurres.commercialId } });
  await prisma.$disconnect();
});

describe('mode démonstration', () => {
  it('part désactivé et sans registre', async () => {
    const état = await demo.status();
    expect(état.enabled).toBe(false);
    expect(état.counts.prospects).toBe(0);
  });

  it('active, peuple, et compte ce qu’il a créé', async () => {
    const état = await demo.enable(adminId);

    expect(état.enabled).toBe(true);
    expect(état.seededAt).not.toBeNull();
    expect(état.counts.users).toBeGreaterThan(0);
    expect(état.counts.representants).toBeGreaterThan(0);
    expect(état.counts.prospects).toBeGreaterThan(50);
    expect(état.counts.bankCases).toBeGreaterThan(0);

    // Le registre doit compter exactement autant de lignes que la somme des
    // compteurs : une entité créée sans être tracée ne serait jamais retirée.
    const registre = await prisma.demoEntity.count();
    // On somme par CLÉS plutôt qu'en énumérant les champs : ainsi un compteur
    // ajouté au DTO entre dans l'invariant sans qu'on ait à y penser. C'est ce
    // qui garantit qu'aucune entité créée n'échappe au registre, donc à la
    // suppression.
    const compteurs = état.counts;
    const somme = (Object.keys(compteurs) as (keyof DemoCountsDto)[]).reduce(
      (total, clé) => total + compteurs[clé],
      0,
    );
    expect(registre).toBe(somme);
  }, 180_000);

  it('l’activation est idempotente', async () => {
    const avant = await prisma.demoEntity.count();
    await demo.enable(adminId);
    expect(await prisma.demoEntity.count()).toBe(avant);
  }, 60_000);

  it('un compte de démonstration existe et porte le bon rôle', async () => {
    const agent = await prisma.user.findUnique({ where: { username: 'demo.banque' } });
    expect(agent?.role).toBe('BANQUE_FINANCE');
  });

  it('les référentiels ne sont ni créés ni modifiés', async () => {
    // La démonstration les RÉFÉRENCE ; elle n'y touche jamais. S'ils avaient
    // été altérés, la plateforme serait durablement abîmée par une simple
    // démonstration.
    const [banques, syndicats, departements, étapes] = await Promise.all([
      prisma.banque.count(),
      prisma.syndicat.count(),
      prisma.departement.count(),
      prisma.bankCaseStage.count(),
    ]);
    expect(banques).toBe(35);
    expect(syndicats).toBe(23);
    expect(departements).toBe(46);
    expect(étapes).toBe(4);
  });

  it('LA DONNÉE RÉELLE SURVIT À LA DÉSACTIVATION', async () => {
    const prospectsAvant = await prisma.prospect.count();

    await demo.disable(adminId);

    // Les leurres — indiscernables de données de démonstration pour toute
    // heuristique de nom, de date ou de propriétaire — sont toujours là.
    expect(await prisma.prospect.findUnique({ where: { id: leurres.prospectId } })).not.toBeNull();
    expect(
      await prisma.representant.findUnique({ where: { id: leurres.representantId } }),
    ).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: leurres.commercialId } })).not.toBeNull();

    // Et il ne reste rien de la démonstration.
    expect(await prisma.demoEntity.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { username: 'demo.banque' } })).toBeNull();
    expect(await prisma.prospect.count()).toBeLessThan(prospectsAvant);

    const état = await demo.status();
    expect(état.enabled).toBe(false);
    expect(état.counts.prospects).toBe(0);
  }, 180_000);

  it('la désactivation est idempotente', async () => {
    await demo.disable(adminId);
    expect(await prisma.demoEntity.count()).toBe(0);
  }, 60_000);
});
