import { ApiError } from '@crm/api-client/query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QueryErrorState } from '@/components/query-error-state';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * « Réessayer » ne s'offre que là où réessayer peut ABOUTIR.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La règle est déjà posée en tête de `query-error-state.tsx`, pour le 403 :
 * proposer le bouton sur un refus de droits fait « recliquer dans le vide ».
 * Elle n'était pas appliquée aux deux statuts qui refusent la REQUÊTE : 400 et
 * 422 tombaient dans le repli « Chargement impossible », lequel est rejouable.
 *
 * Or rejouer y renvoie la MÊME requête et reçoit le MÊME refus, indéfiniment.
 * Le cas est atteignable depuis que l'état des filtres vit dans l'URL : toutes
 * les listes valident leurs paramètres et répondent 400, si bien qu'une URL
 * partagée ou retouchée à la main porte une valeur hors bornes. Le vrai remède
 * est la barre de filtres, restée à l'écran ; le bouton en détournait.
 */

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

    // « Chargement impossible » décrit une panne et envoie chercher du côté du
    // réseau, alors que la correction est dans les critères.
    expect(screen.queryByText('Chargement impossible')).toBeNull();
    expect(screen.getByText('Requête refusée')).toBeTruthy();
  });

  it('offre TOUJOURS de réessayer là où rejouer peut aboutir', () => {
    // Le pendant indispensable : retirer le bouton partout passerait le premier
    // test sans rien corriger. Un 500 et un 429 sont transitoires.
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
