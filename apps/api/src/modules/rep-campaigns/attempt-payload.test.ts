import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RepCallOutcome, RepresentantRelation, WhatsappStatus } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { CreateRepCallAttemptDto } from './dto.js';

/** Mêmes réglages que `bootstrap.ts` : un champ inconnu rejette le LOT ENTIER. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = (payload: Record<string, unknown>): Promise<unknown> =>
  pipe.transform(payload, { type: 'body', metatype: CreateRepCallAttemptDto });

const ANCIEN_LOT = {
  id: '018f2a1c-0000-7000-8000-000000000001',
  representantId: '018f2a1c-0000-7000-8000-000000000002',
  outcome: RepCallOutcome.REACHED,
  clientCreatedAt: '2026-08-01T10:00:00.000Z',
};

describe('ce que la tentative représentant accepte', () => {
  it('un lot d’une version antérieure, SANS aucun des nouveaux champs, reste accepté', async () => {
    await expect(validate({ ...ANCIEN_LOT })).resolves.toMatchObject({
      whatsappStatus: undefined,
      whatsappE164: undefined,
      profession: undefined,
    });
  });

  it('un champ inconnu reste refusé', async () => {
    await expect(validate({ ...ANCIEN_LOT, whatsappHandle: '@moi' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('porte le WhatsApp et la profession quand l’appel les a recueillis', async () => {
    await expect(
      validate({
        ...ANCIEN_LOT,
        whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
        whatsappE164: '78 000 00 01',
        profession: 'Enseignant',
      }),
    ).resolves.toMatchObject({
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: '78 000 00 01',
      profession: 'Enseignant',
    });
  });

  it('chaque champ voyage SEUL : un appel coupé n’a pas à être complet', async () => {
    const partiels = [
      { relationStatus: RepresentantRelation.REFUS },
      { whatsappStatus: WhatsappStatus.MEME_NUMERO },
      { whatsappStatus: WhatsappStatus.AUCUN },
      { profession: 'Comptable' },
      { suggestedPhone: '77 987 65 43' },
    ];

    for (const partiel of partiels) {
      await expect(validate({ ...ANCIEN_LOT, ...partiel })).resolves.toMatchObject(partiel);
    }
  });

  it('refuse un état WhatsApp hors de l’énumération', async () => {
    await expect(validate({ ...ANCIEN_LOT, whatsappStatus: 'PEUT_ETRE' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
