import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useVerrouNavigation } from './use-verrou-navigation';

function SousVerrou({ prevenir }: { prevenir: () => void }): React.JSX.Element {
  useVerrouNavigation(true, prevenir);
  return (
    <a href="https://exemple.test/ailleurs">
      <svg aria-hidden="true" data-testid="icone" height="16" width="16">
        <circle cx="8" cy="8" r="8" />
      </svg>
      Quitter
    </a>
  );
}

describe('verrou de navigation', () => {
  it('retient un clic sur le texte du lien', async () => {
    const prevenir = vi.fn();
    render(<SousVerrou prevenir={prevenir} />);

    await userEvent.click(screen.getByText('Quitter'));

    expect(prevenir).toHaveBeenCalledTimes(1);
  });

  // Les icones du depot viennent de lucide-react, qui rend un <svg> : le clic
  // atterrit sur un SVGElement, jamais sur un HTMLElement.
  it('retient aussi un clic sur l’icône du lien', async () => {
    const prevenir = vi.fn();
    render(<SousVerrou prevenir={prevenir} />);

    await userEvent.click(screen.getByTestId('icone'));

    expect(prevenir).toHaveBeenCalledTimes(1);
  });

  // Ctrl+R et Ctrl+Maj+R ne passent que par la : Safari, et Chrome avant la
  // 119, ignorent `preventDefault()` sans `returnValue`.
  it('reclame l’avertissement du navigateur avant un rechargement', () => {
    render(<SousVerrou prevenir={vi.fn()} />);

    const rechargement = new Event('beforeunload', { cancelable: true });
    // jsdom n'a que le `returnValue` historique, qui ne rend qu'un booleen :
    // on observe donc ce que le gestionnaire y pose.
    let pose: unknown = null;
    Object.defineProperty(rechargement, 'returnValue', {
      get: () => pose,
      set: (valeur: unknown) => {
        pose = valeur;
      },
    });

    window.dispatchEvent(rechargement);

    expect(rechargement.defaultPrevented).toBe(true);
    expect(pose).toBe('');
  });
});
