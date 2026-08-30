import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FiltersBar } from '@/components/filters/filters-bar';
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
    iefs: [],
    banques: [],
    syndicats: [],
    commerciaux: [],
    representants: [],
  });
});

async function openAdvanced(): Promise<void> {
  const bouton = await screen.findByRole('button', { name: /Filtres avancés/u });
  if (bouton.getAttribute('aria-expanded') === 'true') return;
  await userEvent.setup().click(bouton);
}

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('FiltersBar, cascade région → département', () => {
  it('une région choisie réduit les départements à ceux de cette région', async () => {
    setUrl('/prospects');
    renderWithQuery(<FiltersBar />);
    await openAdvanced();

    await choose('Région', 'Tambacounda');
    await userEvent.setup().click(screen.getByRole('combobox', { name: /Département/u }));

    expect(screen.getByRole('option', { name: /Bakel/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région efface le département déjà retenu', async () => {
    setUrl('/prospects?departementId=d-tamba');
    renderWithQuery(<FiltersBar />);
    await openAdvanced();

    await choose('Région', 'Dakar');

    expect(routerMock.push).toHaveBeenCalledWith('/prospects', { scroll: false });
  });
});
