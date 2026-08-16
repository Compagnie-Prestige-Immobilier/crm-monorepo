import { describe, expect, it } from 'vitest';

import { CBAO_SHORT_NAME, CHUES_SIGLE, classifySegment } from '@/components/prospects/segment';
import { BDD_SEGMENTS, SEGMENT_LABELS } from '@/lib/types';

/**
 * La copie du croisement, épinglée sur les LIBELLÉS.
 *
 * Le panel ne peut pas importer `packages/database/src/segment.ts` : rien ne
 * peut donc comparer les deux définitions, et une copie qu'aucun test ne tient
 * finit par dériver sans bruit — l'aperçu montrerait alors un segment d'arrivée
 * faux, et quelqu'un validerait une conversion qu'il n'a pas voulue.
 *
 * `SEGMENT_LABELS` est la seconde recopie du même savoir, et elle nomme les
 * deux axes EN TOUTES LETTRES : « BDD3 : autre syndicat / CBAO ». Elle fait donc
 * un témoin utilisable, et les deux copies ne peuvent plus diverger qu'ensemble.
 */
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

  /**
   * Le contrôle qui survit à une inversion d'axe.
   *
   * Les quatre assertions ci-dessus sont écrites à la main : rien n'empêche de
   * les recopier de travers en même temps que le code. Celui-ci relit les
   * libellés, qui viennent d'ailleurs, et reconstitue la matrice à partir d'eux.
   */
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
      // Un segment CHUES doit le dire, un segment CBAO aussi : c'est ce que le
      // libellé promet à l'utilisateur, et c'est l'axe qu'une inversion
      // casserait.
      expect(label.startsWith(`${segment} : `)).toBe(true);
    }

    expect(SEGMENT_LABELS.BDD1).toContain(CHUES_SIGLE);
    expect(SEGMENT_LABELS.BDD1).toContain(CBAO_SHORT_NAME);
    expect(SEGMENT_LABELS.BDD4).toContain('autre syndicat');
    expect(SEGMENT_LABELS.BDD4).toContain('autre banque');
  });
});
