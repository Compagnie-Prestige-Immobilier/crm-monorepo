import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoBanner } from '@/components/layout/demo-banner';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le bandeau doit dire POURQUOI l'enregistrement va échouer, avant l'échec.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tant que le mode démonstration est actif, l'API refuse toute écriture par un
 * 409 `DEMO_MODE_READ_ONLY`. Le toast qui en découle explique la cause, mais
 * APRÈS coup : l'utilisateur a rempli son formulaire, cliqué, et découvre
 * seulement là qu'il ne pouvait pas l'enregistrer. Le bandeau est le seul
 * endroit où l'information arrive AVANT le geste, puisqu'il est rendu sur tous
 * les écrans du panel.
 *
 * On étend donc CE bandeau plutôt que d'en empiler un second : la hauteur utile
 * du panel est déjà courte, et deux bandes horizontales mangeraient la première
 * ligne de chaque tableau.
 */

describe('DemoBanner', () => {
  it('annonce que les écritures sont suspendues, et pas seulement que les données sont fictives', () => {
    render(<DemoBanner seededAt={null} role="ADMIN" />);

    expect(screen.getByRole('status').textContent).toMatch(/écritures suspendues/u);
  });

  /**
   * Sans cette phrase, « écritures suspendues » se lit « mes équipes sont
   * arrêtées », et un responsable coupe la démonstration en pleine réunion. La
   * remontée hors ligne du mobile n'est JAMAIS refusée par l'API : le bandeau
   * doit le dire là où il annonce la suspension, pas ailleurs.
   */
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

  /**
   * `role="status"` et non `alert` : l'information est permanente et
   * contextuelle, et un `alert` interromprait la lecture à CHAQUE navigation du
   * panel. C'est le genre de détail qu'un correctif de copie casse sans le
   * voir.
   */
  it('reste une région « status », jamais une alerte', () => {
    render(<DemoBanner seededAt={null} role="ADMIN" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  /**
   * Le raccourci de réparation n'est offert qu'à qui peut réparer : un agent
   * qui suit un lien vers `/parametres` y reçoit un refus, ce qui ajoute une
   * impasse à une situation déjà confuse.
   */
  it('n’offre le raccourci « Gérer » qu’à un ADMIN', () => {
    const { unmount } = render(<DemoBanner seededAt={null} role="ADMIN" />);
    expect(screen.getByRole('link', { name: 'Gérer' }).getAttribute('href')).toBe('/parametres');
    unmount();

    render(<DemoBanner seededAt={null} role="BANQUE_FINANCE" />);
    expect(screen.queryByRole('link', { name: 'Gérer' })).toBeNull();
  });
});
