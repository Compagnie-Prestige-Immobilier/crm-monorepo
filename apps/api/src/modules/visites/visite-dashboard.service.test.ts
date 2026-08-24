import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { FakeVisitesPrisma } from './fake-visites-prisma.js';
import { VisiteDashboardService } from './visite-dashboard.service.js';
import { DISPOSITION_USINE } from './dashboard-layout.js';
import type { UpdateDispositionDto } from './dto.js';

const USER = 'usr-accueil';
const ADMIN = 'usr-admin';

describe('disposition du tableau de bord des visites', () => {
  let prisma: FakeVisitesPrisma;
  let service: VisiteDashboardService;

  beforeEach(() => {
    prisma = new FakeVisitesPrisma();
    service = new VisiteDashboardService(prisma as unknown as PrismaService);
  });

  it('rend la disposition d’usine quand rien n’est enregistré', async () => {
    const result = await service.get(USER);
    expect(result.source).toBe('usine');
    expect(result.widgets).toEqual(DISPOSITION_USINE.widgets);
    expect(result.updatedAt).toBeNull();
  });

  it('enregistre et relit la disposition d’un utilisateur', async () => {
    const body: UpdateDispositionDto = {
      preset: 'affluence',
      widgets: [{ source: 'par-jour', marque: 'aire' }],
    };

    const written = await service.put(USER, body);
    expect(written.source).toBe('utilisateur');
    expect(written.widgets).toEqual([{ source: 'par-jour', marque: 'aire' }]);

    const read = await service.get(USER);
    expect(read.source).toBe('utilisateur');
    expect(read.widgets).toEqual([{ source: 'par-jour', marque: 'aire' }]);
  });

  it('retombe sur la disposition par défaut de l’administrateur, en son absence côté utilisateur', async () => {
    await service.putDefault(ADMIN, {
      preset: 'organisation',
      widgets: [{ source: 'par-agent' }],
    });

    const result = await service.get(USER);
    expect(result.source).toBe('defaut');
    expect(result.preset).toBe('organisation');
    expect(result.widgets).toEqual([{ source: 'par-agent', marque: 'barres-horizontales' }]);
  });

  it('une fois la ligne utilisateur supprimée, elle retombe sur le niveau suivant', async () => {
    await service.put(USER, { widgets: [{ source: 'par-jour' }] });
    await service.remove(USER);

    const result = await service.get(USER);
    expect(result.source).toBe('usine');
  });

  it('supprimer une disposition absente ne fait pas échouer', async () => {
    await expect(service.remove(USER)).resolves.toBeUndefined();
  });
});
