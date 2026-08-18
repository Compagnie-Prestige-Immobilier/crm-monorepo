import { describe, expect, it } from 'vitest';

import { EMPTY_CAMPAIGN_FILTERS } from '@/lib/campaign-filters';
import {
  buildCampaignPreview,
  programmePdfFileName,
  programmePdfUrl,
  roundRobinSplit,
  spreadIntoDays,
  toCampaignQuery,
} from '@/lib/data/phase2';

describe('roundRobinSplit', () => {
  it('répartit à parts égales quand le compte tombe juste', () => {
    expect(roundRobinSplit(800, 4)).toEqual([200, 200, 200, 200]);
  });

  it('donne une fiche de plus aux premiers, comme le tourniquet du serveur', () => {
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
    expect(preview.perCommercial.reduce((a, b) => a + b, 0)).toBe(preview.maximum);
  });
});

describe('spreadIntoDays', () => {
  it('répartit au plus près, sans reliquat en fin de liasse', () => {
    expect(spreadIntoDays(10, 3)).toEqual([4, 3, 3]);
    const week = spreadIntoDays(800, 7);
    expect(week).toHaveLength(7);
    expect(Math.max(...week) - Math.min(...week)).toBeLessThanOrEqual(1);
  });

  it('somme toujours au total étalé', () => {
    for (const [count, days] of [
      [10, 3],
      [120_000, 7],
      [5, 31],
      [1, 4],
    ] as const) {
      expect(spreadIntoDays(count, days).reduce((a, b) => a + b, 0)).toBe(count);
    }
  });

  it('ne fabrique jamais une journée vide', () => {
    expect(spreadIntoDays(5, 31)).toEqual([1, 1, 1, 1, 1]);
    expect(spreadIntoDays(0, 7)).toEqual([]);
  });

  it('rend une seule tranche sans étalement', () => {
    expect(spreadIntoDays(42, 1)).toEqual([42]);
  });
});

describe('aperçu et étalement', () => {
  it('chiffre la charge du PREMIER commercial, le plus servi par le tourniquet', () => {
    const preview = buildCampaignPreview({
      scope: 'ALL',
      pending: 800,
      alreadyAssigned: 0,
      commercialCount: 3,
      spreadDays: 4,
    });
    expect(preview.perCommercial).toEqual([267, 267, 266]);
    expect(preview.perDay).toEqual([67, 67, 67, 66]);
    expect(preview.perDay.reduce((a, b) => a + b, 0)).toBe(267);
  });

  it('sans étalement, une seule journée', () => {
    const preview = buildCampaignPreview({
      scope: 'ALL',
      pending: 90,
      alreadyAssigned: 0,
      commercialCount: 3,
    });
    expect(preview.spreadDays).toBe(1);
    expect(preview.perDay).toEqual([30]);
  });
});

describe('programme PDF', () => {
  it('vise le relais de Next, pas le backend directement', () => {
    expect(programmePdfUrl('camp-1', 'user-2')).toBe(
      '/api/v1/phase2/campaigns/camp-1/commerciaux/user-2/programme.pdf',
    );
  });

  it('encode les identifiants dans le chemin', () => {
    expect(programmePdfUrl('a/b', 'c d')).toBe(
      '/api/v1/phase2/campaigns/a%2Fb/commerciaux/c%20d/programme.pdf',
    );
  });

  it('n’ajoute `jour` que s’il est demandé', () => {
    expect(programmePdfUrl('camp-1', 'user-2', 3)).toBe(
      '/api/v1/phase2/campaigns/camp-1/commerciaux/user-2/programme.pdf?jour=3',
    );
  });

  it('produit un nom de fichier lisible, sans accent ni espace', () => {
    expect(programmePdfFileName('Campagne CHUES : avril', 'Aminata Diallo')).toBe(
      'programme-campagne-chues-avril-aminata-diallo.pdf',
    );
  });

  it('nomme la journée dans le FICHIER, pas seulement dans le document', () => {
    expect(programmePdfFileName('Campagne avril', 'Aminata Diallo', 3)).toBe(
      'programme-campagne-avril-aminata-diallo-jour-3.pdf',
    );
  });
});

describe('toCampaignQuery', () => {
  it('envoie `createdById`, le nom du contrat, et jamais `createdBy`', () => {
    const query = toCampaignQuery({ ...EMPTY_CAMPAIGN_FILTERS, createdBy: 'admin-1' });
    expect(query.createdById).toBe('admin-1');
    expect(Object.keys(query)).not.toContain('createdBy');
  });

  it('n’écrit que les critères renseignés', () => {
    expect(Object.keys(toCampaignQuery(EMPTY_CAMPAIGN_FILTERS)).sort()).toEqual([
      'page',
      'pageSize',
    ]);
  });

  it('borne la journée entière, sinon `dateTo` exclut le dernier jour', () => {
    const query = toCampaignQuery({
      ...EMPTY_CAMPAIGN_FILTERS,
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });
    expect(query.dateFrom).toBe('2026-04-01T00:00:00.000Z');
    expect(query.dateTo).toBe('2026-04-30T23:59:59.999Z');
  });
});
