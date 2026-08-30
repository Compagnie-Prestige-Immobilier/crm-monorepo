import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LotExportCible } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { CreateLotExportDto } from './dto.js';
import { repartir } from './repartition.js';

const EQUIPE = [
  '01931f3c-1a2b-7c4d-8e5f-000000000001',
  '01931f3c-1a2b-7c4d-8e5f-000000000002',
  '01931f3c-1a2b-7c4d-8e5f-000000000003',
  '01931f3c-1a2b-7c4d-8e5f-000000000004',
];

const compter = (
  affectations: readonly { assigneeId: string; day: number }[],
  assigneeId: string,
): number => affectations.filter((affectation) => affectation.assigneeId === assigneeId).length;

describe('repartir', () => {
  it('étale 340 fiches sur 4 téléconseillers, 50 par jour, 2 jours', () => {
    const affectations = repartir(340, EQUIPE, 50, 2);

    expect(affectations).toHaveLength(340);
    for (const id of EQUIPE) expect(compter(affectations, id)).toBe(85);
    expect(new Set(affectations.map((affectation) => affectation.day))).toEqual(new Set([1, 2]));
    expect(affectations.filter((affectation) => affectation.day === 1)).toHaveLength(200);
    expect(affectations.filter((affectation) => affectation.day === 2)).toHaveLength(140);
  });

  it('plafonne à ce que la répartition peut absorber', () => {
    const affectations = repartir(1_200, EQUIPE, 50, 2);

    expect(affectations).toHaveLength(400);
    for (const id of EQUIPE) expect(compter(affectations, id)).toBe(100);
    expect(affectations.filter((affectation) => affectation.day === 2)).toHaveLength(200);
  });

  it('sert en tourniquet, dans l’ordre reçu', () => {
    expect(repartir(6, EQUIPE, 50, 1).map((affectation) => affectation.assigneeId)).toEqual([
      EQUIPE[0],
      EQUIPE[1],
      EQUIPE[2],
      EQUIPE[3],
      EQUIPE[0],
      EQUIPE[1],
    ]);
  });

  it('ne retient rien sans équipe', () => {
    expect(repartir(100, [], 50, 1)).toEqual([]);
  });
});

const valider = (distribution: unknown): Promise<unknown> =>
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }).transform(
    { name: 'Lot de test', cible: LotExportCible.REPRESENTANTS, representants: {}, distribution },
    { type: 'body', metatype: CreateLotExportDto },
  );

describe('CreateLotExportDto.distribution', () => {
  it('refuse une équipe vide', async () => {
    await expect(valider({ teleconseillerIds: [] })).rejects.toThrow(BadRequestException);
  });

  it('refuse un identifiant qui n’est pas un UUID', async () => {
    await expect(valider({ teleconseillerIds: ['awa'] })).rejects.toThrow(BadRequestException);
  });

  it('refuse plus de 500 fiches par jour et plus de 10 jours', async () => {
    await expect(valider({ teleconseillerIds: [EQUIPE[0]], fichesParJour: 501 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(valider({ teleconseillerIds: [EQUIPE[0]], jours: 11 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('applique 50 fiches par jour sur 1 jour par défaut', async () => {
    const body = (await valider({ teleconseillerIds: [EQUIPE[0]] })) as CreateLotExportDto;

    expect(body.distribution.fichesParJour).toBe(50);
    expect(body.distribution.jours).toBe(1);
  });
});
