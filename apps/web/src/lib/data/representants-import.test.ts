import { describe, expect, it } from 'vitest';

import {
  buildRepresentantsExportUrl,
  representantsExportFileName,
} from '@/lib/data/representants-import';
import { toRepresentantQuery } from '@/lib/data/representants';
import { EMPTY_REPRESENTANT_FILTERS } from '@/lib/representant-filters';

describe('buildRepresentantsExportUrl', () => {
  it('n’ajoute aucun paramètre quand aucun critère n’est posé', () => {
    expect(buildRepresentantsExportUrl(EMPTY_REPRESENTANT_FILTERS)).toBe(
      '/api/v1/export/representants.xlsx',
    );
  });

  it('reprend les critères de l’écran, mais jamais le tri', () => {
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
    expect(url).not.toContain('sortBy');
    expect(url).not.toContain('sortOrder');
  });

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
