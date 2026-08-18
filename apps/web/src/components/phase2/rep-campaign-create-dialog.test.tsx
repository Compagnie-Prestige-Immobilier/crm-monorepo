import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepCampaignCreateDialog } from '@/components/phase2/rep-campaign-create-dialog';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';

const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
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
  await user.click(await screen.findByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('RepCampaignCreateDialog, cascade région → département', () => {
  it('une région choisie réduit les départements à ceux de cette région', async () => {
    renderWithQuery(<RepCampaignCreateDialog open onOpenChange={vi.fn()} />);

    await choose('Région', 'Tambacounda');
    await userEvent.setup().click(trigger('Département'));

    expect(screen.getByRole('option', { name: /Bakel/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région efface le département ET l’IEF du périmètre', async () => {
    renderWithQuery(<RepCampaignCreateDialog open onOpenChange={vi.fn()} />);

    await choose('Département', '^Tambacounda');
    await choose('IEF', 'IEF Tambacounda');
    await choose('Région', 'Dakar');

    expect(trigger('Département').textContent).toContain('Tous les départements');
    expect(trigger('IEF').textContent).toContain('Toutes les IEF');
  });
});
