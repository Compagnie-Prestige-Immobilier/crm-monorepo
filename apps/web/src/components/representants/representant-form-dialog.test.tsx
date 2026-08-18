import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import type * as ReferenceModule from '@/lib/data/reference';
import type * as RepresentantsModule from '@/lib/data/representants';
import type { RepresentantRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';

const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

const updateRepresentant = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return {
    ...actual,
    updateRepresentant: (id: string, patch: unknown) => updateRepresentant(id, patch) as unknown,
    lookupRepresentantByPhone: () =>
      Promise.resolve({
        found: false,
        phoneE164: '+221771234567',
        representant: null,
        ownedByCommercialName: null,
        ownedByCommercialId: null,
      }),
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const departement = (id: string, name: string, regionId: string, regionName: string) => ({
  id,
  code: id,
  name,
  regionId,
  regionName,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const FICHE = {
  id: 'rep-1',
  fullName: 'Ndeye Fall',
  phoneE164: '+221771234567',
  departementId: 'd-tamba',
  departementName: 'Tambacounda',
  iefId: 'i-tamba',
  iefName: 'IEF Tambacounda',
  notes: null,
  relationStatus: 'CONTACTE',
} as RepresentantRow;

beforeEach(() => {
  reference.mockReset();
  reference.mockResolvedValue({
    regions: [
      { id: 'r-dk', code: 'DK', name: 'Dakar' },
      { id: 'r-tc', code: 'TC', name: 'Tambacounda' },
    ],
    departements: [
      departement('d-dakar', 'Dakar', 'r-dk', 'Dakar'),
      departement('d-pikine', 'Pikine', 'r-dk', 'Dakar'),
      departement('d-tamba', 'Tambacounda', 'r-tc', 'Tambacounda'),
      departement('d-bakel', 'Bakel', 'r-tc', 'Tambacounda'),
    ],
    iefs: [
      {
        id: 'i-tamba',
        code: 'I-TC',
        name: 'IEF Tambacounda',
        departementId: 'd-tamba',
        departementName: 'Tambacounda',
        regionName: 'Tambacounda',
        isActive: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    banques: [],
    syndicats: [],
    commerciaux: [],
    representants: [],
    campagnes: [],
  });
});

const trigger = (field: string): HTMLElement =>
  screen.getByRole('combobox', { name: new RegExp(field, 'u') });

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(trigger(field));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('RepresentantFormDialog, cascade région → département', () => {
  it('une fiche enregistrée sans région affiche celle de son département', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });

    await userEvent.setup().click(trigger('Département'));
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région vide le département ET l’IEF de la fiche', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });

    await choose('Région', 'Dakar');

    expect(trigger('Département').textContent).toContain('Choisir un département');
    expect(trigger('IEF').textContent).toContain('Aucune');
  });
});

describe('RepresentantFormDialog, état de la relation', () => {
  beforeEach(() => {
    updateRepresentant.mockReset();
    updateRepresentant.mockResolvedValue({ ...FICHE, relationStatus: 'AMBASSADEUR' });
  });

  it('n’envoie AUCUN statut quand l’utilisateur n’y a pas touché', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('relationStatus');
  });

  it('envoie le statut dès qu’il change', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Contacté');
    });
    await choose('Relation', 'Ambassadeur');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({
      relationStatus: 'AMBASSADEUR',
    });
  });

  it('ne propose pas d’état à la création : une fiche neuve n’a pas d’histoire', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Créer la fiche' })).toBeTruthy();
    });
    expect(screen.queryByRole('combobox', { name: /Relation/u })).toBeNull();
  });
});
