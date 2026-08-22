import { describe, expect, it } from 'vitest';

import { buildAdvancedChips } from '@/components/filters/advanced-chips';
import { EMPTY_FILTERS } from '@/lib/filters';
import { RETIRED_SUFFIX, type ProspectFilters, type ReferenceData } from '@/lib/types';

const REFERENCE: ReferenceData = {
  professions: [],
  incomeBands: [],
  offers: [],
  regions: [],
  iefs: [],
  departements: [
    { id: 'd-1', name: 'Dakar', regionId: 'reg-1', regionName: 'Dakar', isActive: true },
    { id: 'd-2', name: 'Thiès', regionId: 'reg-2', regionName: 'Thiès', isActive: false },
  ] as ReferenceData['departements'],
  banques: [
    { id: 'b-1', shortName: 'CBAO', name: 'CBAO Attijariwafa', isActive: true },
  ] as ReferenceData['banques'],
  syndicats: [
    { id: 's-1', sigle: 'CHUES', name: 'CHUES', secteur: 'Santé', isActive: true },
  ] as ReferenceData['syndicats'],
  commerciaux: [{ value: 'c-9', label: 'Awa Diop' }],
  representants: [{ value: 'r-1', label: 'Moussa Fall' }],
  campagnes: [{ value: 'camp-1', label: 'Relance avril' }],
};

const FULL: ProspectFilters = {
  ...EMPTY_FILTERS,
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
};

describe('buildAdvancedChips', () => {
  it('ne produit aucune puce quand aucun critère replié n’est actif', () => {
    expect(buildAdvancedChips(EMPTY_FILTERS, REFERENCE)).toEqual([]);
  });

  it('ignore les critères restés visibles', () => {
    const visibleOnly: ProspectFilters = {
      ...EMPTY_FILTERS,
      search: 'Ndiaye',
      commercialId: 'c-9',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    };
    expect(buildAdvancedChips(visibleOnly, REFERENCE)).toEqual([]);
  });

  it('produit une puce par critère replié, dans l’ordre des champs', () => {
    const chips = buildAdvancedChips(FULL, REFERENCE);
    expect(chips.map((chip) => chip.key)).toEqual([
      'representantId',
      'departementId',
      'banqueId',
      'syndicatId',
      'statut',
      'segment',
      'phase2Status',
      'enrollmentMethod',
      'campaignId',
      'enrollmentCapturedById',
    ]);
  });

  it('porte la VALEUR et pas seulement le nom du champ', () => {
    const chips = buildAdvancedChips(FULL, REFERENCE);
    const banque = chips.find((chip) => chip.key === 'banqueId');
    expect(banque).toEqual({ key: 'banqueId', field: 'Banque', value: 'CBAO' });

    expect(chips.find((chip) => chip.key === 'representantId')?.value).toBe('Moussa Fall');
    expect(chips.find((chip) => chip.key === 'campaignId')?.value).toBe('Relance avril');
    expect(chips.find((chip) => chip.key === 'enrollmentCapturedById')?.value).toBe('Awa Diop');
    expect(chips.find((chip) => chip.key === 'statut')?.value).toBe('Contacté');
    expect(chips.find((chip) => chip.key === 'segment')?.value).toContain('BDD2');
  });

  it('marque un référentiel retiré, comme les listes déroulantes', () => {
    const chips = buildAdvancedChips({ ...EMPTY_FILTERS, departementId: 'd-2' }, REFERENCE);
    expect(chips[0]?.value).toBe(`Thiès ${RETIRED_SUFFIX}`);
  });

  it('montre tout de même la puce quand l’identifiant ne correspond à rien', () => {
    const chips = buildAdvancedChips({ ...EMPTY_FILTERS, campaignId: 'disparue' }, REFERENCE);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.field).toBe('Campagne d’appels');
    expect(chips[0]?.value).toBe('Valeur inconnue');
  });

  it('reste rendable pendant le chargement des référentiels', () => {
    const chips = buildAdvancedChips({ ...EMPTY_FILTERS, banqueId: 'b-1' }, undefined);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.value).toBe('Valeur inconnue');
  });
});
