import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { UpdateUserDto } from './dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const BODY: ArgumentMetadata = { type: 'body', metatype: UpdateUserDto };

describe('modification générique d’un compte', () => {
  it('refuse de contourner la route protégée de désactivation', async () => {
    await expect(pipe.transform({ isActive: false }, BODY)).rejects.toMatchObject({
      response: { statusCode: 400 },
    });
  });
});
