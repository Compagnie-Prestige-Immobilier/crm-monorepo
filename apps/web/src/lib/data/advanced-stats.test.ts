import { describe, expect, it } from 'vitest';

import {
  closedPerCommercial,
  closedPerDayTotals,
  estimatedEndLabel,
  formatDelayDays,
} from '@/lib/data/advanced-stats';

/**
 * Les dérivations du volet « Campagnes ».
 *
 * Elles ne recalculent rien que le serveur sache déjà : elles REPLIENT une
 * série servie par (jour, commercial) selon l'axe du graphique affiché. Le
 * risque est donc le repli lui-même, et deux règles de lecture qu'un chiffre
 * seul rendrait faux : « aucune mesure » n'est pas « zéro jour », et « pas de
 * cadence » n'est pas « fini demain ».
 */

const ROWS = [
  { day: '2026-08-10', commercialId: 'c1', commercialName: 'Aminata', done: 12 },
  { day: '2026-08-10', commercialId: 'c2', commercialName: 'Moussa', done: 8 },
  { day: '2026-08-11', commercialId: 'c1', commercialName: 'Aminata', done: 5 },
] as const;

describe('closedPerDayTotals', () => {
  it('replie les commerciaux et garde les jours dans l’ordre', () => {
    expect(closedPerDayTotals(ROWS)).toEqual([
      { day: '2026-08-10', done: 20 },
      { day: '2026-08-11', done: 5 },
    ]);
  });

  it('rend une série vide sans donnée, jamais une ligne à zéro', () => {
    // Une ligne « 0 » sur un graphique de cadence se lit comme une journée
    // travaillée sans résultat, ce qui est faux : il n'y a simplement rien.
    expect(closedPerDayTotals([])).toEqual([]);
  });
});

describe('closedPerCommercial', () => {
  it('cumule les journées et classe du plus avancé au moins avancé', () => {
    expect(closedPerCommercial(ROWS)).toEqual([
      { id: 'c1', label: 'Aminata', value: 17 },
      { id: 'c2', label: 'Moussa', value: 8 },
    ]);
  });
});

describe('formatDelayDays', () => {
  it('distingue « aucune mesure » de « zéro jour »', () => {
    // Les confondre afficherait un délai de traitement parfait sur une chaîne
    // qui n'a rien traité du tout.
    expect(formatDelayDays(null)).toBe('Aucune mesure');
    expect(formatDelayDays(0)).toBe('Moins d’un jour');
  });

  it('arrondit au dixième de journée', () => {
    expect(formatDelayDays(12.34)).toBe('12.3 j');
  });
});

describe('estimatedEndLabel', () => {
  it('ne promet pas de date quand la campagne est à l’arrêt', () => {
    // L'API rend `null` quand la cadence observée est nulle : annoncer une
    // date serait une division par zéro déguisée en prévision.
    expect(estimatedEndLabel(null, 400)).toBe('Aucune cadence observée');
  });

  it('dit que tout est traité plutôt que d’afficher une date passée', () => {
    expect(estimatedEndLabel('2026-08-01', 0)).toBe('Tout est traité');
  });

  it('rend la date projetée quand elle a du sens', () => {
    expect(estimatedEndLabel('2026-09-02', 400)).toBe('2026-09-02');
  });
});
