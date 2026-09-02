import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BankModule from '@/lib/data/bank-cases';
import type { BankCaseFilters } from '@/lib/bank-filters';
import { renderWithQuery } from '@/test/render-query';
import { resetRouterMock, setUrl } from '@/test/router-mock';

const fetchBankCases = vi.fn<(filters: BankCaseFilters) => unknown>();

vi.mock('@/lib/data/bank-cases', async () => {
  const actual = await vi.importActual<typeof BankModule>('@/lib/data/bank-cases');
  return {
    ...actual,
    fetchBankCases: (filters: BankCaseFilters) => fetchBankCases(filters) as unknown,
    fetchBankStages: () => Promise.resolve([]),
    fetchRejectionReasons: () => Promise.resolve([]),
  };
});

vi.mock('@/components/bank/bank-filters-bar', () => ({
  BankFiltersBar: () => null,
  BankFiltersBarSkeleton: () => null,
}));

const { BankCasesView } = await import('@/components/bank/bank-cases-view');

const VIDE = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 };

beforeEach(() => {
  resetRouterMock();
  fetchBankCases.mockReset();
  fetchBankCases.mockResolvedValue(VIDE);
});

describe('la liste des dossiers, coque par coque', () => {
  it('borne la requête au projet de la page', async () => {
    setUrl('/grand-public/dossiers');
    renderWithQuery(<BankCasesView projet="GRAND_PUBLIC" />);

    await waitFor(() => {
      expect(fetchBankCases).toHaveBeenCalled();
    });
    expect(fetchBankCases.mock.calls[0]?.[0]?.projet).toBe('GRAND_PUBLIC');
  });

  it('ne laisse pas l’URL décider du projet à la place de la page', async () => {
    setUrl('/chues/dossiers?projet=GRAND_PUBLIC');
    renderWithQuery(<BankCasesView projet="CHUES" />);

    await waitFor(() => {
      expect(fetchBankCases).toHaveBeenCalled();
    });
    expect(fetchBankCases.mock.calls[0]?.[0]?.projet).toBe('CHUES');
  });

  it('renvoie vers l’ouverture de dossier de SA coque', async () => {
    setUrl('/grand-public/dossiers');
    renderWithQuery(<BankCasesView projet="GRAND_PUBLIC" />);

    const liens = await screen.findAllByRole('link', { name: /Nouveau dossier/u });
    for (const lien of liens) {
      expect(lien.getAttribute('href')).toBe('/grand-public/dossiers/nouveau');
    }
  });
});
