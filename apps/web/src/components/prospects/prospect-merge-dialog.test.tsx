import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProspectsModule from '@/lib/data/prospects';
import type { ProspectRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';

const fetchProspects = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return {
    ...actual,
    fetchProspects: (filters: { search: string }) => fetchProspects(filters) as unknown,
    mergeProspects: vi.fn(),
  };
});

const { ProspectMergeDialog } = await import('@/components/prospects/prospect-merge-dialog');

const prospect = (id: string): ProspectRow =>
  ({
    id,
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771234567',
    journeys: [],
  }) as unknown as ProspectRow;

beforeEach(() => {
  vi.useFakeTimers();
  fetchProspects.mockReset();
  fetchProspects.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, pageCount: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fusion de doublons', () => {
  // Rouvrir la fusion sur une autre fiche relançait une requête avec le terme
  // tapé pour la précédente : la remise à zéro portait sur une valeur déjà
  // vide, donc le report en cours n'était pas annulé.
  it('ne rejoue pas le terme de la fiche précédente à la réouverture', () => {
    const { rerender } = renderWithQuery(
      <ProspectMergeDialog prospect={prospect('p-1')} onOpenChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Fiche en double'), { target: { value: 'diop' } });

    // On rouvre sur une autre fiche AVANT que la temporisation n'expire.
    rerender(<ProspectMergeDialog prospect={prospect('p-2')} onOpenChange={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fetchProspects).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>('Fiche en double').value).toBe('');
  });

  it('cherche bien lorsque la frappe va au bout', () => {
    renderWithQuery(<ProspectMergeDialog prospect={prospect('p-1')} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Fiche en double'), { target: { value: 'diop' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fetchProspects).toHaveBeenCalledWith(expect.objectContaining({ search: 'diop' }));
  });
});
