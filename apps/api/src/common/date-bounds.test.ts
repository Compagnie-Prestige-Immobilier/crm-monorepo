import { describe, expect, it } from 'vitest';

import { inclusiveDateFrom, inclusiveDateTo } from './date-bounds.js';

describe('bornes de date incluses', () => {
  // Régression : `@IsISO8601()` accepte une date nue, et `new Date('2026-08-13')`
  // vaut MINUIT UTC. Comparée en `<=`, cette borne excluait les 24 heures du
  // 13 août : tout chiffre filtré « jusqu'à aujourd'hui » perdait la journée en
  // cours, en silence.
  it('une date nue en borne haute couvre la journée entière', () => {
    const bound = inclusiveDateTo('2026-08-13');

    expect(bound.toISOString()).toBe('2026-08-13T23:59:59.999Z');
    // Une saisie de l'après midi du 13 doit tomber DANS la borne.
    expect(new Date('2026-08-13T17:30:00.000Z').getTime()).toBeLessThanOrEqual(bound.getTime());
    // Le 14 reste dehors.
    expect(new Date('2026-08-14T00:00:00.000Z').getTime()).toBeGreaterThan(bound.getTime());
  });

  it('une date nue en borne basse part du premier instant de la journée', () => {
    const bound = inclusiveDateFrom('2026-08-13');

    expect(bound.toISOString()).toBe('2026-08-13T00:00:00.000Z');
    expect(new Date('2026-08-13T00:00:00.000Z').getTime()).toBeGreaterThanOrEqual(bound.getTime());
  });

  // Un appelant qui donne un instant précis a dit ce qu'il voulait : le
  // déplacer en fin de journée élargirait son filtre à son insu.
  it('un instant complet n’est pas déplacé', () => {
    expect(inclusiveDateTo('2026-08-13T14:30:00.000Z').toISOString()).toBe(
      '2026-08-13T14:30:00.000Z',
    );
    expect(inclusiveDateFrom('2026-08-13T14:30:00.000Z').toISOString()).toBe(
      '2026-08-13T14:30:00.000Z',
    );
  });

  // Le découpage des journées est celui de Dakar, pas celui du serveur : un
  // conteneur déployé ailleurs rangerait sinon les mêmes fiches dans des jours
  // différents selon l'endroit du déploiement.
  it('la journée est celle de Dakar, quel que soit le fuseau du serveur', () => {
    // Dakar est à GMT toute l'année : la fin de journée murale coïncide donc
    // avec la fin de journée UTC. Le test vaut comme garde si la règle change.
    const janvier = inclusiveDateTo('2026-01-15');
    const juillet = inclusiveDateTo('2026-07-15');

    expect(janvier.toISOString()).toBe('2026-01-15T23:59:59.999Z');
    expect(juillet.toISOString()).toBe('2026-07-15T23:59:59.999Z');
  });
});
