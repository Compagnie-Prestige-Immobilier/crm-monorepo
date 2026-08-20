import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoBanner } from '@/components/layout/demo-banner';

describe('DemoBanner', () => {
  it('annonce que les écritures sont suspendues, et pas seulement que les données sont fictives', () => {
    render(<DemoBanner seededAt={null} role="ADMIN" />);

    expect(screen.getByRole('status').textContent).toMatch(/écritures suspendues/u);
  });

  it('rassure sur le terrain dans la même phrase que la suspension', () => {
    render(<DemoBanner seededAt={null} role="COMMERCIAL" />);

    expect(screen.getByRole('status').textContent).toMatch(
      /synchronisation mobile reste acceptée/u,
    );
  });

  it('garde ce qu’il disait déjà : données fictives, jeu daté, et pas d’export', () => {
    render(<DemoBanner seededAt="2026-03-04T10:00:00.000Z" role="ADMIN" />);

    const text = screen.getByRole('status').textContent;
    expect(text).toMatch(/Données fictives/u);
    expect(text).toMatch(/Ne pas exporter/u);
    expect(text).toMatch(/2026/u);
  });

  it('reste une région « status », jamais une alerte', () => {
    render(<DemoBanner seededAt={null} role="ADMIN" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('n’offre le raccourci « Gérer » qu’à un ADMIN', () => {
    const { unmount } = render(<DemoBanner seededAt={null} role="ADMIN" />);
    expect(screen.getByRole('link', { name: 'Gérer' }).getAttribute('href')).toBe('/admin/parametres');
    unmount();

    render(<DemoBanner seededAt={null} role="BANQUE_FINANCE" />);
    expect(screen.queryByRole('link', { name: 'Gérer' })).toBeNull();
  });
});
