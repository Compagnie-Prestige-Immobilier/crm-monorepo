import { describe, expect, it } from 'vitest';

import { canExportProspects, readsOnly } from '@/lib/types';

describe('canExportProspects', () => {
  it('ouvre l’export aux trois rôles que l’API autorise', () => {
    expect(canExportProspects('ADMIN')).toBe(true);
    expect(canExportProspects('COMMERCIAL')).toBe(true);
    expect(canExportProspects('DIRECTION')).toBe(true);
  });

  it('le refuse aux autres, API comprise', () => {
    expect(canExportProspects('SUPERVISEUR')).toBe(false);
    expect(canExportProspects('BANQUE_FINANCE')).toBe(false);
    expect(canExportProspects('ACCUEIL')).toBe(false);
    expect(canExportProspects(undefined)).toBe(false);
  });

  it('ne se déduit pas de l’écriture : la DIRECTION lit sans écrire, et exporte', () => {
    expect(readsOnly('DIRECTION')).toBe(true);
    expect(canExportProspects('DIRECTION')).toBe(true);
  });
});
