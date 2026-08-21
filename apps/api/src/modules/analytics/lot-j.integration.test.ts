import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, PrismaPg, Role } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
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

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

describe('agrégats de pilotage', () => {
  const pilotage = new PilotageService(client);
  const portfolio = new PortfolioService(client);
  const quality = new QualityService(client);

  it('campaign-pilotage, sans campagne puis sur une campagne', async () => {
    const toutes = await pilotage.campaignPilotage(admin, {});
    expect(toutes.campaignId).toBeNull();
    expect(Array.isArray(toutes.closedPerDay)).toBe(true);

    const une = await pilotage.campaignPilotage(admin, {
      campaignId: '00000000-0000-7000-8000-000000000000',
    });
    expect(une.tasks).toBe(0);
    expect(une.contactRate).toBeNull();
    expect(une.reachRate).toBeNull();
    expect(une.estimatedEndDate).toBeNull();
  });

  it('delays', async () => {
    const result = await pilotage.delays(admin, {});
    expect(result.legs).toHaveLength(3);
    for (const leg of result.legs) {
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
    const parDepartement = result.departements.reduce((sum, row) => sum + row.attempts, 0);
    expect(parDepartement).toBe(result.attempts);
  });

  it('origin-breakdown', async () => {
    const result = await quality.originBreakdown(admin, {});
    const cumul = result.byLabel.reduce((sum, row) => sum + row.prospects, 0);
    expect(cumul).toBe(result.total);
  });

  it('le filtre commun se compose sans casser la syntaxe', async () => {
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
