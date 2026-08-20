import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { FakeDemo, FakeVisitesPrisma, fakeRef } from './fake-visites-prisma.js';
import { VisitesStatsService } from './visites-stats.service.js';
import { VisitesService } from './visites.service.js';

const CPI = fakeRef({ id: 'ent-cpi', code: 'CPI', label: 'CPI', sortOrder: 1 });
const SANTARGILE = fakeRef({ id: 'ent-san', code: 'SANTARGILE', sortOrder: 2 });
const MAKE_UP = fakeRef({ id: 'ent-mua', code: 'MAKE_UP_ADDICTION', sortOrder: 3 });
const COMMERCIALE = fakeRef({ id: 'dir-com', code: 'COMMERCIALE', sortOrder: 1 });
const FONCIERE = fakeRef({ id: 'dir-fon', code: 'FONCIERE', sortOrder: 2 });
const NDOYE = fakeRef({ id: 'dest-ndoye', code: 'NDOYE', sortOrder: 1 });
const SUIVI = fakeRef({ id: 'obj-suivi', code: 'SUIVI_DOSSIER', sortOrder: 1 });
const ACHAT = fakeRef({ id: 'obj-achat', code: 'ACHAT_TERRAIN', sortOrder: 2 });

const ACCUEIL = 'usr-accueil';

const labelled = (buckets: { code: string; count: number }[]): Record<string, number> =>
  Object.fromEntries(buckets.map((bucket) => [bucket.code, bucket.count]));

describe('statistiques du registre', () => {
  let prisma: FakeVisitesPrisma;
  let visites: VisitesService;
  let stats: VisitesStatsService;

  beforeEach(() => {
    prisma = new FakeVisitesPrisma();
    prisma.entreprises = [CPI, SANTARGILE, MAKE_UP];
    prisma.directions = [COMMERCIALE, FONCIERE];
    prisma.destinataires = [NDOYE];
    prisma.objets = [SUIVI, ACHAT];

    visites = new VisitesService(
      prisma as unknown as PrismaService,
      new FakeDemo() as unknown as DemoVisibilityService,
    );
    stats = new VisitesStatsService(
      prisma as unknown as PrismaService,
      new FakeDemo() as unknown as DemoVisibilityService,
    );
  });

  const inscrire = (
    over: Partial<Parameters<VisitesService['create']>[0]> = {},
  ): Promise<unknown> =>
    visites.create(
      {
        date: '2026-01-06',
        visitorName: 'VISITEUR',
        entrepriseId: CPI.id,
        objetId: SUIVI.id,
        ...over,
      },
      ACCUEIL,
    );

  it('compte les lignes, et liste TOUTES les entrées y compris celles à zéro', async () => {
    await inscrire({ directionId: COMMERCIALE.id, destinataireId: NDOYE.id });
    await inscrire({ entrepriseId: SANTARGILE.id, objetId: ACHAT.id });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.total).toBe(2);
    expect(labelled(result.parEntreprise)).toEqual({ CPI: 1, SANTARGILE: 1, MAKE_UP_ADDICTION: 0 });
    expect(labelled(result.parObjet)).toEqual({ SUIVI_DOSSIER: 1, ACHAT_TERRAIN: 1 });
    expect(labelled(result.parDirection)).toEqual({ COMMERCIALE: 1, FONCIERE: 0 });
    expect(labelled(result.parDestinataire)).toEqual({ NDOYE: 1 });
  });

  it('rend l’écart entre le total et la somme d’une répartition facultative', async () => {
    await inscrire({ directionId: COMMERCIALE.id, destinataireId: NDOYE.id });
    await inscrire({});
    await inscrire({});

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.total).toBe(3);
    expect(result.parDirection.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(result.sansDirection).toBe(2);
    expect(result.sansDestinataire).toBe(2);
  });

  it('ne compte que la période demandée, bornes de journée comprises', async () => {
    await inscrire({ date: '2025-12-31', time: '23:45' });
    await inscrire({ date: '2026-01-01', time: '00:15' });
    await inscrire({ date: '2026-01-31', time: '23:45' });
    await inscrire({ date: '2026-02-01', time: '08:00' });

    const janvier = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });
    expect(janvier.total).toBe(2);
  });

  it('donne chaque mois de la période, même sans visite', async () => {
    await inscrire({ date: '2026-01-06' });
    await inscrire({ date: '2026-03-02' });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-03-31' });

    expect(result.parMois).toEqual([
      { month: '2026-01', count: 1 },
      { month: '2026-02', count: 0 },
      { month: '2026-03', count: 1 },
    ]);
  });

  it('enjambe le changement d’année sans sauter de mois', async () => {
    const result = await stats.compute({ from: '2025-11-01', to: '2026-01-31' });
    expect(result.parMois.map((mois) => mois.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('ne rend que les jours ayant reçu quelqu’un, dans l’ordre', async () => {
    await inscrire({ date: '2026-01-15', time: '10:10' });
    await inscrire({ date: '2026-01-06', time: '11:08' });
    await inscrire({ date: '2026-01-06', time: '13:02' });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.parJour).toEqual([
      { date: '2026-01-06', count: 2 },
      { date: '2026-01-15', count: 1 },
    ]);
  });

  it('garde une entrée retirée des listes tant qu’elle a compté sur la période', async () => {
    await inscrire({ directionId: FONCIERE.id });
    FONCIERE.isActive = false;

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });
    expect(labelled(result.parDirection)).toEqual({ COMMERCIALE: 0, FONCIERE: 1 });

    FONCIERE.isActive = true;
  });

  it('ne compte pas une ligne de démonstration quand le mode est éteint', async () => {
    const demoVisites = new VisitesService(
      prisma as unknown as PrismaService,
      new FakeDemo(true) as unknown as DemoVisibilityService,
    );
    await demoVisites.create(
      { date: '2026-01-06', visitorName: 'FICTIF', entrepriseId: CPI.id, objetId: SUIVI.id },
      ACCUEIL,
    );
    await inscrire({});

    expect((await stats.compute({ from: '2026-01-01', to: '2026-01-31' })).total).toBe(1);
  });

  it('refuse une période inversée ou trop large plutôt que de tout charger', async () => {
    await expect(stats.compute({ from: '2026-02-01', to: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(stats.compute({ from: '2020-01-01', to: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
