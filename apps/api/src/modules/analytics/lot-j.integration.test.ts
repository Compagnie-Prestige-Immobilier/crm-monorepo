/**
 * Les agrégats ajoutés au tableau de bord, exécutés par un vrai PostgreSQL.
 *
 * Les tests unitaires vérifient la CLAUSE composée : le filtre, la visibilité
 * de démonstration, l'absence de division par zéro. Aucun d'eux ne peut dire
 * si la requête est acceptée par le moteur, parce qu'ils remplacent le client
 * Prisma par un double.
 *
 * Or ces requêtes utilisent ce que le reste du produit n'utilisait pas encore :
 * agrégats à ensemble ordonné (`percentile_cont ... WITHIN GROUP`), clauses
 * `FILTER` empilées, tables dérivées croisées. Une faute de syntaxe y passe
 * toutes les épreuves unitaires et ne tombe qu'en production, sur l'écran d'un
 * directeur. D'où cette épreuve : elle ne vérifie AUCUN chiffre, seulement que
 * les huit requêtes s'exécutent et rendent une charge utile bien formée sur une
 * base dont on ne présume rien.
 *
 * Aucune assertion ne porte donc sur une VALEUR : la suite doit passer aussi
 * bien sur une base vide que sur la base de développement chargée, sans quoi
 * elle deviendrait le test le plus fragile du dépôt.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, PrismaPg, Role } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm?schema=public',
  }),
});

const client = prisma as unknown as PrismaService;
const admin: AuthenticatedUser = {
  id: 'admin-inexistant',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

/**
 * Les deux états du mode démonstration produisent deux SQL DIFFÉRENTS : éteint,
 * chaque table jointe porte une condition supplémentaire. Les deux doivent donc
 * être exécutés.
 */
const modes = [
  { nom: 'mode démonstration éteint', enabled: false },
  { nom: 'mode démonstration allumé', enabled: true },
];

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

