import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';

import {
  PrismaExceptionFilter,
  isPrismaKnownError,
  mapPrismaError,
} from './prisma-exception.filter.js';

const hostWith = (code: ReturnType<typeof vi.fn>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1', method: 'POST', url: '/api/v1/prospects' }),
      getResponse: () => ({ code }),
    }),
  }) as unknown as ArgumentsHost;

describe('mapPrismaError', () => {
  it('P2002 → 409 avec les colonnes en conflit', () => {
    expect(mapPrismaError({ code: 'P2002', meta: { target: ['phoneE164'] } })).toEqual({
      statusCode: HttpStatus.CONFLICT,
      code: 'UNIQUE_CONSTRAINT_VIOLATION',
      message: 'Cette valeur existe déjà.',
      target: ['phoneE164'],
    });
  });

  it('P2025 → 404', () => {
    expect(mapPrismaError({ code: 'P2025' })?.statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('P2003 → 400', () => {
    expect(mapPrismaError({ code: 'P2003', meta: { field_name: 'banqueId' } })).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
      target: ['banqueId'],
    });
  });

  it('laisse passer les codes non traduits', () => {
    expect(mapPrismaError({ code: 'P1001' })).toBeUndefined();
  });
});

describe('isPrismaKnownError', () => {
  it('ne confond pas un code applicatif avec un code Prisma', () => {
    expect(isPrismaKnownError({ code: 'PROSPECT_PHONE_CONFLICT' })).toBe(false);
    expect(isPrismaKnownError({ code: 'P2002' })).toBe(true);
    expect(isPrismaKnownError(new Error('boom'))).toBe(false);
  });
});

describe('PrismaExceptionFilter', () => {
  it('sérialise le corps typé et joint le requestId', () => {
    const send = vi.fn();
    const code = vi.fn(() => ({ send }));
    const filter = new PrismaExceptionFilter();

    filter.catch({ code: 'P2002', meta: { target: ['email'] } }, hostWith(code));

    expect(code).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNIQUE_CONSTRAINT_VIOLATION', requestId: 'req-1' }),
    );
  });

  it('délègue au comportement par défaut ce qu’il ne sait pas traduire', () => {
    const filter = new PrismaExceptionFilter();
    const fallback = vi
      .spyOn(
        Object.getPrototypeOf(PrismaExceptionFilter.prototype) as PrismaExceptionFilter,
        'catch',
      )
      .mockImplementation(() => undefined);

    const error = new Error('boom');
    filter.catch(error, hostWith(vi.fn(() => ({ send: vi.fn() }))));

    expect(fallback).toHaveBeenCalledWith(error, expect.anything());
    fallback.mockRestore();
  });
});
