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
});
