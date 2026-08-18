import { describe, expect, it } from 'vitest';

import { CBAO_SHORT_NAME, CHUES_SIGLE, classifySegment } from '@/components/prospects/segment';
import { BDD_SEGMENTS, SEGMENT_LABELS } from '@/lib/types';

describe('croisement syndicat × banque, côté panel', () => {
  const AUTRE_SIGLE = 'SAES';
  const AUTRE_BANQUE = 'BHS';

  it('range chaque combinaison dans la case que son libellé décrit', () => {
    expect(classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: CBAO_SHORT_NAME })).toBe(
      'BDD1',
    );
    expect(classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: AUTRE_BANQUE })).toBe(
      'BDD2',
    );
    expect(classifySegment({ syndicatSigle: AUTRE_SIGLE, banqueShortName: CBAO_SHORT_NAME })).toBe(
      'BDD3',
    );
    expect(classifySegment({ syndicatSigle: AUTRE_SIGLE, banqueShortName: AUTRE_BANQUE })).toBe(
      'BDD4',
    );
  });

  it('les quatre segments sont produits, et chacun une seule fois', () => {
    const produced = [
      classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: CBAO_SHORT_NAME }),
      classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: AUTRE_BANQUE }),
      classifySegment({ syndicatSigle: AUTRE_SIGLE, banqueShortName: CBAO_SHORT_NAME }),
      classifySegment({ syndicatSigle: AUTRE_SIGLE, banqueShortName: AUTRE_BANQUE }),
    ];

    expect([...produced].sort()).toEqual([...BDD_SEGMENTS].sort());

    for (const segment of produced) {
      const label = SEGMENT_LABELS[segment];
      expect(label.startsWith(`${segment} : `)).toBe(true);
    }

    expect(SEGMENT_LABELS.BDD1).toContain(CHUES_SIGLE);
    expect(SEGMENT_LABELS.BDD1).toContain(CBAO_SHORT_NAME);
    expect(SEGMENT_LABELS.BDD4).toContain('autre syndicat');
    expect(SEGMENT_LABELS.BDD4).toContain('autre banque');
  });
});
