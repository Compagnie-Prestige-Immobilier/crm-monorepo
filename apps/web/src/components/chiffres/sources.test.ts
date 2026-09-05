import { describe, expect, it } from 'vitest';

import { catalogueDe } from '@/components/chiffres/sources';
import type { Role } from '@/lib/types';

const CARTES_ENROLEMENT = [
  'enrolement-inscriptions',
  'enrolement-taux-rapprochement',
  'enrolement-taux-conversion',
  'enrolement-par-jour',
  'enrolement-par-etape',
  'enrolement-par-teleconseiller',
] as const;

const catalogue = (role: Role, chues: boolean): Record<string, unknown> =>
  catalogueDe({ chues, voitLesMontants: role === 'ADMIN' || role === 'DIRECTION', role });

const AUTRES: readonly Role[] = [
  'DIRECTION',
  'SUPERVISEUR',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'ACCUEIL',
];

describe('les cartes d’enrôlement ne se proposent qu’à la cellule pilotage', () => {
  it.each([true, false])('l’ADMIN les trouve sur les deux écrans (chues=%s)', (chues) => {
    const trouvees = catalogue('ADMIN', chues);
    for (const carte of CARTES_ENROLEMENT) {
      expect(trouvees[carte], carte).toBeDefined();
    }
  });

  it.each(AUTRES)('un compte %s n’en voit AUCUNE', (role) => {
    for (const chues of [true, false]) {
      const trouvees = catalogue(role, chues);
      for (const carte of CARTES_ENROLEMENT) {
        expect(trouvees[carte], `${role}/${String(chues)}/${carte}`).toBeUndefined();
      }
    }
  });

  it('laisse le reste du catalogue intact pour la direction', () => {
    const direction = catalogue('DIRECTION', true);
    expect(direction['adhesions']).toBeDefined();
    expect(direction['par-teleconseiller']).toBeDefined();
  });
});