describe.each(modes)('agrégats de pilotage ($nom)', ({ enabled }) => {
  const pilotage = new PilotageService(client, fakeDemoVisibility(enabled));
  const portfolio = new PortfolioService(client, fakeDemoVisibility(enabled));
  const quality = new QualityService(client, fakeDemoVisibility(enabled));

  it('campaign-pilotage, sans campagne puis sur une campagne', async () => {
    const toutes = await pilotage.campaignPilotage(admin, {});
    expect(toutes.campaignId).toBeNull();
    expect(Array.isArray(toutes.closedPerDay)).toBe(true);

    const une = await pilotage.campaignPilotage(admin, {
      campaignId: '00000000-0000-7000-8000-000000000000',
    });
    /**
     * ATTENTE CORRIGÉE. Cette ligne exigeait `contactRate === 0`, ce qu'aucune
     * base n'a jamais pu satisfaire : `rate()` rend `null` sur zéro
     * observation, délibérément, et `pilotage.service.test.ts` l'affirme déjà.
     * Un taux sur zéro tâche n'est pas « 0 % de contact », il n'existe pas ; le
     * rendre à 0 le rendait indistinguable d'une vraie contre-performance sur
     * l'écran d'un directeur. L'épreuve d'intégration affirmait donc le
     * CONTRAIRE du comportement voulu, et elle était rouge depuis toujours.
     */
    expect(une.tasks).toBe(0);
    expect(une.contactRate).toBeNull();
    expect(une.reachRate).toBeNull();
    expect(une.estimatedEndDate).toBeNull();
  });

  it('delays', async () => {
    const result = await pilotage.delays(admin, {});
    expect(result.legs).toHaveLength(3);
    for (const leg of result.legs) {
      // Un tronçon sans échantillon rend NULL, jamais 0.
      if (leg.sample === 0) expect(leg.medianDays).toBeNull();
      else expect(typeof leg.medianDays).toBe('number');
    }
  });

  it('bank-aging', async () => {
    const result = await portfolio.bankAging(admin, {});
    expect(result.buckets).toHaveLength(5);
    for (const stage of result.stages) expect(stage.buckets).toHaveLength(5);
    expect(typeof result.total).toBe('number');
  });

  it('weekly-cohorts', async () => {
    const result = await portfolio.weeklyCohorts(admin, {});
    expect(Array.isArray(result.items)).toBe(true);
    // Le montant est une CHAÎNE, jamais un nombre JSON.
    for (const item of result.items) expect(typeof item.cashedAmountXof).toBe('string');
  });

  it('departement-yield', async () => {
    const result = await portfolio.departementYield(admin, {});
    for (const item of result.items) expect(typeof item.cashedAmountXof).toBe('string');
    expect(typeof result.total).toBe('number');
  });

  it('representant-productivity, seuil par défaut puis seuil demandé', async () => {
    expect((await quality.representantProductivity(admin, {})).dormantDays).toBe(90);
    expect((await quality.representantProductivity(admin, { dormantDays: 30 })).dormantDays).toBe(
      30,
    );
  });

  it('data-quality', async () => {
    const result = await quality.dataQuality(admin, {});
    // Deux axes, une seule population de tentatives : les totaux coïncident.
    const parDepartement = result.departements.reduce((sum, row) => sum + row.attempts, 0);
    expect(parDepartement).toBe(result.attempts);
  });

  it('origin-breakdown', async () => {
    const result = await quality.originBreakdown(admin, {});
    const cumul = result.byLabel.reduce((sum, row) => sum + row.prospects, 0);
    // Le second niveau partitionne exactement le premier.
    expect(cumul).toBe(result.total);
  });

  it('le filtre commun se compose sans casser la syntaxe', async () => {
    // Le filtre le plus chargé possible : chaque champ ajoute une condition, et
    // `campaignId` en particulier insère une sous-requête qui réutilise l'alias
    // `ct` déjà pris par la requête de pilotage.
    const filtre = {
      search: 'Ndiaye',
      segment: 'BDD2',
      statut: 'CONVERTI',
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      campaignId: '00000000-0000-7000-8000-000000000000',
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-12-31T23:59:59.000Z',
    } as const;

    /**
     * `resolves.toBeDefined()` était vrai de TOUTE fonction qui rend un objet,
     * y compris d'une fonction qui rendrait une charge utile amputée : huit
     * lignes qui ne pouvaient échouer que sur une faute de syntaxe SQL, ce que
     * les épreuves ci-dessus établissent déjà. On exige donc ici la FORME
     * complète, celle sur laquelle les écrans comptent.
     *
     * Les VALEURS, elles, sont éprouvées sur un jeu connu par
     * `lot-j-chiffres.integration.test.ts` : aucune assertion chiffrée ici, qui
     * doit rester exécutable sur une base dont on ne présume rien.
     */
    const pilotageFiltre = await pilotage.campaignPilotage(admin, filtre);
    expect(pilotageFiltre.campaignId).toBe(filtre.campaignId);
    expect(typeof pilotageFiltre.tasks).toBe('number');
    expect(Array.isArray(pilotageFiltre.closedPerDay)).toBe(true);

    const delaisFiltre = await pilotage.delays(admin, filtre);
    expect(delaisFiltre.legs).toHaveLength(3);

    const agingFiltre = await portfolio.bankAging(admin, filtre);
    expect(agingFiltre.buckets).toHaveLength(5);
    expect(agingFiltre.buckets.reduce((somme, tranche) => somme + tranche.dossiers, 0)).toBe(
      agingFiltre.total,
    );

    const cohortesFiltre = await portfolio.weeklyCohorts(admin, filtre);
    expect(cohortesFiltre.items.reduce((somme, ligne) => somme + ligne.prospects, 0)).toBe(
      cohortesFiltre.total,
    );

    const rendementFiltre = await portfolio.departementYield(admin, filtre);
    for (const ligne of rendementFiltre.items) expect(typeof ligne.cashedAmountXof).toBe('string');

    const productiviteFiltre = await quality.representantProductivity(admin, filtre);
    expect(productiviteFiltre.dormantDays).toBe(90);

    const qualiteFiltre = await quality.dataQuality(admin, filtre);
    expect(qualiteFiltre.departements.reduce((somme, ligne) => somme + ligne.attempts, 0)).toBe(
      qualiteFiltre.attempts,
    );

    const provenanceFiltre = await quality.originBreakdown(admin, filtre);
    expect(provenanceFiltre.items.reduce((somme, ligne) => somme + ligne.prospects, 0)).toBe(
      provenanceFiltre.total,
    );
  });
});
