import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RepresentantRelation } from '@crm/database';

import { RepresentantExportQueryDto, RepresentantQueryDto } from './dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const QUERY: ArgumentMetadata = { type: 'query', metatype: undefined };

const through = async <T>(metatype: new () => T, query: Record<string, string>): Promise<T> =>
  (await pipe.transform(query, { ...QUERY, metatype })) as T;

describe('RepresentantQueryDto.relationStatus', () => {
  it('accepte une valeur seule', async () => {
    const dto = await through(RepresentantQueryDto, {
      relationStatus: RepresentantRelation.AMBASSADEUR,
    });

    expect(dto.relationStatus).toEqual([RepresentantRelation.AMBASSADEUR]);
  });

  it('accepte plusieurs valeurs séparées par des virgules', async () => {
    const dto = await through(RepresentantQueryDto, {
      relationStatus: 'CONTACTE,AMBASSADEUR,REFUS',
    });

    expect(dto.relationStatus).toEqual([
      RepresentantRelation.CONTACTE,
      RepresentantRelation.AMBASSADEUR,
      RepresentantRelation.REFUS,
    ]);
  });

  it('reste indéfini quand le paramètre est absent', async () => {
    const dto = await through(RepresentantQueryDto, {});

    expect(dto.relationStatus).toBeUndefined();
  });

  it('refuse un état inconnu, seul ou dans la liste', async () => {
    await expect(through(RepresentantQueryDto, { relationStatus: 'BOGUS' })).rejects.toThrow(
      'Bad Request Exception',
    );
    await expect(
      through(RepresentantQueryDto, { relationStatus: 'CONTACTE,BOGUS' }),
    ).rejects.toThrow('Bad Request Exception');
  });
});

/** L'export et les lots d'appels bornent un périmètre : une liste l'élargirait. */
describe('RepresentantExportQueryDto.relationStatus', () => {
  it('n’admet qu’un seul état', async () => {
    await expect(
      through(RepresentantExportQueryDto, { relationStatus: 'CONTACTE,REFUS' }),
    ).rejects.toThrow('Bad Request Exception');

    const dto = await through(RepresentantExportQueryDto, {
      relationStatus: RepresentantRelation.REFUS,
    });
    expect(dto.relationStatus).toBe(RepresentantRelation.REFUS);
  });
});
