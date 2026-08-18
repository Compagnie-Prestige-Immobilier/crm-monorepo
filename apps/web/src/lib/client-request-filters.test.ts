import { describe, expect, it } from 'vitest';

import {
  ALL_STATUSES,
  DEFAULT_CLIENT_REQUEST_FILTERS,
  countActiveClientRequestFilters,
  parseClientRequestFilters,
  serializeClientRequestFilters,
} from '@/lib/client-request-filters';
import { originLabelFor } from '@/lib/data/client-requests';

describe('parseClientRequestFilters', () => {
  it('ouvre sur les demandes en attente, filtre absent', () => {
    expect(parseClientRequestFilters(new URLSearchParams()).status).toBe('PENDING');
  });

  it('sait exprimer « tous statuts », que l’absence de clé ne dirait pas', () => {
    expect(
      parseClientRequestFilters(new URLSearchParams(`statut=${ALL_STATUSES}`)).status,
    ).toBeNull();
  });

  it('accepte les trois statuts du contrat', () => {
    expect(parseClientRequestFilters(new URLSearchParams('statut=APPROVED')).status).toBe(
      'APPROVED',
    );
    expect(parseClientRequestFilters(new URLSearchParams('statut=REJECTED')).status).toBe(
      'REJECTED',
    );
  });

  it('écarte une valeur inconnue plutôt que de la propager vers l’API', () => {
    expect(parseClientRequestFilters(new URLSearchParams('statut=ARCHIVE')).status).toBe('PENDING');
  });

  it('lit aussi la forme `searchParams` d’une page serveur', () => {
    const filters = parseClientRequestFilters({ search: ['Diallo'], page: '3' });
    expect(filters.search).toBe('Diallo');
    expect(filters.page).toBe(3);
  });
});

describe('serializeClientRequestFilters', () => {
  it('omet le statut par défaut : une URL propre pour le cas courant', () => {
    expect(serializeClientRequestFilters(DEFAULT_CLIENT_REQUEST_FILTERS).toString()).toBe('');
  });

  it('fait l’aller-retour sans perte', () => {
    const filters = {
      ...DEFAULT_CLIENT_REQUEST_FILTERS,
      status: null,
      search: 'Aminata',
      banqueId: '019ff658-dddd-7489-ab22-1f2ada5ef38a',
      page: 2,
    };
    const restored = parseClientRequestFilters(serializeClientRequestFilters(filters));
    expect(restored).toEqual(filters);
  });
});

describe('countActiveClientRequestFilters', () => {
  it('ne compte pas le statut par défaut comme un critère posé', () => {
    expect(countActiveClientRequestFilters(DEFAULT_CLIENT_REQUEST_FILTERS)).toBe(0);
  });

  it('compte chaque critère réellement posé', () => {
    expect(
      countActiveClientRequestFilters({
        ...DEFAULT_CLIENT_REQUEST_FILTERS,
        status: 'APPROVED',
        search: 'Diallo',
        banqueId: 'abc',
      }),
    ).toBe(3);
  });
});

describe('originLabelFor', () => {
  it('nomme la banque demandeuse, pas seulement la clé', () => {
    expect(originLabelFor('BANQUE', 'CBAO')).toBe('Demande de CBAO');
  });

  it('retombe proprement quand le libellé manque', () => {
    expect(originLabelFor('BANQUE', null)).toBe('Demande d’une banque');
  });

  it('dit « tournée terrain » pour une fiche née sur le mobile', () => {
    expect(originLabelFor(null, null)).toBe('Tournée terrain');
  });
});
