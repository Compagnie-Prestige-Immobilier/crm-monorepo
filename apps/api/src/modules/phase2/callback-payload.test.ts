import { CallOutcome } from '@crm/database';
import { ValidationPipe, type BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CallAttemptOpDto } from './dto.js';

/** Mêmes réglages que `bootstrap.ts` : un champ inconnu rejette le LOT ENTIER. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = (payload: Record<string, unknown>): Promise<unknown> =>
  pipe.transform(payload, { type: 'body', metatype: CallAttemptOpDto });

const ANCIEN_LOT = {
  id: '018f2a1c-0000-7000-8000-000000000001',
  prospectId: '018f2a1c-0000-7000-8000-000000000002',
  outcome: CallOutcome.UNREACHABLE,
  clientCreatedAt: '2026-08-01T10:00:00.000Z',
};

describe('compatibilité du champ callbackAt', () => {
  it('un lot d’une version antérieure, SANS callbackAt, reste accepté', async () => {
    await expect(validate({ ...ANCIEN_LOT })).resolves.toMatchObject({ callbackAt: undefined });
  });

  it('une issue CALLBACK sans date passe aussi : les téléphones déjà posés l’envoient', async () => {
    await expect(validate({ ...ANCIEN_LOT, outcome: CallOutcome.CALLBACK })).resolves.toMatchObject(
      { outcome: CallOutcome.CALLBACK },
    );
  });

  it('la date de rappel est reçue quand elle est là', async () => {
    await expect(
      validate({
        ...ANCIEN_LOT,
        outcome: CallOutcome.CALLBACK,
        callbackAt: '2026-08-02T09:00:00.000Z',
      }),
    ).resolves.toMatchObject({ callbackAt: '2026-08-02T09:00:00.000Z' });
  });

  it('un champ inconnu reste refusé, sans quoi la garde ne servirait à rien', async () => {
    const refus = await validate({ ...ANCIEN_LOT, rappelAt: '2026-08-02T09:00:00.000Z' }).then(
      () => null,
      (error: unknown) => JSON.stringify((error as BadRequestException).getResponse()),
    );

    expect(refus).toContain('rappelAt');
  });

  it('une date de rappel illisible est refusée à la porte', async () => {
    await expect(validate({ ...ANCIEN_LOT, callbackAt: 'demain' })).rejects.toThrow();
  });
});

describe('compatibilité du champ reasonCode', () => {
  it('un lot d’une version antérieure, SANS reasonCode, reste accepté', async () => {
    await expect(validate({ ...ANCIEN_LOT })).resolves.toMatchObject({ reasonCode: undefined });
  });

  it('le motif est reçu quand il est là', async () => {
    await expect(validate({ ...ANCIEN_LOT, reasonCode: 'BOITE_VOCALE' })).resolves.toMatchObject({
      reasonCode: 'BOITE_VOCALE',
    });
  });

  it('un motif plus long que le code du référentiel est refusé à la porte', async () => {
    await expect(validate({ ...ANCIEN_LOT, reasonCode: 'X'.repeat(41) })).rejects.toThrow();
  });
});
