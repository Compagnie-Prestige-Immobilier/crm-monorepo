import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateUserDto } from '../users/dto.js';
import { UpdateNotificationTemplateDto } from '../notifications/dto.js';

describe('effacement des champs facultatifs', () => {
  it.each([
    ['département du compte', UpdateUserDto, 'departementId'],
    ['lien du gabarit', UpdateNotificationTemplateDto, 'route'],
  ])('accepte la valeur vide pour %s', async (_label, Dto, field) => {
    // `it.each` rend une UNION des deux constructeurs, qui n'a aucune propriete
    // commune : `plainToInstance` ne peut pas l'inferer. Le test ne verifie que
    // la validation, la forme rendue ne sert a rien ici.
    const input = plainToInstance(Dto as ClassConstructor<object>, { [field]: '' });

    expect(await validate(input)).toEqual([]);
  });
});
