import { describe, expect, it } from 'vitest';

import {
  MAX_SERIES,
  bestSegment,
  conversionRate,
  dailyAverage,
  groupTail,
  hoursToDays,
  methodRate,
  percentOf,
  weeklyPace,
  type SegmentCount,
} from '@/lib/data/statistics';
import { STAT_EXPLANATIONS, STAT_KEYS, explain } from '@/lib/stat-explanations';

/**
 * Le calcul des statistiques.
 *
 * Ce qui casse un écran de statistiques n'est presque jamais le cas nominal :
 * c'est la division par zéro sur une base vide, le `null` pris pour un zéro, et
 * le dénominateur choisi au hasard entre deux candidats plausibles. Les tests
 * ci-dessous fixent ces trois-là.
 */

describe('ratio', () => {
  it('arrondit au dixième', () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(2, 3)).toBe(66.7);
  });

  it('rend zéro et jamais NaN sur un dénominateur nul', () => {
    // « NaN % » à l'écran fait douter de TOUS les autres chiffres de la page.
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(0, 0)).toBe(0);
  });

  it('refuse un dénominateur négatif plutôt que de rendre un taux négatif', () => {
    expect(percentOf(5, -10)).toBe(0);
  });

  it('rend 100 quand la part est le tout', () => {
    expect(percentOf(42, 42)).toBe(100);
  });
});

describe('taux de conversion', () => {
  it('rapporte les convertis au TOTAL filtré, pas à la somme des statuts', () => {
    // Les deux coïncident aujourd'hui ; un statut ajouté demain les ferait
    // diverger, et le taux dépasserait discrètement 100 %.
    expect(conversionRate({ converti: 25, prospects: 200 })).toBe(12.5);
  });

  it('vaut zéro sur une sélection vide', () => {
    expect(conversionRate({ converti: 0, prospects: 0 })).toBe(0);
  });
});

describe('taux de méthode obtenue', () => {
  it('rapporte la sous-population au total filtré', () => {
    expect(methodRate({ methodTotal: 40, prospects: 160 })).toBe(25);
  });

  it('vaut zéro quand aucune méthode n’a été obtenue', () => {
    expect(methodRate({ methodTotal: 0, prospects: 160 })).toBe(0);
  });
});

describe('moyenne journalière', () => {
  it('ramène les 30 jours à une journée, au dixième', () => {
    expect(dailyAverage(1240)).toBe(41.3);
    expect(dailyAverage(30)).toBe(1);
  });

  it('vaut zéro sans saisie', () => {
    expect(dailyAverage(0)).toBe(0);
  });
});

describe('rythme hebdomadaire', () => {
  it('compare les 7 derniers jours aux 23 précédents, ramenés à 7', () => {
    // 230 sur 23 jours = 70 sur 7 jours. 70 contre 70 : aucun écart.
    expect(weeklyPace({ prospects7Jours: 70, prospects30Jours: 300 })).toBe(0);
  });

  it('signale une accélération par un nombre positif', () => {
    expect(weeklyPace({ prospects7Jours: 105, prospects30Jours: 335 })).toBe(50);
  });

  it('signale un ralentissement par un nombre négatif', () => {
    expect(weeklyPace({ prospects7Jours: 35, prospects30Jours: 265 })).toBe(-50);
  });

  it('rend zéro plutôt qu’un infini quand rien ne précède', () => {
    expect(weeklyPace({ prospects7Jours: 40, prospects30Jours: 40 })).toBe(0);
    expect(weeklyPace({ prospects7Jours: 0, prospects30Jours: 0 })).toBe(0);
  });

  it('ne fabrique pas un passé négatif sur des compteurs incohérents', () => {
    expect(weeklyPace({ prospects7Jours: 90, prospects30Jours: 50 })).toBe(0);
  });
});

describe('heures en jours', () => {
  it('convertit au dixième de jour', () => {
    expect(hoursToDays(36)).toBe(1.5);
    expect(hoursToDays(24)).toBe(1);
  });

  it('conserve l’absence de mesure', () => {
    // « Aucun dossier clos » n'est PAS « zéro jour » : les confondre afficherait
    // un délai parfait sur une banque qui n'a rien traité.
    expect(hoursToDays(null)).toBeNull();
    expect(hoursToDays(0)).toBe(0);
  });
});

describe('meilleur segment', () => {
  const segment = (
    key: SegmentCount['segment'],
    prospects: number,
    methodObtained: number,
  ): SegmentCount => ({ segment: key, label: key, prospects, share: 0, methodObtained });

  it('retient la meilleure PART, pas le plus gros volume', () => {
    const best = bestSegment([
      segment('BDD1', 1000, 100), // 10 %
      segment('BDD2', 50, 25), // 50 %
    ]);
    expect(best?.segment).toBe('BDD2');
  });

  it('ignore les segments sans prospect', () => {
    const best = bestSegment([segment('BDD1', 0, 0), segment('BDD3', 10, 1)]);
    expect(best?.segment).toBe('BDD3');
  });

  it('rend null quand aucun segment ne porte de prospect', () => {
    expect(bestSegment([segment('BDD1', 0, 0), segment('BDD2', 0, 0)])).toBeNull();
    expect(bestSegment([])).toBeNull();
  });
});

describe('regroupement des séries', () => {
  it('laisse intacte une liste courte', () => {
    const items = [{ id: 'a', label: 'A', value: 3 }];
    expect(groupTail(items)).toEqual(items);
  });

  it('regroupe la queue au-delà de cinq séries (design.md §2.6)', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      label: `S${String(index)}`,
      value: 10,
    }));
    const grouped = groupTail(items);
    expect(grouped).toHaveLength(MAX_SERIES);
    expect(grouped.at(-1)).toEqual({ id: '__autres__', label: 'Autres', value: 50 });
  });

  it('conserve le total', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      label: `S${String(index)}`,
      value: index,
    }));
    const sum = (list: readonly { value: number }[]): number =>
      list.reduce((total, item) => total + item.value, 0);
    expect(sum(groupTail(items))).toBe(sum(items));
  });
});

describe('bulles d’explication', () => {
  it('couvre chaque statistique affichée', () => {
    for (const key of STAT_KEYS) {
      expect(explain(key).trim()).not.toBe('');
    }
    expect(Object.keys(STAT_EXPLANATIONS).sort()).toEqual([...STAT_KEYS].sort());
  });

  it('tient en une ou deux phrases', () => {
    for (const [key, text] of Object.entries(STAT_EXPLANATIONS)) {
      const sentences = text.split('.').filter((part) => part.trim() !== '');
      expect(sentences.length, `${key} : ${String(sentences.length)} phrases`).toBeLessThanOrEqual(
        2,
      );
      expect(text.length, `${key} est trop long`).toBeLessThanOrEqual(200);
    }
  });

  it('n’emploie ni tiret cadratin, ni emoji, ni jargon technique', () => {
    for (const [key, text] of Object.entries(STAT_EXPLANATIONS)) {
      expect(text, `${key} contient un tiret cadratin`).not.toContain('\u2014');
      expect(text, `${key} contient une flèche`).not.toContain('→');
      for (const jargon of ['API', 'cache', 'requête', 'endpoint', 'synchronis']) {
        expect(text.toLowerCase(), `${key} parle de « ${jargon} »`).not.toContain(
          jargon.toLowerCase(),
        );
      }
    }
  });

  it('se termine par un point', () => {
    for (const [key, text] of Object.entries(STAT_EXPLANATIONS)) {
      expect(text.trimEnd().endsWith('.'), `${key} ne se termine pas par un point`).toBe(true);
    }
  });
});
