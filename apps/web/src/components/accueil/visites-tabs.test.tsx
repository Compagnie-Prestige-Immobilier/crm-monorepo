import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn(() => '/accueil'));
vi.mock('next/navigation', () => ({ usePathname }));

const { VisitesTabs } = await import('@/components/accueil/visites-tabs');

describe('onglet d’import du registre', () => {
  it('n’apparaît qu’à l’ADMIN et à la DIRECTION', () => {
    // oxlint-disable-next-line jsx-a11y/aria-role -- prop métier, pas un rôle ARIA
    render(<VisitesTabs role="ADMIN" />);
    expect(screen.getByRole('link', { name: 'Import' }).getAttribute('href')).toBe(
      '/accueil/import',
    );
  });

  it('reste fermé au comptoir', () => {
    // oxlint-disable-next-line jsx-a11y/aria-role -- prop métier, pas un rôle ARIA
    render(<VisitesTabs role="ACCUEIL" />);
    expect(screen.queryByRole('link', { name: 'Import' })).toBeNull();
  });
});
