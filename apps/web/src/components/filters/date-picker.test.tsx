import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from '@/components/filters/date-picker';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * La grille de dates doit être une GRILLE, pas quarante-deux boutons à plat.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `role="grid"` n'admet pas de `gridcell` en enfant direct : ARIA impose un
 * `row` entre les deux, et c'est de cette imbrication que le lecteur d'écran
 * tire la position d'un jour (« ligne 3, colonne 1 », donc « le lundi de la
 * troisième semaine »). Le calendrier rendait ses boutons directement sous la
 * grille, et posait la ligne d'en-têtes À CÔTÉ d'elle : ce `role="row"` n'avait
 * alors aucun `grid` propriétaire, et les sept `columnheader` ne se
 * rattachaient à aucune colonne.
 *
 * Rien de tout cela ne se voit à l'écran, ce qui est précisément pourquoi cela
 * a survécu : la mise en page en `grid-cols-7` de Tailwind produit le même
 * damier dans les deux cas.
 */

function openCalendar() {
  // Le déclencheur porte le libellé du champ (`aria-label={label}`).
  return userEvent.click(screen.getByRole('button', { name: 'Date de début' }));
}

function renderPicker() {
  return render(<DatePicker id="du" label="Date de début" value="2026-03-18" onChange={vi.fn()} />);
}

describe('la structure ARIA du calendrier', () => {
  it('n’expose AUCUNE cellule en enfant direct de la grille', async () => {
    renderPicker();
    await openCalendar();

    const grid = screen.getByRole('grid', { name: 'Date de début' });
    const cells = screen.getAllByRole('gridcell');

    expect(cells.length).toBeGreaterThan(0);
    // Le coeur du défaut : chaque cellule doit avoir une LIGNE pour parent, et
    // cette ligne doit appartenir à la grille.
    for (const cell of cells) {
      const row = cell.closest('[role="row"]');
      expect(row).not.toBeNull();
      expect(grid.contains(row)).toBe(true);
    }
  });

  it('range les en-têtes de colonnes DANS la grille, sur une ligne', () => {
    renderPicker();

    return openCalendar().then(() => {
      const grid = screen.getByRole('grid', { name: 'Date de début' });
      const headers = screen.getAllByRole('columnheader');

      expect(headers).toHaveLength(7);
      for (const header of headers) {
        const row = header.closest('[role="row"]');
        expect(row).not.toBeNull();
        // Une ligne orpheline, posée en soeur de la grille, ne rattache ses
        // en-têtes à aucune colonne.
        expect(grid.contains(row)).toBe(true);
      }
    });
  });

  it('découpe le mois en semaines de sept jours', async () => {
    renderPicker();
    await openCalendar();

    const grid = screen.getByRole('grid', { name: 'Date de début' });
    // Toutes les lignes de la grille, en-têtes compris.
    const rows = grid.querySelectorAll(':scope > [role="row"]');

    // Mars 2026 s'étale sur six semaines affichées, plus la ligne d'en-têtes.
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows) {
      expect(row.children).toHaveLength(7);
    }
  });
});
