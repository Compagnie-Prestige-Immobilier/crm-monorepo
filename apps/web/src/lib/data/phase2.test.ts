import { describe, expect, it } from 'vitest';

import {
  buildCampaignPreview,
  programmePdfFileName,
  programmePdfUrl,
  roundRobinSplit,
} from '@/lib/data/phase2';

/**
 * L'aperçu de création de campagne.
 *
 * C'est le seul écran du panel où un chiffre DOIT être exact avant qu'on
 * clique : le tirage matérialise une tâche par prospect, exclut ces prospects de
 * toute campagne ultérieure, et n'est annulable qu'en clôturant la campagne —
 * ce qui annule aussi les appels déjà en cours chez les commerciaux. Un
 * administrateur qui découvre après coup qu'il a distribué huit cents fiches à
 * trois personnes n'a aucun retour en arrière simple.
 */

describe('roundRobinSplit', () => {
  it('répartit à parts égales quand le compte tombe juste', () => {
    expect(roundRobinSplit(800, 4)).toEqual([200, 200, 200, 200]);
  });

  it('donne une fiche de plus aux premiers, comme le tourniquet du serveur', () => {
    // `distributeRoundRobin` côté API sert les seaux dans l'ordre : avec 800
    // fiches et 3 commerciaux, le premier en reçoit 267 et non « environ 266 ».
    // Annoncer une moyenne ferait mentir l'aperçu sur le programme imprimé.
    expect(roundRobinSplit(800, 3)).toEqual([267, 267, 266]);
    expect(roundRobinSplit(10, 4)).toEqual([3, 3, 2, 2]);
  });

  it('somme toujours au total distribué', () => {
    for (const [total, buckets] of [
      [800, 3],
      [7, 5],
      [1, 4],
      [4210, 11],
    ] as const) {
      expect(roundRobinSplit(total, buckets).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('rend une liste vide sur les cas dégénérés', () => {
    expect(roundRobinSplit(0, 3)).toEqual([]);
    expect(roundRobinSplit(100, 0)).toEqual([]);
  });
});

describe('buildCampaignPreview', () => {
  it('retranche les prospects déjà pris par une campagne en cours', () => {
    // `eligibleForCampaignWhere` exclut côté API tout prospect portant une
    // tâche active : sans cette soustraction, l'aperçu annoncerait un total que
    // le tirage ne produirait jamais.
    const preview = buildCampaignPreview({
      scope: 'BDD1',
      pending: 900,
      alreadyAssigned: 100,
      commercialCount: 4,
    });
    expect(preview.maximum).toBe(800);
    expect(preview.perCommercial).toEqual([200, 200, 200, 200]);
  });

  it('ne descend jamais sous zéro', () => {
    // Les deux chiffres viennent de deux requêtes distinctes : entre les deux,
    // une campagne concurrente peut avoir pris davantage que le total en
    // attente. Un « -12 » à l'écran se lirait comme un bug de l'application.
    const preview = buildCampaignPreview({
      scope: 'ALL',
      pending: 50,
      alreadyAssigned: 200,
      commercialCount: 3,
    });
    expect(preview.maximum).toBe(0);
    expect(preview.perCommercial).toEqual([]);
  });

  it('conserve les deux chiffres bruts pour que l’écran puisse les expliquer', () => {
    // « 800 au maximum » sans décomposition laisse l'administrateur incapable
    // de comprendre pourquoi ce n'est pas 900.
    const preview = buildCampaignPreview({
      scope: 'BDD3',
      pending: 900,
      alreadyAssigned: 100,
      commercialCount: 2,
    });
    expect(preview.pending).toBe(900);
    expect(preview.alreadyAssigned).toBe(100);
    expect(preview.scope).toBe('BDD3');
    expect(preview.commercialCount).toBe(2);
  });

  it('le scénario du cahier des charges : 800 fiches, 3 commerciaux', () => {
    const preview = buildCampaignPreview({
      scope: 'ALL',
      pending: 800,
      alreadyAssigned: 0,
      commercialCount: 3,
    });
    expect(preview.maximum).toBe(800);
    expect(preview.perCommercial).toEqual([267, 267, 266]);
    // Le point de l'écran : ce nombre est VISIBLE avant confirmation.
    expect(preview.perCommercial.reduce((a, b) => a + b, 0)).toBe(preview.maximum);
  });
});

describe('programme PDF', () => {
  it('vise le relais de Next, pas le backend directement', () => {
    // Le jeton vit dans un cookie httpOnly : un `<a href>` vers NestJS partirait
    // anonyme et téléchargerait un 401.
    expect(programmePdfUrl('camp-1', 'user-2')).toBe(
      '/api/v1/phase2/campaigns/camp-1/commerciaux/user-2/programme.pdf',
    );
  });

  it('encode les identifiants dans le chemin', () => {
    expect(programmePdfUrl('a/b', 'c d')).toBe(
      '/api/v1/phase2/campaigns/a%2Fb/commerciaux/c%20d/programme.pdf',
    );
  });

  it('produit un nom de fichier lisible, sans accent ni espace', () => {
    expect(programmePdfFileName('Campagne CHUES — avril', 'Aminata Diallo')).toBe(
      'programme-campagne-chues-avril-aminata-diallo.pdf',
    );
  });
});
