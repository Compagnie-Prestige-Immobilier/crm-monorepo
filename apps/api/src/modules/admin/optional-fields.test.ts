import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateUserDto } from '../users/dto.js';
import { UpdateNotificationTemplateDto } from '../notifications/dto.js';

describe('effacement des champs facultatifs', () => {
  it.each([
    ['département du compte', UpdateUserDto, 'departementId'],
    ['lien du gabarit', UpdateNotificationTemplateDto, 'route'],
  ] as const)('accepte la valeur vide pour %s', async (_label, Dto, field) => {
    const input = plainToInstance(Dto, { [field]: '' });

    expect(await validate(input)).toEqual([]);
  });
});
