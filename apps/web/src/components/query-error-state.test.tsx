import { ApiError } from '@crm/api-client/query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QueryErrorState } from '@/components/query-error-state';

const fail = (status: number, body: unknown = {}): ApiError =>
  new ApiError(body, new Response(null, { status }));

const retryButton = () => screen.queryByRole('button', { name: /Réessayer/u });

describe('l’affordance de réessai selon le statut', () => {
  it('n’offre PAS de réessayer sur une requête refusée (400, 422)', () => {
    for (const status of [400, 422]) {
      const { unmount } = render(
        <QueryErrorState
          error={fail(status, { message: 'Critère hors bornes.' })}
          onRetry={vi.fn()}
        />,
      );

      expect(retryButton()).toBeNull();
      unmount();
    }
  });

  it('nomme la requête plutôt qu’une panne de chargement', () => {
    render(
      <QueryErrorState error={fail(422, { message: 'Critère hors bornes.' })} onRetry={vi.fn()} />,
    );

    expect(screen.queryByText('Chargement impossible')).toBeNull();
    expect(screen.getByText('Requête refusée')).toBeTruthy();
  });

  it('offre TOUJOURS de réessayer là où rejouer peut aboutir', () => {
    for (const status of [500, 503, 429]) {
      const { unmount } = render(<QueryErrorState error={fail(status)} onRetry={vi.fn()} />);

      expect(retryButton()).not.toBeNull();
      unmount();
    }
  });

  it('garde les refus déjà traités hors du réessai', () => {
    for (const status of [403, 404]) {
      const { unmount } = render(<QueryErrorState error={fail(status)} onRetry={vi.fn()} />);

      expect(retryButton()).toBeNull();
      unmount();
    }
  });
});
