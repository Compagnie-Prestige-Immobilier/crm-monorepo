import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepresentantsFiltersBar } from '@/components/representants/representants-filters-bar';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';

const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

const departement = (id: string, name: string, regionId: string, regionName: string) => ({
  id,
  code: id,
  name,
  regionId,
  regionName,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

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

async function open(field: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: new RegExp(field, 'u') }));
}

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await open(field);
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('RepresentantsFiltersBar, cascade région → département', () => {
  it('une région choisie réduit les départements à ceux de cette région', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsFiltersBar />);

    await choose('Région', 'Tambacounda');
    await open('Département');

    expect(screen.getByRole('option', { name: /Bakel/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région efface le département ET l’IEF déjà retenus', async () => {
    setUrl('/representants?departementId=d-tamba&iefId=i-tamba');
    renderWithQuery(<RepresentantsFiltersBar />);

    await choose('Région', 'Dakar');

    expect(routerMock.push).toHaveBeenCalledWith('/representants', { scroll: false });
  });

  it('sans département ni IEF retenus, choisir une région ne navigue pas', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsFiltersBar />);

    await choose('Région', 'Dakar');

    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('un lien portant un département sans région affiche quand même sa région', async () => {
    setUrl('/representants?departementId=d-tamba');
    renderWithQuery(<RepresentantsFiltersBar />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Région/u }).textContent).toContain(
        'Tambacounda',
      );
    });

    await open('Département');
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });
});
