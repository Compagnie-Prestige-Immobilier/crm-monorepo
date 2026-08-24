import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CreateVisiteDto, UpdateDispositionDto, VisiteStatsQueryDto } from './dto.js';

const validate = async (metatype: new () => object, value: unknown): Promise<void> => {
  await new ValidationPipe({ transform: true, whitelist: true }).transform(value, {
    type: 'body',
    metatype,
  });
};

const validateForbidding = async (metatype: new () => object, value: unknown): Promise<void> => {
  await new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }).transform(value, { type: 'body', metatype });
};

describe('dates du registre des visites', () => {
  it('refuse un jour qui n’existe pas dans le calendrier', async () => {
    await expect(
      validate(CreateVisiteDto, {
        date: '2026-02-31',
        visitorName: 'Awa Ndiaye',
        entrepriseId: '0198a000-0000-7000-8000-000000000001',
        objetId: '0198a000-0000-7000-8000-000000000002',
      }),
    ).rejects.toBeDefined();

    await expect(
      validate(VisiteStatsQueryDto, { from: '2026-02-29', to: '2026-03-01' }),
    ).rejects.toBeDefined();
  });
});

describe('disposition du tableau de bord', () => {
  it('rejette la requête entière sur une clé inconnue dans un élément', async () => {
    await expect(
      validateForbidding(UpdateDispositionDto, {
        widgets: [{ source: 'par-jour', couleurPreferee: 'bleu' }],
      }),
    ).rejects.toBeDefined();
  });

  it('rejette une source inventée', async () => {
    await expect(
      validateForbidding(UpdateDispositionDto, { widgets: [{ source: 'source-inventee' }] }),
    ).rejects.toBeDefined();
  });

  it('rejette `version`, fixée par le serveur', async () => {
    await expect(
      validateForbidding(UpdateDispositionDto, {
        version: 1,
        widgets: [{ source: 'par-jour' }],
      }),
    ).rejects.toBeDefined();
  });

  it('accepte une disposition valide', async () => {
    await expect(
      validateForbidding(UpdateDispositionDto, {
        preset: 'essentiel',
        widgets: [{ source: 'par-jour', marque: 'courbe', taille: 'demi' }],
      }),
    ).resolves.toBeUndefined();
  });
});
