import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';
import type { Syndicat } from '@/lib/types';

const updateSyndicat = vi.fn();

vi.mock('@/lib/data/reference', () => ({ fetchRegions: vi.fn() }));
vi.mock('@/lib/data/referentiels', () => ({
  createBanque: vi.fn(),
  createDepartement: vi.fn(),
  createSyndicat: vi.fn(),
  updateBanque: vi.fn(),
  updateDepartement: vi.fn(),
  updateSyndicat: (id: string, body: unknown) => updateSyndicat(id, body) as unknown,
}));

const { SyndicatFormDialog } = await import(
  '@/components/referentiels/referentiel-form-dialog'
);

const syndicat = {
  id: 's-1',
  name: 'Syndicat de la santé',
  sigle: 'SDS',
  secteur: 'Santé',
  isActive: true,
  sortOrder: 10,
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Syndicat;

describe('SyndicatFormDialog', () => {
  it('efface réellement le secteur', async () => {
    updateSyndicat.mockResolvedValue({ ...syndicat, secteur: null });
    const user = userEvent.setup();
    renderWithQuery(<SyndicatFormDialog open onOpenChange={vi.fn()} syndicat={syndicat} />);

    await user.clear(screen.getByRole('textbox', { name: 'Secteur' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateSyndicat).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({ secteur: '' }),
      );
    });
  });
});
