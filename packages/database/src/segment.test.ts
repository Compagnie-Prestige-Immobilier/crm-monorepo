import { describe, expect, it } from 'vitest';

import {
  ALL_SEGMENTS,
  CBAO_SHORT_NAME,
  CHUES_SIGLE,
  classifySegment,
  eligibleForCampaignWhere,
  scopeWhere,
  segmentAxes,
  segmentWhere,
} from './segment.js';

const AUTRES_SYNDICATS = ['UES', 'SAEMSS', 'CUSEMS', 'SUTSAS', 'CNTS', 'AUTRE'];
const AUTRES_BANQUES = ['SGS', 'Ecobank', 'BHS', 'BOA Sénégal', 'CMS', 'Autre'];

describe('classifySegment : matrice complète', () => {
  it('CHUES + CBAO donne BDD1', () => {
    expect(classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: CBAO_SHORT_NAME })).toBe(
      'BDD1',
    );
  });

  it('CHUES + toute autre banque donne BDD2', () => {
    for (const banque of AUTRES_BANQUES) {
      expect(classifySegment({ syndicatSigle: CHUES_SIGLE, banqueShortName: banque })).toBe('BDD2');
    }
  });

  it('tout autre syndicat + CBAO donne BDD3', () => {
    for (const syndicat of AUTRES_SYNDICATS) {
      expect(classifySegment({ syndicatSigle: syndicat, banqueShortName: CBAO_SHORT_NAME })).toBe(
        'BDD3',
      );
    }
  });

  it('tout autre syndicat + toute autre banque donne BDD4', () => {
    for (const syndicat of AUTRES_SYNDICATS) {
      for (const banque of AUTRES_BANQUES) {
        expect(classifySegment({ syndicatSigle: syndicat, banqueShortName: banque })).toBe('BDD4');
      }
    }
  });

  it('la comparaison est sensible à la casse : « chues » n’est pas CHUES', () => {
    expect(classifySegment({ syndicatSigle: 'chues', banqueShortName: CBAO_SHORT_NAME })).toBe(
      'BDD3',
    );
  });

  it('la partition est totale et sans recouvrement', () => {
    const syndicats = [CHUES_SIGLE, ...AUTRES_SYNDICATS];
    const banques = [CBAO_SHORT_NAME, ...AUTRES_BANQUES];
    const vus = new Set<string>();

    for (const syndicatSigle of syndicats) {
      for (const banqueShortName of banques) {
        const segment = classifySegment({ syndicatSigle, banqueShortName });
        expect(ALL_SEGMENTS).toContain(segment);
        vus.add(segment);
      }
    }

    expect([...vus].sort()).toEqual([...ALL_SEGMENTS]);
  });
});

describe('segmentWhere : cohérence avec classifySegment', () => {
  it('traduit les mêmes axes que la classification', () => {
    for (const segment of ALL_SEGMENTS) {
      const { isChues, isCbao } = segmentAxes(segment);
      const where = segmentWhere(segment);

      expect(where.syndicat).toEqual(
        isChues ? { sigle: CHUES_SIGLE } : { sigle: { not: CHUES_SIGLE } },
      );
      expect(where.banque).toEqual(
        isCbao ? { shortName: CBAO_SHORT_NAME } : { shortName: { not: CBAO_SHORT_NAME } },
      );
    }
  });

  it('chaque segment contraint les deux axes, jamais un seul', () => {
    for (const segment of ALL_SEGMENTS) {
      const where = segmentWhere(segment);
      expect(where.syndicat).toBeDefined();
      expect(where.banque).toBeDefined();
    }
  });
});

describe('scopeWhere', () => {
  it('ALL ne pose aucune contrainte de segment', () => {
    expect(scopeWhere('ALL')).toEqual({});
  });

  it('un segment nommé délègue à segmentWhere', () => {
    for (const segment of ALL_SEGMENTS) {
      expect(scopeWhere(segment)).toEqual(segmentWhere(segment));
    }
  });
});

describe('eligibleForCampaignWhere', () => {
  it('exclut les supprimés, les non-PENDING, ceux déjà pourvus et ceux déjà attribués', () => {
    const where = eligibleForCampaignWhere('ALL');

    expect(where.deletedAt).toBeNull();
    expect(where.phase2Status).toBe('PENDING');
    expect(where.enrollmentMethod).toBeNull();
    expect(where.callTasks).toEqual({ none: { isActive: true } });
  });

  it('combine le périmètre de segment avec les conditions d’éligibilité', () => {
    const where = eligibleForCampaignWhere('BDD1');

    expect(where.syndicat).toEqual({ sigle: CHUES_SIGLE });
    expect(where.banque).toEqual({ shortName: CBAO_SHORT_NAME });
    expect(where.phase2Status).toBe('PENDING');
  });

  it('ne borne PAS le blocage par population, l’index ne le fait pas non plus', () => {
    expect(eligibleForCampaignWhere('ALL').callTasks).toEqual({ none: { isActive: true } });
  });
});

describe('un axe manquant n’est pas un segment', () => {
  // Rendre BDD4 par defaut serait le pire choix : « autre syndicat / autre
  // banque » est une reponse, et une fiche Grand Public s'y retrouverait comptee.
  it('sans syndicat, il n’y a pas de segment', () => {
    expect(classifySegment({ syndicatSigle: null, banqueShortName: 'CBAO' })).toBeNull();
  });

  it('sans banque, il n’y a pas de segment', () => {
    expect(classifySegment({ syndicatSigle: 'CHUES', banqueShortName: null })).toBeNull();
  });

  it('sans rien, il n’y a pas de segment', () => {
    expect(classifySegment({ syndicatSigle: null, banqueShortName: null })).toBeNull();
  });

  it('les deux axes presents rendent toujours un segment', () => {
    expect(classifySegment({ syndicatSigle: 'CHUES', banqueShortName: 'CBAO' })).toBe('BDD1');
    expect(classifySegment({ syndicatSigle: 'AUTRE', banqueShortName: 'AUTRE' })).toBe('BDD4');
  });
});
