import { describe, expect, it } from 'vitest';

import { DatabaseDumpSection } from '@/components/settings/database-dump-section';

/**
 * La carte d'export n'existe QUE si le déploiement l'a demandée.
 *
 * Le test appelle la fonction au lieu de la monter : ce qu'il faut garder est
 * la DÉCISION, pas le rendu de la carte, qui a ses propres essais. Monter le
 * cas « allumé » exigerait un `QueryClientProvider` et une doublure de l'API,
 * c'est-à-dire beaucoup de montage pour vérifier une condition.
 *
 * La contre-épreuve (« allumé ») compte autant que le cas nominal : une
 * enveloppe qui rendrait toujours `null` cacherait la carte à tout le monde, y
 * compris là où la fonctionnalité est légitimement active, et le seul test
 * « éteint » passerait sans rien dire.
 */
describe('DatabaseDumpSection', () => {
  it('ne rend rien quand l’environnement ne dit rien', () => {
    // Sans propriété : c'est le défaut `process.env.DB_DUMP_ENABLED`, absent
    // sous Vitest, donc exactement le cas d'un déploiement qui n'a rien posé.
    expect(DatabaseDumpSection({})).toBeNull();
  });

  it('ne rend rien sur la chaîne « false »', () => {
    expect(DatabaseDumpSection({ enabled: 'false' })).toBeNull();
  });

  /**
   * `Boolean('0')` vaut `true`, et une coercition laisserait donc passer cette
   * valeur-là. On épingle le littéral.
   */
  it('ne rend rien sur une valeur approchante', () => {
    expect(DatabaseDumpSection({ enabled: '0' })).toBeNull();
    expect(DatabaseDumpSection({ enabled: 'TRUE' })).toBeNull();
    expect(DatabaseDumpSection({ enabled: '1' })).toBeNull();
  });

  it('rend la carte quand le déploiement l’a explicitement activée', () => {
    expect(DatabaseDumpSection({ enabled: 'true' })).not.toBeNull();
  });
});
