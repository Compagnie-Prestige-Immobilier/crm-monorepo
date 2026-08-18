import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProspectsModule from '@/lib/data/prospects';
import type * as RepresentantsModule from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';

const fetchRepresentant = vi.hoisted(() => vi.fn());
const fetchRelationHistory = vi.hoisted(() => vi.fn());
const fetchProspects = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return {
    ...actual,
    fetchRepresentant: () => fetchRepresentant() as unknown,
    fetchRepresentantRelationHistory: () => fetchRelationHistory() as unknown,
  };
});

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return { ...actual, fetchProspects: () => fetchProspects() as unknown };
});

const { RepresentantDetailView } =
  await import('@/components/representants/representant-detail-view');

const FICHE = {
  id: 'rep-1',
  rev: 3,
  fullName: 'Ndeye Fall',
  phoneE164: '+221771234567',
  departementId: 'd-1',
  departementName: 'Tambacounda',
  iefId: null,
  iefName: null,
  createdById: 'u-1',
  createdByName: 'Aminata Diallo',
  prospectCount: 2,
  relationStatus: 'AMBASSADEUR',
  notes: null,
  clientCreatedAt: '2026-03-01T09:00:00.000Z',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-04T09:00:00.000Z',
};

const change = (
  id: string,
  fromStatus: string,
  toStatus: string,
  changedAt: string,
  reason: string | null = null,
) => ({
  id,
  representantId: 'rep-1',
  fromStatus,
  toStatus,
  reason,
  changedById: 'u-1',
  changedByName: 'Aminata Diallo',
  source: 'WEB',
  changedAt,
});

beforeEach(() => {
  fetchRepresentant.mockResolvedValue(FICHE);
  fetchRelationHistory.mockResolvedValue([]);
  fetchProspects.mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 0 });
});

describe('RepresentantDetailView', () => {
  it('porte le nom et l’état courant de la relation', async () => {
    renderWithQuery(<RepresentantDetailView representantId="rep-1" />);

    expect(await screen.findByText('Ndeye Fall')).toBeTruthy();
    expect(screen.getByText('Ambassadeur')).toBeTruthy();
  });

  it('rend la chronologie dans l’ordre servi par l’API, du plus récent au plus ancien', async () => {
    fetchRelationHistory.mockResolvedValue([
      change('c-3', 'CONTACTE', 'AMBASSADEUR', '2026-03-04T09:00:00.000Z'),
      change('c-2', 'INCONNU', 'CONTACTE', '2026-03-02T09:00:00.000Z'),
      change('c-1', 'REFUS', 'INCONNU', '2026-03-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantDetailView representantId="rep-1" />);

    const chronologie = await screen.findByRole('list', { name: /Histoire de la relation/u });
    const bascules = within(chronologie)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(bascules).toHaveLength(3);
    expect(bascules[0]).toContain('Ambassadeur');
    expect(bascules[1]).toContain('Contacté');
    expect(bascules[2]).toContain('Pas encore contacté');
  });

  it('montre le motif quand la bascule en porte un', async () => {
    fetchRelationHistory.mockResolvedValue([
      change('c-1', 'AMBASSADEUR', 'REFUS', '2026-03-04T09:00:00.000Z', 'Ne veut plus être appelé'),
    ]);
    renderWithQuery(<RepresentantDetailView representantId="rep-1" />);

    expect(await screen.findByText(/Ne veut plus être appelé/u)).toBeTruthy();
  });

  it('dit quoi faire quand aucune bascule n’a encore été enregistrée', async () => {
    renderWithQuery(<RepresentantDetailView representantId="rep-1" />);

    expect(await screen.findByText(/Aucune bascule enregistrée/u)).toBeTruthy();
  });

  it('liste les prospects apportés', async () => {
    fetchProspects.mockResolvedValue({
      items: [
        {
          id: 'p-1',
          nom: 'Sow',
          prenom: 'Moussa',
          phoneE164: '+221770000001',
          statut: 'CONVERTI',
          banqueName: 'CBAO',
          syndicatSigle: 'SAES',
          clientCreatedAt: '2026-03-02T09:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    renderWithQuery(<RepresentantDetailView representantId="rep-1" />);

    expect(await screen.findByText('Moussa Sow')).toBeTruthy();
    expect(screen.getByText('Converti')).toBeTruthy();
  });
});
