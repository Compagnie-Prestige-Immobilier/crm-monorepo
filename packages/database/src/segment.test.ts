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

// Quelques valeurs réelles du référentiel, pour que la matrice soit testée avec
// ce que la base contient vraiment et pas avec des chaînes inventées.
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
    // Le référentiel est fermé et géré par l'admin : les sigles y sont écrits
    // en majuscules. Accepter « chues » masquerait une donnée mal saisie au
    // lieu de la rendre visible.
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

    // Chaque combinaison tombe dans exactement un segment, et les quatre
    // segments sont atteints : réunis, ils forment exactement la base.
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
    // Une régression classique : n'écrire que la clause positive et laisser
    // l'autre axe libre, ce qui fait fuiter des lignes d'un segment dans un
    // autre sans que rien ne le signale.
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
    const where = eligibleForCampaignWhere('ALL', false);

    expect(where.deletedAt).toBeNull();
    expect(where.phase2Status).toBe('PENDING');
    expect(where.enrollmentMethod).toBeNull();
    // La condition décisive : sans elle, deux campagnes créées coup sur coup
    // donneraient le même numéro à deux commerciaux différents.
    expect(where.callTasks).toEqual({ none: { isActive: true } });
  });

  it('combine le périmètre de segment avec les conditions d’éligibilité', () => {
    const where = eligibleForCampaignWhere('BDD1', false);

    expect(where.syndicat).toEqual({ sigle: CHUES_SIGLE });
    expect(where.banque).toEqual({ shortName: CBAO_SHORT_NAME });
    expect(where.phase2Status).toBe('PENDING');
  });

  /**
   * Le tirage matérialise ce qu'il sélectionne : une fiche de démonstration
   * retenue devient un faux numéro sur une feuille d'appels réelle, que le
   * téléconseiller découvre en composant. Éteindre le mode ensuite ne retire
   * pas la tâche déjà écrite.
   */
  it('exclut les fiches de démonstration quand le mode est éteint', () => {
    expect(eligibleForCampaignWhere('ALL', false).isDemo).toBe(false);
  });

  /**
   * Le mode CHOISIT la population, il ne l'élargit pas.
   *
   * C'est la différence avec `demoScope`, qui sert l'affichage : là, allumer le
   * mode montre le réel ET le fictif ensemble, ce qu'on attend d'une
   * démonstration. Ici le tirage écrit des tâches durables et retire de la
   * circulation chaque fiche retenue.
   *
   * Élargir revenait donc à tirer des fiches réelles dans une campagne marquée
   * « démonstration » : mode éteint, elles restaient bloquées par une tâche
   * active devenue invisible, sur une campagne invisible elle aussi, et la
   * purge ne pouvait pas les libérer puisqu'elle ne supprime que les
   * identifiants inscrits au registre d'ensemencement.
   */
  it('ne tire QUE des fiches de démonstration quand le mode est allumé', () => {
    expect(eligibleForCampaignWhere('ALL', true).isDemo).toBe(true);
  });

  /**
   * Le blocage ne connaît PAS `isDemo`, et c'est délibéré.
   *
   * L'index `call_tasks_one_active_per_prospect` est partiel sur
   * `isActive = true` et ignore `isDemo` : une seule tâche active par
   * prospect, toutes populations confondues. Borner la clause par population
   * la rendrait plus étroite que la contrainte qu'elle anticipe, et un
   * prospect portant une tâche active de l'autre population passerait
   * l'éligibilité pour aller heurter l'index en plein tirage.
   *
   * Ce test existe pour que la prochaine tentative de « symétriser » cette
   * clause avec le filtre de population échoue tout de suite.
   */
  it('ne borne PAS le blocage par population, l’index ne le fait pas non plus', () => {
    for (const demoEnabled of [true, false]) {
      expect(eligibleForCampaignWhere('ALL', demoEnabled).callTasks).toEqual({
        none: { isActive: true },
      });
    }
  });
});
