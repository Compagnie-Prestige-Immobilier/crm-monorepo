import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from '@/components/filters/date-picker';

function openCalendar() {
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
        expect(grid.contains(row)).toBe(true);
      }
    });
  });

  it('découpe le mois en semaines de sept jours', async () => {
    renderPicker();
    await openCalendar();

    const grid = screen.getByRole('grid', { name: 'Date de début' });
    const rows = grid.querySelectorAll(':scope > [role="row"]');

    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows) {
      expect(row.children).toHaveLength(7);
    }
  });
});
