import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { genericCode, normalizeErrorBody } from './normalize.js';

describe('normalisation des corps d’erreur', () => {
  it('complète le statut manquant d’une exception métier, sans rien perdre', () => {
    const body = normalizeErrorBody(HttpStatus.CONFLICT, {
      code: 'BANK_CASE_REFERENCE_TAKEN',
      message: 'Cette référence est déjà utilisée.',
      existing: { id: 'bc-1', reference: 'REF-A' },
    });

    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('BANK_CASE_REFERENCE_TAKEN');
    expect(body.message).toBe('Cette référence est déjà utilisée.');
    expect(body.existing).toEqual({ id: 'bc-1', reference: 'REF-A' });
  });

  it('donne un code générique à une exception qui n’en portait aucun', () => {
    const body = normalizeErrorBody(HttpStatus.NOT_FOUND, {
      statusCode: 404,
      message: 'Aucune version publiée.',
      error: 'Not Found',
    });

    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Aucune version publiée.');
    expect(body.error).toBeUndefined();
  });

  it('traite aussi une charge utile qui n’est qu’une chaîne', () => {
    const body = normalizeErrorBody(HttpStatus.BAD_REQUEST, 'Un fichier APK est requis.');

    expect(body).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Un fichier APK est requis.',
    });
  });

  it('range le tableau de la validation dans details et garde message en CHAÎNE', () => {
    const body = normalizeErrorBody(HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_FAILED',
      message: ['search must be shorter than 120 characters', 'page must be a positive number'],
    });

    expect(typeof body.message).toBe('string');
    expect(body.message).toContain('search must be shorter');
    expect(body.message).toContain('page must be a positive number');
    expect(body.details).toEqual([
      'search must be shorter than 120 characters',
      'page must be a positive number',
    ]);
  });

  it('n’émet jamais une erreur sans phrase', () => {
    expect(normalizeErrorBody(HttpStatus.FORBIDDEN, {}).message).toBe('Une erreur est survenue.');
    expect(normalizeErrorBody(HttpStatus.FORBIDDEN, { message: '' }).code).toBe('FORBIDDEN');
  });

  it('reporte l’identifiant de requête quand il existe, et seulement alors', () => {
    expect(normalizeErrorBody(500, {}, 'req-42').requestId).toBe('req-42');
    expect(normalizeErrorBody(500, {})).not.toHaveProperty('requestId');
  });

  it('couvre les statuts du contrat, et retombe proprement au delà', () => {
    expect(genericCode(HttpStatus.UNPROCESSABLE_ENTITY)).toBe('UNPROCESSABLE_ENTITY');
    expect(genericCode(HttpStatus.TOO_MANY_REQUESTS)).toBe('TOO_MANY_REQUESTS');
    expect(genericCode(500)).toBe('INTERNAL_SERVER_ERROR');
    expect(genericCode(418)).toBe('REQUEST_FAILED');
  });
});
