import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn<() => string>(() => '/accueil'));

vi.mock('next/navigation', () => ({ usePathname }));

vi.mock('@/components/layout/sidebar-nav', () => ({
  SidebarNav: () => <nav aria-label="Navigation principale" />,
}));

const { SidebarShell } = await import('@/components/layout/sidebar-shell');

describe('navigation du compte d’accueil', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/accueil');
  });

  it('libère toute la largeur dans l’espace Accueil, même pour l’admin', () => {
    const { container } = render(
      createElement(SidebarShell, { role: 'ADMIN', defaultCollapsed: false }),
    );

    expect(container.firstChild).toBeNull();
  });

  it('conserve la navigation dans les autres espaces', () => {
    usePathname.mockReturnValue('/chues/statistiques');
    render(createElement(SidebarShell, { role: 'ADMIN', defaultCollapsed: false }));

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
  });
});
