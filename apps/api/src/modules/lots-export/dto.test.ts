import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LotExportCible, Projet } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { CreateLotExportDto } from './dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const asBody = (value: unknown): Promise<CreateLotExportDto> =>
  pipe.transform(value, {
    type: 'body',
    metatype: CreateLotExportDto,
  }) as Promise<CreateLotExportDto>;

const body = (prospects: Record<string, unknown> | undefined): Record<string, unknown> => ({
  name: 'Campagne du mardi',
  cible: LotExportCible.PROSPECTS,
  ...(prospects === undefined ? {} : { prospects }),
  distribution: { teleconseillerIds: ['01931f3c-1a2b-7c4d-8e5f-000000000001'] },
});

describe('CreateLotExportDto', () => {
  it('accepte un lot de prospects qui nomme son projet', async () => {
    const dto = await asBody(body({ projet: Projet.GRAND_PUBLIC }));

    expect(dto.prospects?.projet).toBe(Projet.GRAND_PUBLIC);
  });

  // Sans projet, `LotExport.projet` retombait à NULL et la campagne n'était
  // plus rattachable à aucune coque.
  it('refuse des critères de prospects sans projet', async () => {
    await expect(asBody(body({ statut: 'NOUVEAU' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un lot de représentants n’a pas de critères de prospects : il est CHUES', async () => {
    const dto = await asBody({ ...body(undefined), cible: LotExportCible.REPRESENTANTS });

    expect(dto.prospects).toBeUndefined();
  });
});
