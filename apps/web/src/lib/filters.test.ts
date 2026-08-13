import { describe, expect, it } from 'vitest';

import { toFilterQuery, toProspectQuery } from '@/lib/api/query-params';
import { buildExportUrl, exportFileName } from '@/lib/data/export';
import {
  ADVANCED_FILTER_KEYS,
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
  activeAdvancedKeys,
  clearAdvancedFilters,
  countActiveFilters,
  countAdvancedFilters,
  filtersQueryKey,
  hasAdvancedFilters,
  initialAdvancedOpen,
  parseProspectFilters,
  serializeProspectFilters,
} from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

/**
 * L'URL EST l'état du tableau. Il n'y a pas de copie dans un store React, donc
 * `parse` et `serialize` doivent être exactement réciproques : un lien collé
 * dans une conversation doit rendre l'écran de son auteur, au filtre près.
 */

const FULL: ProspectFilters = {
  search: 'Ndiaye',
  commercialId: 'c-1',
  representantId: 'r-1',
  departementId: 'd-1',
  banqueId: 'b-1',
  syndicatId: 's-1',
  statut: 'CONTACTE',
  segment: 'BDD2',
  phase2Status: 'METHOD_OBTAINED',
  enrollmentMethod: 'PLATFORM',
  campaignId: 'camp-1',
  enrollmentCapturedById: 'c-9',
  dateFrom: '2026-01-01',
  dateTo: '2026-03-31',
  page: 4,
  pageSize: 50,
  sortBy: 'nom',
  sortDir: 'asc',
};

describe('aller-retour filtres ⇄ search params', () => {
  it('restitue un filtre complet à l’identique', () => {
    const restored = parseProspectFilters(serializeProspectFilters(FULL));
    expect(restored).toEqual(FULL);
  });

  it('restitue le filtre vide à l’identique', () => {
    const restored = parseProspectFilters(serializeProspectFilters(EMPTY_FILTERS));
    expect(restored).toEqual(EMPTY_FILTERS);
  });

  it('n’écrit AUCUN paramètre pour le filtre par défaut', () => {
    // Une URL propre quand rien n'est filtré : `/prospects`, pas
    // `/prospects?page=1&pageSize=25&sortBy=...`.
    expect(serializeProspectFilters(EMPTY_FILTERS).toString()).toBe('');
  });

  it('omet les valeurs par défaut mais garde celles qui en diffèrent', () => {
    const params = serializeProspectFilters({ ...EMPTY_FILTERS, page: 2 });
    expect(params.get('page')).toBe('2');
    expect(params.has('pageSize')).toBe(false);
    expect(params.has('sortBy')).toBe(false);
    expect(params.has('sortDir')).toBe(false);
  });

  it('lit aussi la forme `Record` que Next passe aux pages serveur', () => {
    const restored = parseProspectFilters({
      search: 'Ndiaye',
      statut: 'CONVERTI',
      // Next passe un tableau quand la clé est répétée : on retient la première.
      departementId: ['d-1', 'd-2'],
      page: '3',
    });
    expect(restored.search).toBe('Ndiaye');
    expect(restored.statut).toBe('CONVERTI');
    expect(restored.departementId).toBe('d-1');
    expect(restored.page).toBe(3);
  });

  it('la clé de requête est stable quel que soit l’ordre d’écriture', () => {
    const a = filtersQueryKey({ ...EMPTY_FILTERS, banqueId: 'b-1', statut: 'PERDU' });
    const b = filtersQueryKey({ ...EMPTY_FILTERS, statut: 'PERDU', banqueId: 'b-1' });
    expect(a).toBe(b);
  });
});

