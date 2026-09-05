import { describe, expect, it } from 'vitest';

import { DashboardsService } from './dashboards.service.js';
import { FakeDashboardsPrisma } from './fake-dashboards-prisma.js';

const service = (): { service: DashboardsService; prisma: FakeDashboardsPrisma } => {
  const prisma = new FakeDashboardsPrisma();
  return { service: new DashboardsService(prisma.asPrisma()), prisma };
};

describe('la disposition d’un écran, de la sienne à celle d’usine', () => {
  it('sert celle d’usine tant que rien n’a été enregistré', async () => {
    const { service: sut } = service();
    const usine = await sut.get('usr-1', 'chues');

    expect(usine.source).toBe('usine');
    expect(usine.widgets.length).toBeGreaterThan(0);
    expect(usine.updatedAt).toBeNull();
  });

  it('rend ensuite la sienne, puis la reprend au retrait', async () => {
    const { service: sut } = service();

    const saved = await sut.put('usr-1', 'chues', { widgets: [{ source: 'adhesions' }] });
    expect(saved.source).toBe('utilisateur');
    expect(saved.widgets.map((widget) => widget.source)).toEqual(['adhesions']);

    await sut.remove('usr-1', 'chues');
    expect((await sut.get('usr-1', 'chues')).source).toBe('usine');
  });

  // Deux écrans, deux lignes : composer les chiffres CHUES ne doit pas
  // renverser le tableau de bord du registre du même compte.
  it('garde les écrans d’un même compte séparés', async () => {
    const { service: sut } = service();

    await sut.put('usr-1', 'chues', { widgets: [{ source: 'adhesions' }] });
    await sut.put('usr-1', 'visites', { widgets: [{ source: 'par-jour' }] });

    expect((await sut.get('usr-1', 'chues')).widgets.map((w) => w.source)).toEqual(['adhesions']);
    expect((await sut.get('usr-1', 'visites')).widgets.map((w) => w.source)).toEqual(['par-jour']);
  });

  it('écarte à l’enregistrement une source étrangère à l’écran', async () => {
    const { service: sut } = service();

    const saved = await sut.put('usr-1', 'grand-public', {
      widgets: [{ source: 'adhesions' }, { source: 'taux-d-acceptation' }],
    });
    expect(saved.widgets.map((widget) => widget.source)).toEqual(['adhesions']);
  });

  it('sert la disposition de l’administrateur avant celle d’usine', async () => {
    const { service: sut } = service();

    await sut.putDefault('admin-1', 'chues', { widgets: [{ source: 'prospects-notes' }] });
    const lue = await sut.get('usr-1', 'chues');

    expect(lue.source).toBe('defaut');
    expect(lue.widgets.map((widget) => widget.source)).toEqual(['prospects-notes']);
  });
});
