import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { FakeVisitesPrisma, fakeRef } from './fake-visites-prisma.js';
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
const AUTRE_ACCUEIL = 'usr-accueil-2';

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
    prisma.users = [
      { id: ACCUEIL, fullName: 'Awa Sy' },
      { id: AUTRE_ACCUEIL, fullName: 'Moussa Diop' },
    ];

    visites = new VisitesService(prisma as unknown as PrismaService);
    stats = new VisitesStatsService(prisma as unknown as PrismaService);
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

  it('refuse une période inversée ou trop large plutôt que de tout charger', async () => {
    await expect(stats.compute({ from: '2026-02-01', to: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(stats.compute({ from: '2020-01-01', to: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('range une visite de 23h45 le 31 décembre dans la bonne heure et le bon jour, à Dakar', async () => {
    await inscrire({ date: '2025-12-31', time: '23:45' });

    const result = await stats.compute({ from: '2025-12-01', to: '2026-01-01' });

    expect(result.parHeure.find((bucket) => bucket.hour === 23)?.count).toBe(1);
    expect(result.parJourSemaine.find((bucket) => bucket.weekday === 3)?.count).toBe(1);
  });

  it('exclut du parHeure les visites sans heure relevée, et les compte à part', async () => {
    await inscrire({ date: '2026-01-06', time: '09:00' });
    await inscrire({ date: '2026-01-06' });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.parHeure.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(result.sansHeure).toBe(1);
  });

  it('lundi vaut 1, dans parJourSemaine', async () => {
    await inscrire({ date: '2026-01-05' });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-11' });

    expect(result.parJourSemaine.find((bucket) => bucket.count > 0)?.weekday).toBe(1);
  });

  it('la somme d’un croisement égale le total moins les dimensions nulles', async () => {
    await inscrire({ directionId: COMMERCIALE.id, destinataireId: NDOYE.id });
    await inscrire({ directionId: COMMERCIALE.id });
    await inscrire({});

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    const total = result.parDestinataireDirection.reduce((sum, cell) => sum + cell.count, 0);
    expect(total).toBe(result.total - 2);
  });

  it('compte les visites par agent d’accueil, avec son nom', async () => {
    await inscrire({});
    await inscrire({});
    await visites.create(
      { date: '2026-01-06', visitorName: 'AUTRE', entrepriseId: CPI.id, objetId: SUIVI.id },
      AUTRE_ACCUEIL,
    );

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    const parAgent = Object.fromEntries(result.parAgent.map((agent) => [agent.label, agent.count]));
    expect(parAgent).toEqual({ 'Awa Sy': 2, 'Moussa Diop': 1 });
  });

  it('regroupe les récurrents par téléphone puis par nom normalisé, sans jamais rendre de numéro', async () => {
    await inscrire({ date: '2026-01-05', visitorName: 'Fatou Ndiaye', phone: '77 123 45 67' });
    await inscrire({ date: '2026-01-12', visitorName: 'Fatou Ndiaye', phone: '77 123 45 67' });
    await inscrire({ date: '2026-01-06', visitorName: 'Modou Fall' });
    await inscrire({ date: '2026-01-20', visitorName: 'MODOU   FALL' });
    await inscrire({ date: '2026-01-07', visitorName: 'Visiteur Seul' });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.recurrents).toHaveLength(2);
    const noms = result.recurrents.map((entry) => entry.nom).sort();
    expect(noms).toEqual(['Fatou Ndiaye', 'MODOU   FALL']);
    expect(JSON.stringify(result)).not.toMatch(/77.?123.?45.?67|\+221771234567/);
  });

  it('compte les visites portant un numéro, sans l’exposer', async () => {
    await inscrire({ phone: '77 123 45 67' });
    await inscrire({});

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });
    expect(result.avecTelephone).toBe(1);
  });

  it('classe la saisie différée : le jour même, le lendemain, plus tard', async () => {
    await inscrire({ date: '2026-01-06' });
    await inscrire({ date: '2026-01-06' });
    await inscrire({ date: '2026-01-06' });

    const createdAts = [
      new Date('2026-01-06T10:00:00Z'),
      new Date('2026-01-07T10:00:00Z'),
      new Date('2026-01-10T10:00:00Z'),
    ];
    prisma.visites.forEach((row, index) => {
      const createdAt = createdAts[index];
      if (createdAt !== undefined) row.createdAt = createdAt;
    });

    const result = await stats.compute({ from: '2026-01-01', to: '2026-01-31' });

    expect(result.saisieDifferee.memeJour).toBe(1);
    expect(result.saisieDifferee.lendemain).toBe(1);
    expect(result.saisieDifferee.plusTard).toBe(1);
    expect(result.saisieDifferee.delaiMedianHeures).not.toBeNull();
  });
});
