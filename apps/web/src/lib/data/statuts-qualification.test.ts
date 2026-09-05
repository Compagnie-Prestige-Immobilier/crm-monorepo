import { describe, expect, it } from 'vitest';

import {
  estAbouti,
  libelleStatut,
  statutsDeLaBranche,
  type StatutQualification,
  type StatutQualificationEffect,
} from '@/lib/data/statuts-qualification';

const statut = (
  code: string,
  label: string,
  effect: StatutQualificationEffect,
): StatutQualification => ({
  id: code,
  code,
  label,
  effect,
  requiresCallback: false,
  retryAfterMinutes: null,
  priorite: 'NORMALE',
  relationStatus: null,
  isActive: true,
  isSystem: true,
  minPayloadVersion: 6,
  updatedAt: '2026-09-05T00:00:00.000Z',
});

const REFERENTIEL = [
  statut('ACCEPTE', 'Accepté', 'REACHED'),
  statut('REFUSE', 'Refusé', 'REFUSED'),
  statut('A_RAPPELER', 'À rappeler', 'SCHEDULE_CALLBACK'),
  statut('FAUX_NUMERO', 'Faux numéro', 'WRONG_NUMBER'),
  statut('AUTRE_JOINT', 'Autre joint', 'REACHED'),
  statut('PAS_DE_REPONSE', 'Pas de réponse', 'UNREACHABLE'),
  statut('AUTRE_NON_JOINT', 'Autre non joint', 'UNREACHABLE'),
];

const codesDe = (abouti: boolean): string[] =>
  statutsDeLaBranche(REFERENTIEL, abouti).map((ligne) => ligne.code);

describe('familles de statuts de qualification', () => {
  it('range un mauvais numéro parmi les joints', () => {
    expect(estAbouti('WRONG_NUMBER')).toBe(true);
    expect(codesDe(true)).toContain('FAUX_NUMERO');
    expect(codesDe(false)).not.toContain('FAUX_NUMERO');
  });

  it('ne propose « À rappeler » que du côté joint', () => {
    expect(codesDe(true)).toContain('A_RAPPELER');
    expect(codesDe(false)).not.toContain('A_RAPPELER');
  });

  it('partage le référentiel entre deux branches disjointes', () => {
    expect(codesDe(true)).toEqual([
      'ACCEPTE',
      'REFUSE',
      'A_RAPPELER',
      'FAUX_NUMERO',
      'AUTRE_JOINT',
    ]);
    expect(codesDe(false)).toEqual(['PAS_DE_REPONSE', 'AUTRE_NON_JOINT']);
  });

  it('affiche « Autre » sous l’en-tête qui dit déjà la famille', () => {
    expect(libelleStatut(statut('AUTRE_JOINT', 'Autre joint', 'REACHED'))).toBe('Autre');
    expect(libelleStatut(statut('AUTRE_NON_JOINT', 'Autre non joint', 'UNREACHABLE'))).toBe(
      'Autre',
    );
    expect(libelleStatut(statut('ACCEPTE', 'Accepté', 'REACHED'))).toBe('Accepté');
  });
});
