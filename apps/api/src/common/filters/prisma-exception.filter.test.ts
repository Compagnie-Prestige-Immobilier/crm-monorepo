import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
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

  it('P2024 → 503 DATABASE_BUSY', () => {
    expect(mapPrismaError({ code: 'P2024' })).toEqual({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'DATABASE_BUSY',
      message: 'Base momentanément saturée. Réessayez dans quelques instants.',
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

describe('normalisation par le filtre global', () => {
  it('complète le statut d’une exception métier levée par un service', () => {
    const code = vi.fn(() => ({ send: vi.fn() }));
    const send = vi.fn();
    code.mockReturnValue({ send });

    new PrismaExceptionFilter({} as never).catch(
      new ConflictException({ code: 'BANK_CASE_REFERENCE_TAKEN', message: 'Déjà utilisée.' }),
      hostWith(code),
    );

    expect(code).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'BANK_CASE_REFERENCE_TAKEN',
        message: 'Déjà utilisée.',
        requestId: 'req-1',
      }),
    );
  });

  const SOCLE = ['statusCode', 'code', 'message', 'requestId'] as const;

  const bodyOf = (error: unknown): Record<string, unknown> => {
    const send = vi.fn();
    const code = vi.fn().mockReturnValue({ send });
    new PrismaExceptionFilter({} as never).catch(error, hostWith(code));
    return (send.mock.calls[0] as [Record<string, unknown>])[0];
  };

  const FORMES: [string, unknown, number][] = [
    ['erreur Prisma', { code: 'P2002', meta: { target: ['phoneE164'] } }, HttpStatus.CONFLICT],
    [
      'exception objet',
      new ConflictException({ code: 'BANK_CASE_REFERENCE_TAKEN', message: 'Déjà utilisée.' }),
      HttpStatus.CONFLICT,
    ],
    ['exception chaîne', new NotFoundException('Aucune version publiée.'), HttpStatus.NOT_FOUND],
    [
      'tableau de la ValidationPipe',
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: ['page must be a positive number', 'search must be shorter'],
      }),
      HttpStatus.BAD_REQUEST,
    ],
  ];

  it.each(FORMES)('%s converge vers la forme unique', (_nom, error, statut) => {
    const body = bodyOf(error);

    for (const clef of SOCLE) expect(Object.keys(body)).toContain(clef);
    expect(typeof body.message).toBe('string');
    expect(body.message).not.toBe('');
    expect(typeof body.code).toBe('string');
    expect(body.code).not.toBe('');
    expect(body.statusCode).toBe(statut);
    expect(body.requestId).toBe('req-1');

    expect(body).not.toHaveProperty('error');

    const AUTORISES = ['target', 'details'];
    const inconnues = Object.keys(body).filter(
      (clef) => !(SOCLE as readonly string[]).includes(clef) && !AUTORISES.includes(clef),
    );
    expect(inconnues, `clés hors contrat : ${inconnues.join(', ')}`).toEqual([]);
  });

  it('la ValidationPipe garde ses phrases dans details', () => {
    const body = bodyOf(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: ['page must be a positive number', 'search must be shorter'],
      }),
    );

    expect(body.details).toEqual(['page must be a positive number', 'search must be shorter']);
    expect(body.message).toBe('page must be a positive number search must be shorter');
  });

  it('donne un code à une exception construite avec une simple chaîne', () => {
    const send = vi.fn();
    const code = vi.fn().mockReturnValue({ send });

    new PrismaExceptionFilter({} as never).catch(
      new NotFoundException('Aucune version publiée.'),
      hostWith(code),
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'Aucune version publiée.',
      }),
    );
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('error');
  });
});
