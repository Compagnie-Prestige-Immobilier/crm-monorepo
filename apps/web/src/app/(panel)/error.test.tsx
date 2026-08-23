import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PanelError from '@/app/(panel)/error';

const erreur = (digest?: string): Error & { digest?: string } =>
  Object.assign(new Error('boom'), digest === undefined ? {} : { digest });

describe('frontière d’erreur du panel', () => {
  it('parle français et laisse une issue', async () => {
    const reset = vi.fn();
    render(<PanelError error={erreur()} reset={reset} />);

    expect(screen.getByRole('alert').textContent).toContain('n’a pas pu s’afficher');
    expect(screen.getByRole('link', { name: 'Revenir aux espaces' }).getAttribute('href')).toBe(
      '/espaces',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('montre le code du journal serveur, seul repère utile au support', () => {
    render(<PanelError error={erreur('a1b2c3')} reset={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('a1b2c3');
  });

  it('n’invente pas de code quand Next n’en fournit pas', () => {
    render(<PanelError error={erreur()} reset={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).not.toContain('Code à communiquer');
  });
});
