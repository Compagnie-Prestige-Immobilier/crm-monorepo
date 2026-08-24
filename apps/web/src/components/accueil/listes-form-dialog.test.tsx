import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';
import type { VisiteReferentielEntry } from '@/lib/data/visites-referentiels';

const createVisiteReferentiel = vi.fn();
const updateVisiteReferentiel = vi.fn();

vi.mock('@/lib/data/visites-referentiels', () => ({
  createVisiteReferentiel: (kind: unknown, input: unknown) =>
    createVisiteReferentiel(kind, input) as unknown,
  updateVisiteReferentiel: (kind: unknown, id: unknown, patch: unknown) =>
    updateVisiteReferentiel(kind, id, patch) as unknown,
}));

const { ListeFormDialog } = await import('@/components/accueil/listes-form-dialog');

const entry: VisiteReferentielEntry = {
  id: 'e-1',
  code: 'CPI',
  label: 'CPI',
  isActive: true,
  isSystem: false,
  sortOrder: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ListeFormDialog', () => {
  it('ne propose pas de champ code au renommage : il ne change jamais', () => {
    renderWithQuery(
      <ListeFormDialog
        kind="entreprises"
        createTitle="Nouvelle entreprise"
        open
        onOpenChange={vi.fn()}
        entry={entry}
      />,
    );

    expect(screen.queryByLabelText(/^Code/)).toBeNull();
  });

  it('refuse un code en minuscules ou hors alphabet, sans appeler l’API', async () => {
    renderWithQuery(
      <ListeFormDialog
        kind="entreprises"
        createTitle="Nouvelle entreprise"
        open
        onOpenChange={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/^Code/), '@@');
    await userEvent.type(screen.getByLabelText(/^Libellé/), 'Une entreprise');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Majuscules, chiffres et tirets bas seulement.')).toBeTruthy();
    expect(createVisiteReferentiel).not.toHaveBeenCalled();
  });

  it('renomme sans jamais envoyer le code', async () => {
    updateVisiteReferentiel.mockResolvedValue({ ...entry, label: 'CPI SA' });
    renderWithQuery(
      <ListeFormDialog
        kind="entreprises"
        createTitle="Nouvelle entreprise"
        open
        onOpenChange={vi.fn()}
        entry={entry}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/^Libellé/));
    await userEvent.type(screen.getByLabelText(/^Libellé/), 'CPI SA');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(updateVisiteReferentiel).toHaveBeenCalledWith('entreprises', 'e-1', {
        label: 'CPI SA',
      });
    });
  });
});