describe('analyse défensive des URL bricolées', () => {
  it('écarte un statut inconnu plutôt que de le relayer à l’API', () => {
    expect(parseProspectFilters(new URLSearchParams('statut=SUPPRIME')).statut).toBeNull();
  });

  it('écarte un champ de tri que l’API ne supporte pas', () => {
    // Un tri « par représentant » afficherait une flèche qui ne trie rien.
    expect(parseProspectFilters(new URLSearchParams('sortBy=representant')).sortBy).toBe(
      EMPTY_FILTERS.sortBy,
    );
  });

  it('écarte une date mal formée', () => {
    expect(parseProspectFilters(new URLSearchParams('dateFrom=01/01/2026')).dateFrom).toBeNull();
    expect(parseProspectFilters(new URLSearchParams('dateFrom=2026-01-01')).dateFrom).toBe(
      '2026-01-01',
    );
  });

  it('retombe sur les valeurs par défaut pour une pagination absurde', () => {
    const filters = parseProspectFilters(new URLSearchParams('page=-3&pageSize=99999'));
    expect(filters.page).toBe(1);
    // 99999 n'est pas dans PAGE_SIZE_OPTIONS : un export involontaire de toute
    // la base ne doit pas être à un caractère d'URL près.
    expect(filters.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('traite une recherche vide comme absente', () => {
    expect(parseProspectFilters(new URLSearchParams('search=%20%20')).search).toBe('');
  });
});

describe('buildExportUrl', () => {
  it('retire page et pageSize et CONSERVE tous les filtres', () => {
    const params = new URLSearchParams(buildExportUrl(FULL).split('?')[1]);

    // Ce que l'export ne doit surtout pas garder : un fichier Excel contient
    // toute la sélection, pas la page affichée.
    expect(params.has('page')).toBe(false);
    expect(params.has('pageSize')).toBe(false);

    // Ce qu'il doit garder, sans exception : c'est la promesse faite à
    // l'administrateur qui envoie le fichier à sa direction.
    expect(params.get('search')).toBe('Ndiaye');
    expect(params.get('commercialId')).toBe('c-1');
    expect(params.get('representantId')).toBe('r-1');
    expect(params.get('departementId')).toBe('d-1');
    expect(params.get('banqueId')).toBe('b-1');
    expect(params.get('syndicatId')).toBe('s-1');
    expect(params.get('statut')).toBe('CONTACTE');
    expect(params.get('dateFrom')).toBe('2026-01-01');
    expect(params.get('dateTo')).toBe('2026-03-31');
  });

  it('couvre TOUS les critères de sélection, sans en oublier un', () => {
    // Test de garde : si quelqu'un ajoute un critère à ProspectFilters sans
    // l'ajouter à la sérialisation, l'export cesserait silencieusement de
    // correspondre à l'écran. On compare les clés attendues au contrat.
    const selectionKeys = Object.keys(FULL).filter(
      (key) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(key),
    );
    const params = new URLSearchParams(buildExportUrl(FULL).split('?')[1]);
    for (const key of selectionKeys) {
      expect(params.has(key), `le critère « ${key} » est absent de l’URL d’export`).toBe(true);
    }
  });

  it('sans filtre, l’URL n’a pas de query string', () => {
    expect(buildExportUrl(EMPTY_FILTERS)).toBe('/api/export/prospects');
  });

  it('la pagination seule ne produit pas de query string', () => {
    expect(buildExportUrl({ ...EMPTY_FILTERS, page: 7, pageSize: 100 })).toBe(
      '/api/export/prospects',
    );
  });
});

describe('traduction vers les paramètres de l’API', () => {
  it('élargit les bornes de date à la journée entière', () => {
    // `dateTo=2026-03-31` seul exclurait tout prospect saisi ce jour-là :
    // l'API l'interpréterait comme minuit pile.
    const query = toFilterQuery(FULL);
    expect(query.dateFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(query.dateTo).toBe('2026-03-31T23:59:59.999Z');
  });

  it('n’écrit aucune clé pour un critère non renseigné', () => {
    // `exactOptionalPropertyTypes` interdit `undefined` explicite, et une clé
    // vide relayée à l'API produirait un 400.
    expect(Object.keys(toFilterQuery(EMPTY_FILTERS))).toHaveLength(0);
  });

  it('toProspectQuery ajoute pagination et tri à la sélection', () => {
    const query = toProspectQuery(FULL);
    expect(query.page).toBe(4);
    expect(query.pageSize).toBe(50);
    expect(query.sortBy).toBe('nom');
    expect(query.sortOrder).toBe('asc');
    // La sélection reste intacte : tableau et export voient les mêmes critères.
    expect(query.statut).toBe('CONTACTE');
  });

  it('la sélection de toProspectQuery est identique à celle de toFilterQuery', () => {
    // Garantie centrale : le tableau et l'export ne peuvent pas diverger.
    const { page, pageSize, sortBy, sortOrder, ...selection } = toProspectQuery(FULL);
    void page;
    void pageSize;
    void sortBy;
    void sortOrder;
    expect(selection).toEqual(toFilterQuery(FULL));
  });
});

describe('countActiveFilters', () => {
  it('ne compte rien sur un filtre vide', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('ne compte pas la pagination ni le tri comme des filtres', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, page: 3, pageSize: 100, sortDir: 'asc' })).toBe(
      0,
    );
  });

  it('compte une plage de dates comme UN filtre, pas deux', () => {
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, dateFrom: '2026-01-01', dateTo: '2026-02-01' }),
    ).toBe(1);
  });

  it('compte chaque critère renseigné plus la plage de dates', () => {
    // Sept critères de phase 1, cinq de phase 2, et la plage comptée pour un.
    expect(countActiveFilters(FULL)).toBe(13);
  });

  it('compte les nouveaux critères de phase 2 un par un', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, segment: 'BDD1' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, phase2Status: 'REFUSED' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, enrollmentMethod: 'PHYSICAL' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, campaignId: 'camp-1' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, enrollmentCapturedById: 'c-1' })).toBe(1);
  });
});

