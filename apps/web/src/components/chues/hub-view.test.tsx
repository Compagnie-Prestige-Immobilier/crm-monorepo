import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubView } from '@/components/chues/hub-view';
import type * as ConsoleData from '@/lib/data/console';
import type * as Phase2Data from '@/lib/data/phase2';
import type * as RepresentantsData from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';

const fetchRepresentants = vi.fn();
const countPendingProspects = vi.fn();
const fetchCallbacks = vi.fn();

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return { ...actual, fetchRepresentants: (...args: unknown[]) => fetchRepresentants(...args) };
});

vi.mock('@/lib/data/phase2', async (importOriginal) => {
  const actual = await importOriginal<typeof Phase2Data>();
  return {
    ...actual,
    countPendingProspects: (...args: unknown[]) => countPendingProspects(...args),
  };
});

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return { ...actual, fetchCallbacks: (...args: unknown[]) => fetchCallbacks(...args) };
});

const page = (total: number) => ({ items: [], total, page: 1, pageSize: 1, pageCount: 1 });

beforeEach(() => {
  fetchRepresentants.mockReset();
  countPendingProspects.mockReset();
  fetchCallbacks.mockReset();

  fetchRepresentants.mockImplementation((filters: { hasProspects: boolean | null }) =>
    Promise.resolve(page(filters.hasProspects === false ? 7 : 42)),
  );
  countPendingProspects.mockResolvedValue(310);
  fetchCallbacks.mockResolvedValue({
    items: [{ id: 'c-1' }, { id: 'c-2' }],
    serverTime: '2026-08-27T09:00:00.000Z',
  });
});

const etapes = (): HTMLElement[] => within(screen.getByRole('list')).getAllByRole('listitem');

describe('HubView : les trois étapes, dans l’ordre', () => {
  it('salue et compte les étapes une fois les chiffres arrivés', async () => {
    renderWithQuery(<HubView prenom="Fatou" readOnly={false} />);

    expect(screen.getByText('Bonjour Fatou. Trois étapes, dans l’ordre.')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    const [une, deux, trois] = etapes();
    expect(une?.textContent).toContain('Appeler les représentants');
    expect(une?.textContent).toContain('pas encore appelés');
    expect(deux?.textContent).toContain('7');
    expect(deux?.textContent).toContain('ont dit oui, sans contacts notés');
    expect(trois?.textContent).toContain('310');
    expect(trois?.textContent).toContain('2 rappels dus');
  });

  it('n’affiche AUCUN zéro provisoire pendant le chargement', () => {
    renderWithQuery(<HubView prenom="Fatou" readOnly={false} />);

    expect(screen.queryByText('0')).toBeNull();
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it('ne propose qu’UN geste par étape, et c’est un lien', async () => {
    renderWithQuery(<HubView prenom="Fatou" readOnly={false} />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    const cibles = etapes().map((etape) => {
      const liens = within(etape).getAllByRole('link');
      expect(liens).toHaveLength(1);
      return liens[0]?.getAttribute('href');
    });

    expect(cibles).toEqual([
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/console',
    ]);
  });

  it('mène la lecture seule vers les listes, jamais vers une saisie', async () => {
    renderWithQuery(<HubView prenom="Awa" readOnly />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    expect(etapes().map((etape) => within(etape).getByRole('link').getAttribute('href'))).toEqual([
      '/chues/representants?relationStatus=INCONNU',
      '/chues/representants?relationStatus=AMBASSADEUR&hasProspects=non',
      '/chues/prospects?phase2Status=PENDING',
    ]);
  });

  it('montre un tiret plutôt qu’un chiffre faux quand l’API refuse', async () => {
    countPendingProspects.mockRejectedValue(new Error('503'));
    renderWithQuery(<HubView prenom="Awa" readOnly={false} />);

    await waitFor(() => {
      expect(screen.getByText('–')).toBeTruthy();
    });
    expect(screen.getByText('42')).toBeTruthy();
  });
});
