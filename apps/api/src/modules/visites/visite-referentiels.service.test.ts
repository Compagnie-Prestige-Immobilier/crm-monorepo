import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { FakeVisitesPrisma, fakeRef } from './fake-visites-prisma.js';
import {
  VisiteReferentielError,
  VisiteReferentielsService,
} from './visite-referentiels.service.js';

describe('listes de l’accueil', () => {
  let prisma: FakeVisitesPrisma;
  let service: VisiteReferentielsService;

  beforeEach(() => {
    prisma = new FakeVisitesPrisma();
    prisma.entreprises = [
      fakeRef({ id: 'ent-cpi', code: 'CPI', label: 'CPI', sortOrder: 1 }),
      fakeRef({ id: 'ent-san', code: 'SANTARGILE', label: 'SANTARGILE', sortOrder: 2 }),
      fakeRef({
        id: 'ent-old',
        code: 'ANCIENNE',
        label: 'ANCIENNE',
        sortOrder: 3,
        isActive: false,
      }),
    ];
    prisma.directions = [fakeRef({ id: 'dir-com', code: 'COMMERCIALE' })];
    prisma.destinataires = [fakeRef({ id: 'dest-ndoye', code: 'NDOYE' })];
    prisma.objets = [fakeRef({ id: 'obj-suivi', code: 'SUIVI_DOSSIER' })];

    service = new VisiteReferentielsService(prisma as unknown as PrismaService);
  });

  it('ne propose que les entrées actives à l’accueil, et les montre toutes à l’administration', async () => {
    const accueil = await service.bundle(true);
    expect(accueil.entreprises.map((entry) => entry.code)).toEqual(['CPI', 'SANTARGILE']);

    const administration = await service.list('entreprises', false);
    expect(administration.items.map((entry) => entry.code)).toEqual([
      'CPI',
      'SANTARGILE',
      'ANCIENNE',
    ]);
  });

  it('sert les quatre listes en un appel', async () => {
    const bundle = await service.bundle(true);
    expect(bundle.directions).toHaveLength(1);
    expect(bundle.destinataires).toHaveLength(1);
    expect(bundle.objets).toHaveLength(1);
  });

  it('ajoute une entrée sur la liste demandée, et sur elle seule', async () => {
    const cree = await service.create('destinataires', { code: 'ba_omar', label: 'M. BA OMAR' });

    expect(cree.code).toBe('BA_OMAR');
    expect(cree.isSystem).toBe(false);
    expect(prisma.destinataires).toHaveLength(2);
    expect(prisma.entreprises).toHaveLength(3);
  });

  it('refuse un code ou un libellé déjà pris', async () => {
    await expect(
      service.create('entreprises', { code: 'CPI', label: 'Autre chose' }),
    ).rejects.toMatchObject({ response: { code: VisiteReferentielError.CODE_CONFLICT } });

    await expect(
      service.create('entreprises', { code: 'CPI_BIS', label: 'CPI' }),
    ).rejects.toMatchObject({ response: { code: VisiteReferentielError.LABEL_CONFLICT } });
  });

  it('renomme sans toucher au code, que le registre référence', async () => {
    const renommee = await service.update('entreprises', 'ent-cpi', { label: 'CPI SA' });
    expect(renommee.code).toBe('CPI');
    expect(renommee.label).toBe('CPI SA');
  });

  it('refuse un renommage qui écraserait un libellé existant', async () => {
    await expect(service.update('entreprises', 'ent-cpi', { label: 'SANTARGILE' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('retire une entrée des listes sans jamais l’effacer', async () => {
    const retiree = await service.setActive('entreprises', 'ent-cpi', { isActive: false });

    expect(retiree.isActive).toBe(false);
    expect(prisma.entreprises).toHaveLength(3);
    expect((await service.bundle(true)).entreprises.map((entry) => entry.code)).toEqual([
      'SANTARGILE',
    ]);
  });

  it('réordonne dans l’ordre demandé', async () => {
    const reordonnee = await service.reorder('entreprises', {
      ids: ['ent-san', 'ent-old', 'ent-cpi'],
    });

    expect(reordonnee.items.map((entry) => entry.code)).toEqual(['SANTARGILE', 'ANCIENNE', 'CPI']);
  });

  it('n’écrit aucun rang quand un identifiant du lot est inconnu', async () => {
    await expect(
      service.reorder('entreprises', { ids: ['ent-san', 'ent-fantome'] }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.entreprises.map((entry) => entry.sortOrder)).toEqual([1, 2, 3]);
  });

  it('valide tout le lot de réordonnancement en une seule lecture', async () => {
    const ids: string[] = [];
    prisma.entreprises = [];
    for (let index = 0; index < 200; index += 1) {
      const id = `ent-${String(index).padStart(3, '0')}`;
      ids.push(id);
      prisma.entreprises.push(fakeRef({ id, code: id.toUpperCase(), sortOrder: index + 1 }));
    }

    let reads = 0;
    const delegate = prisma.visiteEntreprise;
    const findUnique = delegate.findUnique.bind(delegate);
    const findMany = delegate.findMany.bind(delegate);
    delegate.findUnique = (args) => {
      reads += 1;
      return findUnique(args);
    };
    delegate.findMany = (args) => {
      reads += 1;
      return findMany(args);
    };

    await service.reorder('entreprises', { ids });

    expect(reads).toBe(2);
    expect(prisma.entreprises[0]?.sortOrder).toBe(1);
  });

  it('ne trouve pas dans une liste ce qui appartient à une autre', async () => {
    await expect(service.update('objets', 'ent-cpi', { label: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
