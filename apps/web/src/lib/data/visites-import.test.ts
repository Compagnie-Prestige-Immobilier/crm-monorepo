import { describe, expect, it } from 'vitest';

import {
  buildVisitesExportUrl,
  EMPTY_VISITES_EXPORT_FILTERS,
  visitesExportFileName,
} from '@/lib/data/visites-import';

describe('buildVisitesExportUrl', () => {
  it('n’ajoute aucun paramètre sans filtre actif', () => {
    expect(buildVisitesExportUrl(EMPTY_VISITES_EXPORT_FILTERS)).toBe('/api/v1/export/visites.xlsx');
  });

  it('reporte chaque filtre renseigné dans la requête', () => {
    const url = buildVisitesExportUrl({
      ...EMPTY_VISITES_EXPORT_FILTERS,
      from: '2026-08-01',
      to: '2026-08-31',
      entrepriseId: 'ent-1',
      search: '  Ba  ',
    });

    const params = new URL(url, 'https://exemple.test').searchParams;
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('entrepriseId')).toBe('ent-1');
    expect(params.get('search')).toBe('Ba');
  });
});

describe('visitesExportFileName', () => {
  it('porte la date du jour', () => {
    expect(visitesExportFileName(new Date('2026-08-23T12:00:00.000Z'))).toBe(
      'cpi-registre-visites-2026-08-23.xlsx',
    );
  });
});
