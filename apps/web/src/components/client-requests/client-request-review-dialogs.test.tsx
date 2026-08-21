import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientRequestReviewDialogs } from '@/components/client-requests/client-request-review-dialogs';
import type * as ReferenceModule from '@/lib/data/reference';
import type { ClientRequest } from '@/lib/data/client-requests';
import { renderWithQuery } from '@/test/render-query';

const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const REQUEST = {
  id: 'req-1',
  nom: 'Ndiaye',
  prenom: 'Fatou',
  phoneE164: '+221771234567',
  note: null,
  banqueId: 'banque-1',
  banqueName: 'CBAO',
  requestedById: 'bank-1',
  requestedByName: 'Agent CBAO',
  status: 'PENDING',
  reviewedById: null,
  reviewedByName: null,
  reviewedAt: null,
  rejectionNote: null,
  createdProspectId: null,
  createdAt: '2026-08-20T09:00:00.000Z',
  updatedAt: '2026-08-20T09:00:00.000Z',
} satisfies ClientRequest;

beforeEach(() => {
  reference.mockReset();
});

describe('ClientRequestReviewDialogs', () => {
  it('signale l’échec des référentiels et permet de les redemander', async () => {
    reference
      .mockRejectedValueOnce(new Error('indisponible'))
      .mockResolvedValueOnce({ representants: [], syndicats: [] });

    const pending = { request: REQUEST, action: 'approve' } as const;
    renderWithQuery(<ClientRequestReviewDialogs pending={pending} onClose={vi.fn()} />);

    expect((await screen.findByRole('alert')).textContent).toContain('Serveur injoignable');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Représentant de rattachement')).toBeTruthy();
    expect(reference).toHaveBeenCalledTimes(2);
  });
});