/**
 * Phase 2 dans l'URL.
 *
 * Ces cinq critères sont arrivés APRÈS le tableau, les graphiques et l'export.
 * S'ils avaient été rangés dans un second objet de filtre, un lien « BDD2,
 * méthode obtenue » aurait rouvert le tableau filtré et l'export non filtré —
 * et personne ne s'en serait aperçu avant qu'un classeur ne parte au siège.
 * Ces tests fixent l'aller-retour et la présence dans l'export.
 */
describe('filtres de phase 2', () => {
  it('fait l’aller-retour URL ⇄ filtre sans perte', () => {
    const filters: ProspectFilters = {
      ...EMPTY_FILTERS,
      segment: 'BDD3',
      phase2Status: 'WRONG_NUMBER',
      enrollmentMethod: 'VOICE_OR_ELECTRONIC_MESSAGING',
      campaignId: 'camp-42',
      enrollmentCapturedById: 'user-7',
    };
    expect(parseProspectFilters(serializeProspectFilters(filters))).toEqual(filters);
  });

  it('écarte un segment, un statut ou une méthode inconnus', () => {
    const parsed = parseProspectFilters(
      new URLSearchParams('segment=BDD9&phase2Status=INCONNU&enrollmentMethod=TELEPATHIE'),
    );
    expect(parsed.segment).toBeNull();
    expect(parsed.phase2Status).toBeNull();
    expect(parsed.enrollmentMethod).toBeNull();
  });

  it('relaie les cinq critères à l’API', () => {
    const query = toFilterQuery(FULL);
    expect(query.segment).toBe('BDD2');
    expect(query.phase2Status).toBe('METHOD_OBTAINED');
    expect(query.enrollmentMethod).toBe('PLATFORM');
    expect(query.campaignId).toBe('camp-1');
    expect(query.enrollmentCapturedById).toBe('c-9');
  });

  it('les porte dans l’URL d’export de la vue filtrée', () => {
    const params = new URLSearchParams(buildExportUrl(FULL, 'filtered').split('?')[1]);
    expect(params.get('segment')).toBe('BDD2');
    expect(params.get('phase2Status')).toBe('METHOD_OBTAINED');
    expect(params.get('campaignId')).toBe('camp-1');
  });
});

/**
 * Le classeur consolidé porte SA PROPRE segmentation, en cinq feuilles fixes.
 * Y relayer `segment=BDD2` produirait quatre feuilles vides sur cinq — et
 * l'utilisateur ne le découvrirait qu'en ouvrant Excel.
 */
