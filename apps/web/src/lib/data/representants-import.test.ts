import { describe, expect, it } from 'vitest';

import {
  buildRepresentantsExportUrl,
  representantsExportFileName,
} from '@/lib/data/representants-import';
import { toRepresentantQuery } from '@/lib/data/representants';
import { EMPTY_REPRESENTANT_FILTERS } from '@/lib/representant-filters';

/**
 * L'export des représentants.
 *
 * Une seule règle y est réellement risquée : le fichier doit décrire
 * EXACTEMENT la population affichée. Celui qui l'envoie à sa direction doit
 * pouvoir jurer qu'il contient ce qu'il avait sous les yeux, et la pagination
 * est la seule chose qui ne doit surtout pas suivre.
 */

describe('buildRepresentantsExportUrl', () => {
  it('n’ajoute aucun paramètre quand aucun critère n’est posé', () => {
    expect(buildRepresentantsExportUrl(EMPTY_REPRESENTANT_FILTERS)).toBe(
      '/api/v1/export/representants.xlsx',
    );
  });

  it('reprend les critères de l’écran, tri compris', () => {
    const url = buildRepresentantsExportUrl({
      ...EMPTY_REPRESENTANT_FILTERS,
      search: 'Diallo',
      departementId: 'dep-1',
      hasProspects: false,
      sortBy: 'prospects',
      sortDir: 'asc',
    });
    expect(url).toContain('search=Diallo');
    expect(url).toContain('departementId=dep-1');
    expect(url).toContain('sortBy=prospects');
    expect(url).toContain('sortOrder=asc');
  });

  /**
   * Le vocabulaire de l'API, jamais celui de l'URL du navigateur.
   *
   * `oui` / `non` sont ce que l'écran écrit dans SA barre d'adresse. L'API
   * attend un booléen et coerce toute chaîne non vide en `true` : envoyer
   * `hasProspects=non` exportait donc exactement la population INVERSE de celle
   * affichée, sans le moindre message. Le fichier part ensuite par courriel.
   */
  it('traduit « aucun prospect » en `false`, jamais en « non »', () => {
    const url = buildRepresentantsExportUrl({
      ...EMPTY_REPRESENTANT_FILTERS,
      hasProspects: false,
    });
    expect(url).toContain('hasProspects=false');
    expect(url).not.toContain('hasProspects=non');
  });

  it('traduit « au moins un prospect » en `true`, jamais en « oui »', () => {
    const url = buildRepresentantsExportUrl({
      ...EMPTY_REPRESENTANT_FILTERS,
      hasProspects: true,
    });
    expect(url).toContain('hasProspects=true');
    expect(url).not.toContain('hasProspects=oui');
  });

  /**
   * Les bornes de journée, comme dans le tableau.
   *
   * L'API fait `lte: new Date(dateTo)` : une date nue est lue comme minuit
   * pile, et le DERNIER JOUR de la période disparaît du classeur alors qu'il
   * est à l'écran. Le tableau borne déjà la journée ; l'export doit borner de
   * la même façon, sinon les deux ne décrivent pas la même population.
   */
  it('borne la journée entière, sinon l’export perd le dernier jour', () => {
    const url = buildRepresentantsExportUrl({
      ...EMPTY_REPRESENTANT_FILTERS,
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('dateFrom')).toBe('2026-04-01T00:00:00.000Z');
    expect(params.get('dateTo')).toBe('2026-04-30T23:59:59.999Z');
  });

  it('décrit EXACTEMENT la population du tableau, pagination mise à part', () => {
    // La garantie du module, énoncée en une assertion : les mêmes critères
    // produisent les mêmes paramètres des deux côtés.
    const filters = {
      ...EMPTY_REPRESENTANT_FILTERS,
      search: 'Diallo',
      hasProspects: false,
      dateTo: '2026-04-30',
      page: 4,
    };
    const exported = new URL(buildRepresentantsExportUrl(filters), 'http://localhost').searchParams;
    const displayed = toRepresentantQuery(filters);

    for (const [key, value] of Object.entries(displayed)) {
      if (key === 'page' || key === 'pageSize') continue;
      expect(exported.get(key)).toBe(String(value));
    }
  });

  it('retire la PAGINATION : un export contient tout, pas la page affichée', () => {
    const url = buildRepresentantsExportUrl({
      ...EMPTY_REPRESENTANT_FILTERS,
      search: 'Diallo',
      page: 4,
    });
    expect(url).not.toContain('page=');
    expect(url).not.toContain('pageSize=');
  });

  it('vise le relais de Next, jamais le backend directement', () => {
    // Le jeton vit dans un cookie httpOnly : une URL vers NestJS partirait
    // anonyme et enregistrerait un 401 déguisé en classeur.
    expect(buildRepresentantsExportUrl(EMPTY_REPRESENTANT_FILTERS)).toMatch(/^\/api\/v1\//u);
  });
});

describe('representantsExportFileName', () => {
  it('date le fichier, pour ne pas empiler dix homonymes dans Téléchargements', () => {
    expect(representantsExportFileName(new Date('2026-08-13T09:12:00.000Z'))).toBe(
      'cpi-representants-2026-08-13.xlsx',
    );
  });
});
