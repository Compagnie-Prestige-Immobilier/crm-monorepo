import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ProspectFilterDto } from './prospect-filter.dto.js';
import {
  DeleteQueryDto,
  ImportQueryDto,
  RepresentantQueryDto,
} from '../../modules/representants/dto.js';
import { ReferentielQueryDto } from '../../modules/referentiels/dto.js';
import { UserListQueryDto } from '../../modules/users/dto.js';
import { InboxQueryDto } from '../../modules/notifications/dto.js';
import { RepCampaignPreviewQueryDto } from '../../modules/rep-campaigns/dto.js';
import { IncludeInactiveQueryDto } from '../../modules/bank-cases/dto.js';

/**
 * Le contrôle passe par le VRAI `ValidationPipe`, pas par `plainToInstance`.
 *
 * Le défaut corrigé ici (`Type(() => Boolean)` sur un paramètre de requête)
 * était invisible à tout test qui appelait le service directement avec un
 * booléen déjà construit : le service recevait `true` et se comportait
 * parfaitement. C'est la conversion faite par le pipe, sur la chaîne « false »
 * telle qu'elle arrive dans l'URL, qui retournait le sens. Le test doit donc
 * entrer par la même porte que la requête HTTP, avec la MÊME configuration de
 * pipe que `bootstrap.ts`.
 */

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const QUERY: ArgumentMetadata = { type: 'query', metatype: undefined };

async function through<T>(metatype: new () => T, query: Record<string, string>): Promise<T> {
  return (await pipe.transform(query, { ...QUERY, metatype })) as T;
}

/**
 * Les quatre écritures qui comptent.
 *
 * `'false'` est celle que le web envoie et celle qui produisait l'inverse de
 * ce qu'elle demande. `'0'` et `''` sont les deux autres façons dont une
 * sérialisation d'URL exprime le faux. `'true'` vérifie qu'on n'a pas
 * simplement tout mis à faux.
 */
const CASES: readonly (readonly [string, boolean])[] = [
  ['false', false],
  ['0', false],
  ['', false],
  ['true', true],
  ['1', true],
];

describe('booléens de requête, coercition', () => {
  describe.each([
    ['RepresentantQueryDto.hasProspects', RepresentantQueryDto, 'hasProspects'],
    ['DeleteQueryDto.cascade', DeleteQueryDto, 'cascade'],
    ['ImportQueryDto.dryRun', ImportQueryDto, 'dryRun'],
    ['ReferentielQueryDto.activeOnly', ReferentielQueryDto, 'activeOnly'],
    ['UserListQueryDto.isActive', UserListQueryDto, 'isActive'],
    ['InboxQueryDto.unreadOnly', InboxQueryDto, 'unreadOnly'],
    ['IncludeInactiveQueryDto.includeInactive', IncludeInactiveQueryDto, 'includeInactive'],
    ['ProspectFilterDto.includeDeleted', ProspectFilterDto, 'includeDeleted'],
    [
      'RepCampaignPreviewQueryDto.onlyWithoutProspects',
      RepCampaignPreviewQueryDto,
      'onlyWithoutProspects',
    ],
  ] as const)('%s', (_name, metatype, field) => {
    it.each(CASES)('« %s » vaut %s', async (raw, expected) => {
      const dto = await through(metatype as new () => Record<string, unknown>, { [field]: raw });
      expect(dto[field]).toBe(expected);
    });

    it('reste indéfini quand le paramètre est absent', async () => {
      // Distinct de `false` : plusieurs de ces champs ont un défaut qui n'est
      // PAS faux (`dryRun` vaut vrai, `activeOnly` vaut vrai). Les écraser à
      // faux à l'absence casserait exactement ces défauts.
      const dto = await through(metatype as new () => Record<string, unknown>, {});
      expect(dto[field]).toBeUndefined();
    });
  });
});