describe('classeur consolidé', () => {
  it('demande le mode consolidé et RETIRE le critère de segment', () => {
    const url = buildExportUrl(FULL, 'consolidated');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('mode')).toBe('consolidated');
    expect(params.has('segment')).toBe(false);
    // Les autres critères restent : le classeur consolidé d'un département
    // donné reste un classeur consolidé.
    expect(params.get('departementId')).toBe('d-1');
  });

  it('garde le mode filtré par défaut', () => {
    expect(new URLSearchParams(buildExportUrl(FULL).split('?')[1]).has('mode')).toBe(false);
  });

  it('nomme les deux fichiers différemment', () => {
    const day = new Date('2026-08-12T10:00:00.000Z');
    expect(exportFileName(day, 'filtered')).toBe('cpi-prospects-2026-08-12.xlsx');
    expect(exportFileName(day, 'consolidated')).toBe('cpi-prospects-consolide-2026-08-12.xlsx');
  });
});

/**
 * Le partage entre filtrage simple et filtrage avancé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce que ces tests protègent : un filtre actif ne doit JAMAIS devenir
 * invisible.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replier dix champs raccourcit la page, mais si un critère resté actif
 * disparaît de l'écran, le tableau affiche une population restreinte que
 * personne ne sait expliquer. Le chiffre lu est faux, et il a l'air normal.
 *
 * D'où deux invariants : le compte des critères repliés est exact, et une URL
 * qui en porte un ouvre le panneau quelle que soit la préférence enregistrée.
 */
describe('filtrage avancé', () => {
  it('compte les critères repliés, sans compter ceux restés visibles', () => {
    // Les dix critères avancés de FULL. La recherche, la période et le
    // téléconseiller restent à l'air libre : ils ne comptent pas ici.
    expect(countAdvancedFilters(FULL)).toBe(10);
    expect(activeAdvancedKeys(FULL)).toEqual([...ADVANCED_FILTER_KEYS]);
    expect(hasAdvancedFilters(FULL)).toBe(true);
  });

  it('ne compte aucun critère avancé quand seuls les champs visibles sont remplis', () => {
    const visibleOnly: ProspectFilters = {
      ...EMPTY_FILTERS,
      search: 'Ndiaye',
      commercialId: 'c-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    };
    expect(countAdvancedFilters(visibleOnly)).toBe(0);
    expect(hasAdvancedFilters(visibleOnly)).toBe(false);
    // Trois critères actifs tout de même : le compte global les voit.
    expect(countActiveFilters(visibleOnly)).toBe(3);
  });

  it('n’efface QUE les critères repliés', () => {
    const cleared: ProspectFilters = { ...FULL, ...clearAdvancedFilters() };
    expect(hasAdvancedFilters(cleared)).toBe(false);
    // Ce que l'utilisateur voit à l'écran n'a pas bougé : effacer un champ
    // visible depuis un bouton rangé ailleurs se lirait comme un défaut.
    expect(cleared.search).toBe('Ndiaye');
    expect(cleared.commercialId).toBe('c-1');
    expect(cleared.dateFrom).toBe('2026-01-01');
    expect(cleared.dateTo).toBe('2026-03-31');
  });

  it('ouvre le panneau sur une URL qui porte un critère replié, préférence contraire comprise', () => {
    const shared: ProspectFilters = { ...EMPTY_FILTERS, banqueId: 'b-1' };
    expect(initialAdvancedOpen(shared, false)).toBe(true);
    expect(initialAdvancedOpen(shared, null)).toBe(true);
  });

  it('suit la préférence enregistrée quand l’URL ne porte aucun critère replié', () => {
    expect(initialAdvancedOpen(EMPTY_FILTERS, true)).toBe(true);
    expect(initialAdvancedOpen(EMPTY_FILTERS, false)).toBe(false);
  });

  it('reste replié par défaut : c’est tout l’objet du changement', () => {
    expect(initialAdvancedOpen(EMPTY_FILTERS, null)).toBe(false);
  });
});
