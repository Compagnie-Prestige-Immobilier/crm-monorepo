import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReferenceModule from '@/lib/data/reference';
import type * as ReferentielsModule from '@/lib/data/referentiels';
import { renderWithQuery } from '@/test/render-query';

const fetchEmployeurs = vi.fn<() => unknown>();
const saveEmployeur = vi.fn<(input: unknown) => unknown>();

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchEmployeurs: () => fetchEmployeurs() as unknown };
});

vi.mock('@/lib/data/referentiels', async () => {
  const actual = await vi.importActual<typeof ReferentielsModule>('@/lib/data/referentiels');
  return { ...actual, saveEmployeur: (input: unknown) => saveEmployeur(input) as unknown };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

const { OpenReferentialTab } = await import('@/components/referentiels/open-referential-tab');

const MINISTERE = {
  id: 'emp-sante',
  code: 'MIN_SANTE',
  label: 'Ministère de la Santé',
  type: 'MINISTERE',
  position: 1,
  isActive: true,
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const ENTREPRISE = {
  ...MINISTERE,
  id: 'emp-sonatel',
  code: 'SONATEL',
  label: 'Sonatel',
  type: 'ENTREPRISE',
};

beforeEach(() => {
  fetchEmployeurs.mockReset();
  saveEmployeur.mockReset();
  fetchEmployeurs.mockResolvedValue([MINISTERE, ENTREPRISE]);
  saveEmployeur.mockResolvedValue(MINISTERE);
});

describe('le référentiel des employeurs', () => {
  it('montre le type en toutes lettres, à côté du libellé', async () => {
    renderWithQuery(<OpenReferentialTab kind="employeurs" />);

    expect(await screen.findByText('Ministère de la Santé')).toBeTruthy();
    expect(screen.getByText('Ministère')).toBeTruthy();
    expect(screen.getByText('Entreprise')).toBeTruthy();
  });

  it('enregistre un ajout avec son type', async () => {
    const user = userEvent.setup();
    renderWithQuery(<OpenReferentialTab kind="employeurs" />);
    await screen.findByText('Sonatel');

    await user.click(screen.getByRole('button', { name: /Nouvel? employeur/u }));
    await user.type(screen.getByLabelText('Code'), 'ORANGE');
    await user.type(screen.getByLabelText('Libellé'), 'Orange Sénégal');
    await user.selectOptions(screen.getByLabelText('Type'), 'ENTREPRISE');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(saveEmployeur).toHaveBeenCalledWith({
        code: 'ORANGE',
        label: 'Orange Sénégal',
        type: 'ENTREPRISE',
        isActive: true,
      });
    });
  });

  it('reprend le type existant à la modification', async () => {
    const user = userEvent.setup();
    renderWithQuery(<OpenReferentialTab kind="employeurs" />);
    await screen.findByText('Sonatel');

    await user.click(screen.getByRole('button', { name: 'Modifier Sonatel' }));

    expect(screen.getByLabelText<HTMLSelectElement>('Type').value).toBe('ENTREPRISE');
  });
});
