import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { UpdateDispositionDto } from './dto.js';

const validateForbidding = async (metatype: new () => object, value: unknown): Promise<void> => {
  await new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }).transform(value, { type: 'body', metatype });
};

describe('disposition d’un écran de chiffres', () => {
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

  // Le DTO admet toutes les sources de tous les écrans ; c'est `sanitize` qui
  // écarte celles qui n'appartiennent pas à l'écran demandé.
  it('accepte une source de chiffres de projet', async () => {
    await expect(
      validateForbidding(UpdateDispositionDto, { widgets: [{ source: 'adhesions' }] }),
    ).resolves.toBeUndefined();
  });
});
